import { CcsetError, EXIT_UNSUPPORTED_COMMAND } from '../core/errors.js'
import type { Agent, Ctx } from '../types.js'
import type { OperationRequest, OperationResult } from './types.js'

export * from './types.js'
export {
  applyPlan,
  planTargets,
  readPatchBase,
  type ApplyOutcome,
  type ApplyOptions,
  type PlanInput,
  type WriteTarget,
} from './commit.js'

/**
 * The one public execution entry point behind the Non-interactive seam. The
 * agent's own declaration supplies the handler; this only refuses operations
 * the agent does not serve, with the exit code a script can tell apart from a
 * typo. Everything safety-relevant -- ordering, preconditions, codecs,
 * backups -- lives behind the handler, in the agent module and the commit core.
 */
export async function executeOperation(
  agent: Agent,
  ctx: Ctx,
  request: OperationRequest,
): Promise<OperationResult> {
  const declaration = agent.commands?.operations.find(
    (candidate) => candidate.id === request.operation,
  )
  if (declaration === undefined) {
    throw new CcsetError('error.unsupportedCommand', EXIT_UNSUPPORTED_COMMAND, {
      agent: agent.id,
      operation: request.operation,
    })
  }
  return declaration.run(ctx, request)
}
