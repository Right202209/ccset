import { CcsetError, EXIT_UNKNOWN_AGENT, EXIT_UNSUPPORTED_COMMAND, EXIT_USAGE } from '../core/errors.js'
import type { Agent } from '../types.js'
import type {
  CommandDeclaration,
  OperationRequest,
} from '../operations/types.js'
import { scanGlobals } from './globals.js'
import {
  REDACTED_VALUE,
  type ParseState,
  type ReaderContext,
  readOption,
  usage,
} from './parser-options.js'

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
      operation: REDACTED_VALUE,
    })
  }
  throw usage('cli.usage.unknownCommand', { command: REDACTED_VALUE })
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

function readPositional(token: string, declaration: CommandDeclaration, state: ParseState): void {
  if (declaration.argument !== 'providerId' || state.providerId !== undefined) {
    throw usage('cli.usage.unexpectedArgument', { value: REDACTED_VALUE })
  }
  const problem = declaration.validateArgument?.(token)
  if (problem !== null && problem !== undefined) {
    throw new CcsetError(problem, EXIT_USAGE, { name: REDACTED_VALUE })
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
  const ctx: ReaderContext = { tokens, index: 0, declaration, state }
  while (ctx.index < ctx.tokens.length) {
    const token = ctx.tokens[ctx.index] ?? ''
    if (token.startsWith('-')) readOption(ctx)
    else {
      readPositional(token, declaration, state)
      ctx.index += 1
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
    throw new CcsetError('error.unknownAgent', EXIT_UNKNOWN_AGENT, { id: REDACTED_VALUE })
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
