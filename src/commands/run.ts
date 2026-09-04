import { EXIT_INVALID_CONFIG, EXIT_OK, toCcsetError, type CcsetError } from '../core/errors.js'
import { resolveHome } from '../core/paths.js'
import { executeOperation } from '../operations/index.js'
import type { OperationRequest } from '../operations/types.js'
import type { Agent, Ctx } from '../types.js'
import { errorEnvelope, printEnvelope, successEnvelope } from './json.js'
import { parseCommand, type ParsedCommand } from './parser.js'
import { humanError, humanMutation, humanStatus } from './present.js'
import { secretFromEnv, secretFromStdin } from './secret.js'

/**
 * Command-mode execution: parse, read the secret if one applies, run the
 * operation through the seam, and present. The process exit status always
 * matches what the human lines and the JSON envelope report.
 */

function output(lines: string[], toStderr: boolean): void {
  const text = lines.length === 0 ? '' : `${lines.join('\n')}\n`
  if (toStderr) process.stderr.write(text)
  else process.stdout.write(text)
}

async function readSecret(source: 'env' | 'stdin' | null): Promise<OperationRequest['secret']> {
  if (source === 'stdin') return secretFromStdin()
  if (source === 'env') return secretFromEnv(process.env['CCSET_TOKEN']) ?? undefined
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
function globalsOf(argv: string[]): { agentId: string | null; json: boolean } {
  let agentId: string | null = null
  let json = false
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? ''
    if (token === '--json') {
      json = true
    } else if (token === '--agent') {
      agentId = argv[index + 1] ?? null
      index += 1
    } else if (token.startsWith('--agent=')) {
      agentId = token.slice('--agent='.length)
    }
  }
  return { agentId: agentId !== null && agentId.length > 0 ? agentId : null, json }
}

function presentFailure(parsed: ParsedCommand | undefined, err: CcsetError, argv: string[]): number {
  // --json owes its envelope on ordinary failure too, and a parse-stage
  // failure never built a ParsedCommand; the raw flags say what was asked.
  const fallback = parsed === undefined ? globalsOf(argv) : null
  if (parsed?.json === true || fallback?.json === true) {
    printEnvelope(
      errorEnvelope(err, {
        agent: parsed?.agent.id ?? fallback?.agentId ?? null,
        operation: parsed?.declaration.id ?? null,
      }),
    )
    return err.exitCode
  }
  output(humanError(err), true)
  return err.exitCode
}

export async function runCommand(argv: string[], agents: Agent[]): Promise<number> {
  let parsed: ParsedCommand | undefined
  try {
    parsed = parseCommand(argv, agents)
    const secret = await readSecret(parsed.secretSource)
    const request: OperationRequest =
      secret === undefined ? parsed.request : { ...parsed.request, secret }
    const ctx: Ctx = { home: resolveHome() }
    const result = await executeOperation(parsed.agent, ctx, request)
    return presentSuccess(parsed, result)
  } catch (err) {
    return presentFailure(parsed, toCcsetError(err), argv)
  }
}
