import type { CcsetError, PartialCommitError } from '../core/errors.js'
import type { Finding, OperationResult, TargetRecord } from '../operations/types.js'

/**
 * The one machine-readable envelope, printed on stdout for success and for
 * ordinary failure alike. Additive by rule: schemaVersion first, and every
 * code is a stable identifier no locale can reword.
 */

export interface CommandEnvelope {
  schemaVersion: 1
  agent: string | null
  operation: string | null
  ok: boolean
  exitCode: number
  changed?: boolean
  dryRun?: boolean
  targets?: TargetRecord[]
  warnings?: Finding[]
  errors?: Finding[]
  data?: unknown
  partial?: string[]
  launchCommand?: string
  error?: { code: string; params: Record<string, string> }
}

export function successEnvelope(result: OperationResult, exitCode: number): CommandEnvelope {
  return {
    schemaVersion: 1,
    agent: result.agent,
    operation: result.operation,
    ok: (result.errors?.length ?? 0) === 0,
    exitCode,
    changed: result.changed,
    dryRun: result.dryRun,
    targets: result.targets,
    warnings: result.warnings,
    errors: result.errors,
    data: result.data,
    partial: result.partial,
    launchCommand: result.launchCommand,
  }
}

export function errorEnvelope(
  err: CcsetError,
  context: { agent: string | null; operation: string | null },
): CommandEnvelope {
  const partial = err as PartialCommitError
  return {
    schemaVersion: 1,
    agent: context.agent,
    operation: context.operation,
    ok: false,
    exitCode: err.exitCode,
    targets: partial.committed,
    partial: partial.committed?.map((record) => record.path),
    error: { code: err.messageKey, params: err.params },
  }
}

export function printEnvelope(envelope: CommandEnvelope): void {
  process.stdout.write(`${JSON.stringify(envelope)}\n`)
}
