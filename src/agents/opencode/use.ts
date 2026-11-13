import { ValidationError } from '../../core/errors.js'
import { isPlainObject } from '../../core/json-file.js'
import { getPath } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type { CommandDeclaration, OperationRequest, OperationResult } from '../../operations/types.js'
import type { Ctx, JsonObject } from '../../types.js'
import { GLOBAL_MODEL_PATH, providerPath, providerModelsPath, validateProviderId, validateModelId } from './manifest.js'
import { backupsDir, launchCommand, opencodeTarget } from './paths.js'

function selectedModel(data: JsonObject, request: OperationRequest): string {
  const id = request.providerId ?? ''
  if (!isPlainObject(getPath(data, providerPath(id)))) {
    throw new ValidationError('opencode.validate.providerMissing', { name: id })
  }
  const disabled = getPath(data, ['disabled_providers'])
  const enabled = getPath(data, ['enabled_providers'])
  if ((Array.isArray(disabled) && disabled.includes(id)) || (Array.isArray(enabled) && !enabled.includes(id))) {
    throw new ValidationError('opencode.validate.providerDisabled', { name: id })
  }
  const models = getPath(data, providerModelsPath(id))
  const ids = isPlainObject(models) ? Object.keys(models) : []
  const model = request.patch['model'] ?? ids[0]
  if (typeof model !== 'string' || model.length === 0 || !ids.includes(model)) {
    throw new ValidationError('opencode.validate.useModelRequired', { name: id })
  }
  return `${id}/${model}`
}

async function runProviderUse(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const file = await opencodeTarget(ctx.home)
  const base = await readPatchBase(file, false)
  const model = selectedModel(base.data, request)
  const outcome = await applyPlan(planTargets([{
    file, base, writes: [{ path: GLOBAL_MODEL_PATH, value: model }], backupsDir: backupsDir(ctx.home),
  }]), { dryRun: request.dryRun, skipUnchanged: true })
  return {
    agent: 'opencode', operation: 'provider.use', providerId: request.providerId,
    changed: outcome.changed, dryRun: request.dryRun, targets: outcome.records, warnings: [],
    activation: 'next-start', launchCommand: launchCommand(), launchKey: 'opencode.write.activate',
  }
}

export const opencodeUse: CommandDeclaration = {
  id: 'provider.use', argument: 'providerId', dryRunnable: true,
  fields: [{ id: 'model', option: '--model', type: 'text', validate: validateModelId }],
  validateArgument: validateProviderId,
  presentation: { successTitleKey: () => 'opencode.write.switched' },
  run: runProviderUse,
}
