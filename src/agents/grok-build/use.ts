import type { ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type { Finding, OperationRequest, OperationResult } from '../../operations/types.js'
import type { Ctx } from '../../types.js'
import { DEFAULT_MODEL_PATH } from './manifest.js'
import { grokOperationResult } from './result.js'
import { hasModelBlock } from './provider-commands.js'
import { backupsDir, configFile } from './paths.js'

/**
 * Grok Build's provider use over the Non-interactive seam. The switch is one
 * leaf -- `models.default` names the section id of a [model.*] block or a
 * built-in model, and Grok reads it for every new session. The TUI's /model
 * and -m override it per session, so there is no second leaf to keep in step.
 */

/**
 * The one risk a switch can warn about: an id no [model.*] block defines. It
 * may still be a built-in model id, which ccset cannot see, so the mismatch is
 * a warning rather than a refusal.
 */
function unknownModelWarning(id: string): Finding {
  return { code: 'grokBuild.warning.modelNotInSection', params: { name: id } }
}

export async function runProviderUse(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const id = request.providerId ?? ''
  const file = configFile(ctx.home)
  const base = await readPatchBase(file, request.replaceInvalid)
  const known = hasModelBlock(base.data, id)
  const writes: ManagedWrite[] = [{ path: DEFAULT_MODEL_PATH, value: id }]
  const outcome = await applyPlan(
    planTargets([{ file, base, writes, backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return grokOperationResult({
    operation: 'provider.use',
    request,
    outcome,
    providerId: id,
    warnings: base.exists && known ? [] : [unknownModelWarning(id)],
  })
}
