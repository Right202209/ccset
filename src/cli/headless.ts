import type { Ctx } from '../types.js'
import { findAgent } from '../registry.js'
import type { Agent } from '../types.js'
import type { CommandDeclaration, SplitArgv } from '../core/command.js'
import { buildRequest, describeCommands, findCommand, splitCommandArgv } from '../core/command.js'
import { runOperation, type OperationRequest, type OperationResult } from '../core/operation.js'
import {
  CcsetError,
  EXIT_UNKNOWN_AGENT,
  EXIT_UNKNOWN_COMMAND,
  EXIT_USAGE,
  OperationError,
  toCcsetError,
} from '../core/errors.js'
import { presentErrorHuman, presentErrorJson, presentHuman, presentJson } from './present.js'
import type { ErrorContext } from './present.js'

/**
 * True when argv carries a non-flag positional — a command attempt — which
 * selects the headless path over the TUI. `--agent`'s value is skipped so it
 * is never mistaken for the command word; the other flags take no value.
 */
export function detectSubcommand(argv: string[]): boolean {
  let skipNext = false
  for (const arg of argv) {
    if (skipNext) {
      skipNext = false
      continue
    }
    if (arg === '--agent') {
      skipNext = true
      continue
    }
    if (arg.startsWith('-')) continue
    return true
  }
  return false
}

/**
 * Extract the --agent value from the full argv; a repeat wins, like commander.
 * A value is whatever follows that is not itself a flag: `--agent --json` is
 * a missing agent, not an agent named `--json`.
 */
export function extractAgentId(argv: string[]): string | undefined {
  let agent: string | undefined
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === undefined) continue
    if (arg === '--agent') {
      const value = argv[i + 1]
      if (value !== undefined && !value.startsWith('-')) {
        agent = value
        i += 1
      }
      continue
    }
    if (arg.startsWith('--agent=')) agent = arg.slice('--agent='.length)
  }
  return agent
}

/** The explicit agent every non-interactive command names, before anything else. */
function resolveAgent(argv: string[], errCtx: ErrorContext): Agent {
  const agentId = extractAgentId(argv)
  if (agentId !== undefined) errCtx.agentId = agentId
  if (agentId === undefined) {
    throw new CcsetError('error.agentRequired', EXIT_USAGE)
  }
  const agent = findAgent(agentId)
  if (agent === undefined) {
    throw new CcsetError('error.unknownAgent', EXIT_UNKNOWN_AGENT, { id: agentId })
  }
  return agent
}

/** The declaration the command words name, with every syntax problem collected. */
function resolveDeclaration(
  agent: Agent,
  parsed: SplitArgv,
  errCtx: ErrorContext,
): CommandDeclaration {
  const commands = agent.getCommands?.() ?? []
  if (commands.length === 0) {
    throw new CcsetError('error.agentNoCommands', EXIT_UNKNOWN_COMMAND, { agent: agent.id })
  }
  if (parsed.problems.length > 0) {
    throw new OperationError('usage', parsed.problems, EXIT_USAGE)
  }
  if (parsed.command === '') {
    throw new OperationError('usage', { code: 'error.noCommand' }, EXIT_USAGE)
  }
  const decl = findCommand(commands, parsed.command, parsed.subcommand)
  if (decl === undefined) {
    throw new OperationError('unknownCommand', {
      code: 'error.unknownCommand',
      params: {
        command: `${parsed.command} ${parsed.subcommand}`.trim(),
        available: describeCommands(commands),
      },
    }, EXIT_UNKNOWN_COMMAND)
  }
  errCtx.operation = decl.id
  return decl
}

/** Execute through the agent's operation implementation. */
async function runAgentOperation(
  agent: Agent,
  req: OperationRequest,
  ctx: Ctx,
): Promise<OperationResult> {
  const op = agent.getOperation?.(req.operation, ctx)
  if (op === undefined) {
    throw new OperationError('unsupported', {
      code: 'error.unknownCommand',
      params: { command: req.operation },
    }, EXIT_UNKNOWN_COMMAND)
  }
  return runOperation(req, op)
}

function finish(useJson: boolean, result: OperationResult): never {
  if (useJson) presentJson(result)
  else presentHuman(result)
  process.exit(result.exitCode)
}

/**
 * Non-interactive command execution. Called from cli.tsx when a command word
 * is present, before the TTY guard. Runs the full parse → validate → execute →
 * present pipeline against the full original argv — so `--json` counts before
 * `--agent` too — and exits.
 */
export async function runHeadless(argv: string[], ctx: Ctx): Promise<never> {
  const useJson = argv.includes('--json')
  const errCtx: ErrorContext = {}
  try {
    const agent = resolveAgent(argv, errCtx)
    // The full original argv, so flags before --agent or the command word count.
    const parsed = splitCommandArgv(argv)
    const decl = resolveDeclaration(agent, parsed, errCtx)
    const req = buildRequest(decl, parsed, agent.id)
    errCtx.dryRun = req.dryRun
    const result = await runAgentOperation(agent, req, ctx)
    finish(useJson, result)
  } catch (err: unknown) {
    const ccsetErr = err instanceof CcsetError ? err : toCcsetError(err)
    if (useJson) presentErrorJson(ccsetErr, errCtx)
    else presentErrorHuman(ccsetErr)
    process.exit(ccsetErr.exitCode)
  }
}
