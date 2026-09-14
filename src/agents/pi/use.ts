import { readConfigFile } from '../../core/config-file.js'
import { ValidationError } from '../../core/errors.js'
import type { ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type { Finding, OperationRequest, OperationResult } from '../../operations/types.js'
import type { Ctx } from '../../types.js'
import { DEFAULT_MODEL_PATH, DEFAULT_PROVIDER_PATH } from './manifest.js'
import { modelIds } from './providers.js'
import { piOperationResult } from './result.js'
import { backupsDir, modelsFile, settingsFile } from './paths.js'

/**
 * pi's provider use over the Non-interactive seam. The switch is two leaves
 * of settings.json -- pi's own startup resolution only honours a saved default
 * when defaultProvider AND defaultModel are both set (model-resolver.ts step
 * 3), so a switch that wrote only the provider would silently change nothing.
 */

export const USE_COMMAND_FIELDS = [
  { id: 'model', option: '--model', type: 'text' as const },
]

/** The provider's model ids on disk; an unreadable file is its own outcome. */
type ModelsLookup = { kind: 'unreadable' } | { kind: 'ok'; ids: string[] }

async function lookupModels(ctx: Ctx, id: string): Promise<ModelsLookup> {
  try {
    const config = await readConfigFile(modelsFile(ctx.home))
    return { kind: 'ok', ids: modelIds(config.data, id) }
  } catch {
    return { kind: 'unreadable' }
  }
}

/**
 * The model a switch points at. An explicit --model wins; otherwise the first
 * model of the provider's disk entry does. A provider entry without models is
 * the built-in-override shape, and its startup model lives in pi's own
 * catalog, which ccset does not read -- that case has to name --model.
 */
async function resolveDefaultModel(
  ctx: Ctx,
  id: string,
  requested: string | undefined,
): Promise<{ modelId: string; warning?: Finding }> {
  if (requested !== undefined && requested.trim().length > 0) {
    const modelId = requested.trim()
    const lookup = await lookupModels(ctx, id)
    const warning =
      lookup.kind === 'ok' && !lookup.ids.includes(modelId)
        ? { code: 'pi.warning.modelNotInList', params: { name: id, model: modelId } }
        : undefined
    return { modelId, warning }
  }
  const lookup = await lookupModels(ctx, id)
  const first = lookup.kind === 'ok' ? lookup.ids[0] : undefined
  if (first !== undefined) return { modelId: first }
  if (lookup.kind === 'unreadable') {
    throw new ValidationError('pi.validate.modelsUnreadable', { path: modelsFile(ctx.home).path })
  }
  throw new ValidationError('pi.validate.providerModelRequired', { name: id })
}

export async function runProviderUse(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const id = request.providerId ?? ''
  const raw = request.patch['model']
  const requested = typeof raw === 'string' ? raw : undefined
  const { modelId, warning } = await resolveDefaultModel(ctx, id, requested)
  const file = settingsFile(ctx.home)
  const base = await readPatchBase(file, request.replaceInvalid)
  const writes: ManagedWrite[] = [
    { path: DEFAULT_PROVIDER_PATH, value: id },
    { path: DEFAULT_MODEL_PATH, value: modelId },
  ]
  const outcome = await applyPlan(
    planTargets([{ file, base, writes, backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return piOperationResult({
    operation: 'provider.use',
    request,
    outcome,
    providerId: id,
    warnings: warning === undefined ? [] : [warning],
  })
}
