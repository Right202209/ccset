import { CcsetError, EXIT_INVALID_CONFIG, EXIT_OK, EXIT_USAGE, toCcsetError } from '../core/errors.js'
import { executeOperation } from '../operations/index.js'
import type { OperationRequest } from '../operations/types.js'
import type { Agent, Ctx } from '../types.js'
import { errorEnvelope, printEnvelope, successEnvelope } from './json.js'
import { parseCommand, type ParsedCommand } from './parser.js'
import { scanGlobals } from './globals.js'
import { humanError, humanMutation, humanStatus } from './present.js'
import { secretFromEnv, secretFromStdin } from './secret.js'
import { sanitizeForTerminal } from '../core/terminal-text.js'
import { explicitSelection, selectCommandAgent } from './selection.js'
import { expandPreset, listPresets, presetNextCommand } from './presets.js'
import { promptSecret } from './prompt-secret.js'
import { launchSession } from './launch.js'

/**
 * Command-mode execution: parse, read the secret if one applies, run the
 * operation through the seam, and present. The process exit status always
 * matches what the human lines and the JSON envelope report.
 */

function output(lines: string[], toStderr: boolean): void {
  const text = lines.length === 0 ? '' : `${lines.map(sanitizeForTerminal).join('\n')}\n`
  if (toStderr) process.stderr.write(text)
  else process.stdout.write(text)
}

async function readSecret(
  source: 'env' | 'stdin' | null,
  tokenEnv: string | undefined,
): Promise<OperationRequest['secret']> {
  if (source === 'stdin') return secretFromStdin()
  if (source === 'env') return secretFromEnv(tokenEnv) ?? undefined
  return undefined
}

function presentSuccess(parsed: ParsedCommand, result: Awaited<ReturnType<typeof executeOperation>>): number {
  const failing = (result.errors?.length ?? 0) > 0
  const exitCode = failing ? EXIT_INVALID_CONFIG : EXIT_OK
  if (parsed.json) {
    printEnvelope(successEnvelope(result, exitCode))
    return exitCode
  }
  const presentation = parsed.declaration.presentation
  const sections = presentation?.presentStatus?.(result.data ?? {})
  const lines =
    sections !== undefined
      ? humanStatus(result, sections)
      : humanMutation(result, presentation?.successTitleKey(result))
  output(lines, false)
  return exitCode
}

/**
 * Best-effort context for the failure envelope when parsing never completed,
 * so `--json` can honor its contract even on a usage error.
 */
function globalsOf(argv: string[], agents: Agent[]): { agentId: string | null; json: boolean } {
  const scan = scanGlobals(argv)
  const known = agents.find((agent) => agent.id === scan.agentId)
  const agentId = scan.agentId === null ? null : known?.id ?? '[redacted]'
  return { agentId, json: scan.json }
}

function presentFailure(parsed: ParsedCommand | undefined, err: CcsetError, context: { argv: string[]; agents: Agent[] }): number {
  // --json owes its envelope on ordinary failure too, and a parse-stage
  // failure never built a ParsedCommand; the parser tags the declaration it
  // had already matched, and the raw flags cover the earlier stages.
  const fallback = parsed === undefined ? globalsOf(context.argv, context.agents) : null
  if (parsed?.json === true || fallback?.json === true) {
    const fallbackAgent = err.messageKey === 'error.unknownAgent' ? '[redacted]' : fallback?.agentId ?? null
    printEnvelope(
      errorEnvelope(err, {
        agent: parsed?.agent.id ?? err.command?.agent ?? fallbackAgent,
        operation: parsed?.declaration.id ?? err.command?.operation ?? null,
      }),
    )
    return err.exitCode
  }
  output(humanError(err), true)
  return err.exitCode
}

/**
 * Command-mode execution: parse, read the secret if one applies, run the
 * operation through the seam, and present. The process exit status always
 * matches what the human lines and the JSON envelope report. `tokenEnv` is
 * the boundary's CCSET_TOKEN read; only its presence reaches the parser.
 */
export async function runCommand(
  argv: string[],
  agents: Agent[],
  options: RunCommandOptions,
): Promise<number> {
  let parsed: ParsedCommand | undefined
  try {
    argv = explicitSelection(argv, agents, options.agentEnv)
    if (listPresets(argv)) return EXIT_OK
    const ctx: Ctx = { home: options.home }
    argv = await selectCommandAgent(argv, agents, { ctx, interactive: options.interactive })
    const expansion = expandPreset(argv, agents)
    parsed = parseCommand(expansion.argv, agents, options.tokenEnv)
    const secret = await commandSecret(parsed, options, expansion.target !== undefined)
    const request: OperationRequest =
      secret === undefined ? parsed.request : { ...parsed.request, secret }
    const result = await executeOperation(parsed.agent, ctx, request)
    result.nextCommand = presetNextCommand(parsed.agent.id, expansion)
    if (request.operation === 'provider.run' && !request.dryRun) {
      return await launchSession(result, parsed.launchArgs)
    }
    return presentSuccess(parsed, result)
  } catch (err) {
    return presentFailure(parsed, toCcsetError(err), { argv, agents })
  }
}

interface RunCommandOptions {
  tokenEnv?: string
  agentEnv?: string
  home: string
  interactive: boolean
}

async function commandSecret(parsed: ParsedCommand, options: RunCommandOptions, preset: boolean) {
  const secret = await readSecret(parsed.secretSource, options.tokenEnv)
  if (!preset || secret !== undefined) return secret
  if (!options.interactive || parsed.json || parsed.request.dryRun) {
    throw new CcsetError('cli.preset.secretRequired', EXIT_USAGE)
  }
  return promptSecret()
}
