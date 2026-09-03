import type { JsonValue } from '../types.js'
import type { UsageProblem } from './errors.js'
import { EXIT_USAGE, OperationError } from './errors.js'
import type { OperationId, OperationRequest } from './operation.js'

// ── Types ────────────────────────────────────────────────────────────

export interface CommandField {
  /** Stable field id, matching the agent's FieldSpec id. */
  id: string
  /** CLI long option name (without --). */
  long: string
  /** Restricts the raw value; '' is never one (removal is --unset). */
  choices?: string[]
  required?: boolean
  /** Agent-owned check on the raw string; returns a structured problem. */
  validate?: (raw: string) => UsageProblem | null
  /** Agent-owned conversion of a validated raw string to its JSON value. */
  convert: (raw: string) => JsonValue
}

/** What an agent's cross-field rules see: the converted invocation. */
export interface ParsedInvocation {
  values: Record<string, JsonValue>
  unset: Set<string>
}

export interface CommandDeclaration {
  /** Stable command id, e.g. 'global.set'. */
  id: OperationId
  /** The command word as typed by the user, e.g. 'global'. */
  command: string
  /** The subcommand word, e.g. 'set'. */
  subcommand: string
  fields: CommandField[]
  /** Agent-owned cross-field rules (coupled fields, conflicts). */
  crossField?: (inv: ParsedInvocation) => UsageProblem[]
}

// ── Parsing ──────────────────────────────────────────────────────────

export interface SplitArgv {
  command: string
  subcommand: string
  options: Map<string, string | boolean>
  /** Raw --unset names, in the order given; repeatable by design. */
  unset: string[]
  problems: UsageProblem[]
}

/**
 * Built-in flags every command accepts. Parsed before field options and never
 * passed to buildRequest as field values. `--token-stdin` is deliberately
 * absent: it is deferred to M3.3, and accepting it before its semantics exist
 * would let a pipeline pour a credential into nothing.
 */
const BUILTIN_FLAGS = new Set(['dry-run', 'json', 'replace-invalid'])

/** One `-…` token, split into its option key and any inline `=value`. */
interface FlagToken {
  key: string
  inline?: string
  index: number
}

function tokenize(arg: string, index: number): FlagToken {
  const eq = arg.indexOf('=')
  return {
    key: eq >= 0 ? arg.slice(2, eq) : arg.slice(2),
    inline: eq >= 0 ? arg.slice(eq + 1) : undefined,
    index,
  }
}

/**
 * The value after a flag token: an inline `=value` always wins, and a bare
 * value must not look like another flag — `--agent --json` is a missing value,
 * not an agent literally named `--json`.
 */
function takeValue(argv: string[], token: FlagToken): { value: string | null, next: number } {
  if (token.inline !== undefined) return { value: token.inline, next: token.index + 1 }
  const next = argv[token.index + 1]
  if (next === undefined || next.startsWith('-')) return { value: null, next: token.index + 1 }
  return { value: next, next: token.index + 2 }
}

function takeUnset(out: SplitArgv, argv: string[], token: FlagToken): number {
  const taken = takeValue(argv, token)
  if (taken.value === null) {
    out.problems.push({ code: 'error.missingValue', params: { option: '--unset' } })
    return taken.next
  }
  out.unset.push(taken.value)
  return taken.next
}

function takeFlag(out: SplitArgv, token: FlagToken): number {
  if (token.inline !== undefined) {
    out.problems.push({ code: 'error.noValueExpected', params: { option: `--${token.key}` } })
  } else {
    out.options.set(token.key, true)
  }
  return token.index + 1
}

function takeOption(out: SplitArgv, argv: string[], token: FlagToken): number {
  const taken = takeValue(argv, token)
  if (taken.value === null) {
    out.problems.push({ code: 'error.missingValue', params: { option: `--${token.key}` } })
    return taken.next
  }
  if (out.options.has(token.key)) {
    out.problems.push({ code: 'error.duplicateOption', params: { option: `--${token.key}` } })
    return taken.next
  }
  out.options.set(token.key, taken.value)
  return taken.next
}

function splitOption(out: SplitArgv, argv: string[], token: FlagToken): number {
  if (token.key === 'agent') {
    // The CLI boundary consumed it from the full argv; here it is only
    // skipped, with its value, so the option may sit on either side of the
    // command word.
    return takeValue(argv, token).next
  }
  if (token.key === 'unset') return takeUnset(out, argv, token)
  if (BUILTIN_FLAGS.has(token.key)) return takeFlag(out, token)
  return takeOption(out, argv, token)
}

function pushPositional(out: SplitArgv, arg: string, positionals: number): number {
  if (positionals === 0) out.command = arg
  else if (positionals === 1) out.subcommand = arg
  else out.problems.push({ code: 'error.unexpectedArgument', params: { value: arg } })
  return positionals + 1
}

/**
 * Split the full original argv into the command words, the options, and the
 * structured problems. Positional words may sit before, between, or after
 * flags: the first two are the command and subcommand, any further one is an
 * unexpected argument. Value-taking options accept `--key value` and
 * `--key=value`; a repeated scalar is a usage error, while `--unset` repeats.
 */
export function splitCommandArgv(argv: string[]): SplitArgv {
  const out: SplitArgv = { command: '', subcommand: '', options: new Map(), unset: [], problems: [] }
  let positionals = 0
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]!
    if (arg.startsWith('-')) {
      i = splitOption(out, argv, tokenize(arg, i))
    } else {
      positionals = pushPositional(out, arg, positionals)
      i += 1
    }
  }
  return out
}

// ── Request building ─────────────────────────────────────────────────

/** The request under construction, so each check below reads as one step. */
interface RequestDraft {
  values: Record<string, JsonValue>
  provided: Set<string>
  unset: Set<string>
  problems: UsageProblem[]
}

function collectUnset(decl: CommandDeclaration, parsed: SplitArgv, draft: RequestDraft): void {
  for (const name of parsed.unset) {
    const field = decl.fields.find((f) => f.id === name || f.long === name)
    if (field === undefined) {
      draft.problems.push({ code: 'error.unknownField', params: { value: name } })
      continue
    }
    draft.unset.add(field.id)
  }
}

/** Per-field checks on the raw string: empty, choices, then the agent's own. */
function optionProblems(field: CommandField, raw: string): UsageProblem[] {
  const problems: UsageProblem[] = []
  if (raw.length === 0) {
    problems.push({ code: 'error.emptyValue', params: { option: `--${field.long}` } })
    return problems
  }
  if (field.choices !== undefined && !field.choices.includes(raw)) {
    problems.push({
      code: 'error.invalidChoice',
      params: { option: `--${field.long}`, choices: field.choices.join(', ') },
    })
    return problems
  }
  const problem = field.validate?.(raw) ?? null
  if (problem !== null) problems.push(problem)
  return problems
}

function collectOptions(decl: CommandDeclaration, parsed: SplitArgv, draft: RequestDraft): void {
  for (const [key, raw] of parsed.options) {
    if (typeof raw !== 'string') continue
    const field = decl.fields.find((f) => f.long === key)
    if (field === undefined) {
      draft.problems.push({ code: 'error.unknownOption', params: { option: `--${key}` } })
      continue
    }
    if (draft.unset.has(field.id)) {
      draft.problems.push({ code: 'error.conflictSetUnset', params: { field: field.id } })
      continue
    }
    const problems = optionProblems(field, raw)
    if (problems.length > 0) {
      draft.problems.push(...problems)
      continue
    }
    draft.provided.add(field.id)
    draft.values[field.id] = field.convert(raw)
  }
}

function collectMissing(decl: CommandDeclaration, draft: RequestDraft): void {
  for (const field of decl.fields) {
    if (field.required === true && !draft.provided.has(field.id) && !draft.unset.has(field.id)) {
      draft.problems.push({ code: 'error.requiredField', params: { option: `--${field.long}` } })
    }
  }
}

function collectCrossField(decl: CommandDeclaration, draft: RequestDraft): void {
  if (decl.crossField === undefined) return
  draft.problems.push(...decl.crossField({ values: draft.values, unset: draft.unset }))
}

/**
 * An empty patch is only its own problem when nothing else already failed:
 * when a value was rejected, that rejection is the cause worth reporting.
 */
function collectEmptyPatch(draft: RequestDraft): void {
  const empty = Object.keys(draft.values).length === 0 && draft.unset.size === 0
  if (draft.problems.length === 0 && empty) {
    draft.problems.push({ code: 'error.emptyPatch' })
  }
}

/**
 * Build an OperationRequest from a parsed invocation and its declaration.
 * Every problem is collected before anything is thrown, so one bad invocation
 * reports all of its mistakes, and the request is only built — and the target
 * only read — once the syntax is fully accepted.
 */
export function buildRequest(
  decl: CommandDeclaration,
  parsed: SplitArgv,
  agentId: string,
): OperationRequest {
  const draft: RequestDraft = { values: {}, provided: new Set(), unset: new Set(), problems: [] }
  collectUnset(decl, parsed, draft)
  collectOptions(decl, parsed, draft)
  collectMissing(decl, draft)
  collectCrossField(decl, draft)
  collectEmptyPatch(draft)

  if (draft.problems.length > 0) {
    throw new OperationError('usage', draft.problems, EXIT_USAGE)
  }

  return {
    operation: decl.id,
    agentId,
    values: draft.values,
    unset: draft.unset,
    dryRun: parsed.options.get('dry-run') === true,
    replaceInvalid: parsed.options.get('replace-invalid') === true,
  }
}

// ── Lookup ───────────────────────────────────────────────────────────

/** Find a command declaration matching the given command and subcommand. */
export function findCommand(
  commands: CommandDeclaration[],
  command: string,
  subcommand: string,
): CommandDeclaration | undefined {
  return commands.find((c) => c.command === command && c.subcommand === subcommand)
}

/** Command + subcommand pairs for unknown-command error context. */
export function describeCommands(commands: CommandDeclaration[]): string {
  return commands.map((c) => `${c.command} ${c.subcommand}`).join(', ')
}
