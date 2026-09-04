import { CcsetError, EXIT_USAGE, EXIT_UNKNOWN_AGENT, EXIT_UNSUPPORTED_COMMAND } from '../core/errors.js'
import type { Agent } from '../types.js'
import type {
  CommandDeclaration,
  CommandFieldSpec,
  OperationRequest,
  PatchMap,
} from '../operations/types.js'
import { scanGlobals } from './globals.js'

/**
 * The command-mode parser. Pure against the filesystem and the environment,
 * so a syntax error can never have a side effect: the token's presence
 * arrives as a parameter read once at the cli.tsx boundary. Every value it
 * returns was normalized against a declaration the agent module owns.
 */

export interface ParsedCommand {
  agent: Agent
  declaration: CommandDeclaration
  request: OperationRequest
  /** --json selects the machine-readable envelope over the human lines. */
  json: boolean
  /** Where the operation's secret must come from; null when none applies. */
  secretSource: 'env' | 'stdin' | null
}

interface ParseState {
  patch: PatchMap
  unsets: string[]
  providerId?: string
  replaceInvalid: boolean
  dryRun: boolean
  tokenStdin: boolean
}

function usage(messageKey: string, params: Record<string, string> = {}): CcsetError {
  return new CcsetError(messageKey, EXIT_USAGE, params)
}

export function missingAgentError(): CcsetError {
  return usage('cli.usage.missingAgent')
}

/** Strips --json and reads --agent, which every command requires explicitly. */
function extractGlobals(tokens: string[]): { agentId: string; json: boolean; rest: string[] } {
  const scan = scanGlobals(tokens)
  if (scan.missingValueFor !== null) {
    throw usage('cli.usage.missingValue', { option: scan.missingValueFor })
  }
  if (scan.agentId === null) throw missingAgentError()
  return { agentId: scan.agentId, json: scan.json, rest: scan.rest }
}

/**
 * Two-word verbs are the norm (`global set`), so the two-token spelling is
 * tried first. A verb another agent declares but this one does not serve is a
 * distinct failure from one no agent declares.
 */
function matchDeclaration(
  tokens: string[],
  agent: Agent,
  agents: Agent[],
): { declaration: CommandDeclaration; tokens: string[] } {
  const pair = `${tokens[0] ?? ''} ${tokens[1] ?? ''}`.trim().replace(' ', '.')
  const operations = agent.commands?.operations ?? []
  const declaration =
    operations.find((candidate) => candidate.id === pair) ??
    operations.find((candidate) => candidate.id === tokens[0])
  if (declaration !== undefined) {
    const width = declaration.id.includes('.') ? 2 : 1
    return { declaration, tokens: tokens.slice(width) }
  }
  const requested = tokens.slice(0, 2).join(' ')
  const known = agents.some((candidate) =>
    (candidate.commands?.operations ?? []).some(
      (operation) => operation.id === pair || operation.id === tokens[0],
    ),
  )
  if (known) {
    throw new CcsetError('error.unsupportedCommand', EXIT_UNSUPPORTED_COMMAND, {
      agent: agent.id,
      operation: requested,
    })
  }
  throw usage('cli.usage.unknownCommand', { command: requested })
}

function optionValue(
  tokens: string[],
  index: number,
  option: string,
  inline: string | undefined,
): { value: string; next: number } {
  if (inline !== undefined) return { value: inline, next: index + 1 }
  const value = tokens[index + 1]
  if (value === undefined) throw usage('cli.usage.missingValue', { option })
  return { value, next: index + 2 }
}

function normalizedValue(field: CommandFieldSpec, option: string, raw: string): string | number | boolean {
  if (raw.length === 0) throw usage('cli.usage.emptyValue', { option })
  if (field.type === 'boolean') {
    if (raw === 'true') return true
    if (raw === 'false') return false
    throw usage('cli.usage.invalidBoolean', { option, value: raw })
  }
  if (field.type === 'choice') {
    if (!(field.choices ?? []).includes(raw)) {
      throw usage('cli.usage.invalidChoice', { option, value: raw, choices: (field.choices ?? []).join(', ') })
    }
    return raw
  }
  const problem = field.validate?.(raw)
  if (problem !== null && problem !== undefined) {
    throw new CcsetError(problem, EXIT_USAGE, { option })
  }
  return field.type === 'int' ? Number(raw) : raw
}

/** Assignment and unset of one field cannot coexist; removal is never inferred. */
function checkUnsetConflicts(
  declaration: CommandDeclaration,
  state: ParseState,
  secretSource: 'env' | 'stdin' | null,
): void {
  for (const id of state.unsets) {
    if (Object.prototype.hasOwnProperty.call(state.patch, id)) {
      throw usage('cli.usage.unsetConflict', { field: id })
    }
  }
  const secretOnly = secretSource !== null && Object.keys(state.patch).length === 0
  if (
    declaration.patchRequired === true &&
    Object.keys(state.patch).length === 0 &&
    state.unsets.length === 0 &&
    !secretOnly
  ) {
    throw usage('cli.usage.emptyPatch')
  }
}

function readUnset(
  token: string,
  tokens: string[],
  index: number,
  declaration: CommandDeclaration,
  state: ParseState,
): number {
  const inline = token.startsWith('--unset=') ? token.slice('--unset='.length) : undefined
  const { value, next } = optionValue(tokens, index, '--unset', inline)
  const field = declaration.fields.find((candidate) => candidate.id === value)
  if (field === undefined) throw usage('cli.usage.unknownField', { field: value })
  if (field.unsettable !== true) throw usage('cli.usage.notUnsettable', { field: value })
  if (!state.unsets.includes(value)) state.unsets.push(value)
  return next
}

function readFieldOption(
  field: CommandFieldSpec,
  tokens: string[],
  index: number,
  state: ParseState,
): number {
  if (field.type === 'flag') {
    if (tokens[index] !== field.option) throw usage('cli.usage.flagValue', { option: field.option })
    if (state.patch[field.id] === true) throw usage('cli.usage.duplicateOption', { option: field.option })
    state.patch[field.id] = true
    return index + 1
  }
  if (field.type !== 'list' && Object.prototype.hasOwnProperty.call(state.patch, field.id)) {
    throw usage('cli.usage.duplicateOption', { option: field.option })
  }
  const inline = tokens[index]?.startsWith(`${field.option}=`)
    ? tokens[index]?.slice(field.option.length + 1)
    : undefined
  const { value, next } = optionValue(tokens, index, field.option, inline)
  if (field.type === 'list') {
    const trimmed = value.trim()
    if (trimmed.length === 0) throw usage('cli.usage.emptyValue', { option: field.option })
    const current = state.patch[field.id]
    state.patch[field.id] = [...(Array.isArray(current) ? current : []), trimmed]
    return next
  }
  state.patch[field.id] = normalizedValue(field, field.option, value)
  return next
}

function readOption(
  token: string,
  tokens: string[],
  index: number,
  declaration: CommandDeclaration,
  state: ParseState,
): number {
  const option = token.split('=')[0] ?? token
  const bare = token === option
  if (option === '--unset') return readUnset(token, tokens, index, declaration, state)
  if (option === '--dry-run') {
    if (!bare) throw usage('cli.usage.flagValue', { option })
    if (declaration.dryRunnable !== true) throw usage('cli.usage.dryRunUnsupported')
    if (state.dryRun) throw usage('cli.usage.duplicateOption', { option })
    state.dryRun = true
    return index + 1
  }
  if (option === '--replace-invalid') {
    if (!bare) throw usage('cli.usage.flagValue', { option })
    if (declaration.replaceable !== true) throw usage('cli.usage.replaceInvalidUnsupported')
    if (state.replaceInvalid) throw usage('cli.usage.duplicateOption', { option })
    state.replaceInvalid = true
    return index + 1
  }
  if (option === '--token-stdin') {
    if (!bare) throw usage('cli.usage.flagValue', { option })
    if (declaration.takesSecret !== true) throw usage('cli.usage.noSecretAccepted')
    if (state.tokenStdin) throw usage('cli.usage.duplicateOption', { option })
    state.tokenStdin = true
    return index + 1
  }
  const field = declaration.fields.find((candidate) => candidate.option === option)
  if (field === undefined) throw usage('cli.usage.unknownOption', { option })
  return readFieldOption(field, tokens, index, state)
}

function readPositional(token: string, declaration: CommandDeclaration, state: ParseState): void {
  if (declaration.argument !== 'providerId' || state.providerId !== undefined) {
    throw usage('cli.usage.unexpectedArgument', { value: token })
  }
  const problem = declaration.validateArgument?.(token)
  if (problem !== null && problem !== undefined) {
    throw new CcsetError(problem, EXIT_USAGE, { name: token })
  }
  state.providerId = token
}

/** Field parsing for a matched declaration: everything a usage error interrupts. */
function finishParse(
  declaration: CommandDeclaration,
  tokens: string[],
  tokenEnv: string | undefined,
): { request: OperationRequest; secretSource: 'env' | 'stdin' | null } {
  const state: ParseState = { patch: {}, unsets: [], replaceInvalid: false, dryRun: false, tokenStdin: false }
  for (let index = 0; index < tokens.length; ) {
    const token = tokens[index] ?? ''
    if (token.startsWith('-')) index = readOption(token, tokens, index, declaration, state)
    else {
      readPositional(token, declaration, state)
      index += 1
    }
  }
  if (declaration.argument === 'providerId' && state.providerId === undefined) {
    throw usage('cli.usage.missingProviderId')
  }
  const secretSource = secretSourceOf(declaration, state, tokenEnv)
  checkUnsetConflicts(declaration, state, secretSource)
  return {
    request: {
      operation: declaration.id,
      providerId: state.providerId,
      patch: state.patch,
      unsets: state.unsets,
      replaceInvalid: state.replaceInvalid,
      dryRun: state.dryRun,
    },
    secretSource,
  }
}

export function parseCommand(argv: string[], agents: Agent[], tokenEnv: string | undefined): ParsedCommand {
  const { agentId, json, rest } = extractGlobals([...argv])
  const agent = agents.find((candidate) => candidate.id === agentId)
  if (agent === undefined) {
    throw new CcsetError('error.unknownAgent', EXIT_UNKNOWN_AGENT, { id: agentId })
  }
  const { declaration, tokens } = matchDeclaration(rest, agent, agents)
  try {
    const { request, secretSource } = finishParse(declaration, tokens, tokenEnv)
    return { agent, declaration, json, request, secretSource }
  } catch (err) {
    // The declaration had matched, so a failure envelope can still name the
    // operation even though no ParsedCommand escapes the parser.
    if (err instanceof CcsetError && err.command === undefined) {
      err.command = { agent: agent.id, operation: declaration.id }
    }
    throw err
  }
}

function secretSourceOf(
  declaration: CommandDeclaration,
  state: ParseState,
  tokenEnv: string | undefined,
): 'env' | 'stdin' | null {
  if (declaration.takesSecret !== true) return null
  const fromEnv = tokenEnv !== undefined && tokenEnv.length > 0 ? tokenEnv : undefined
  if (state.tokenStdin && fromEnv !== undefined) throw usage('cli.usage.secretSourceConflict')
  if (state.tokenStdin) return 'stdin'
  return fromEnv !== undefined ? 'env' : null
}
