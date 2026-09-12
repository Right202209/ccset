import type { OperationRequest, OperationResult } from '../../operations/types.js'
import type { ApplyOutcome } from '../../operations/commit.js'
import type { WriteReport } from '../../types.js'
import { launchCommand } from './paths.js'

/**
 * The one shape every pi operation result takes, and the one way every saved
 * report is stamped. Kept beside the operations it closes: the activation line
 * is a fact about pi (it reads these files on start), so the tail lives here
 * rather than repeated per handler.
 */

export function piOperationResult(input: {
  operation: OperationResult['operation']
  request: Pick<OperationRequest, 'dryRun'>
  outcome: ApplyOutcome
  providerId?: string
  warnings?: OperationResult['warnings']
}): OperationResult {
  return {
    agent: 'pi',
    operation: input.operation,
    ...(input.providerId === undefined ? {} : { providerId: input.providerId }),
    changed: input.outcome.changed,
    dryRun: input.request.dryRun,
    targets: input.outcome.records,
    warnings: input.warnings ?? [],
    launchCommand: launchCommand(),
    launchKey: 'pi.write.activate',
  }
}

/** A saved report always carries pi's activation line, never write.activate. */
export function withActivation(
  report: Pick<WriteReport, 'path' | 'mode' | 'backupPath'>,
): WriteReport {
  return { ...report, command: launchCommand(), activateKey: 'pi.write.activate' }
}
