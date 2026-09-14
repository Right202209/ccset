import { ValidationError } from '../../core/errors.js'
import { isPlainObject } from '../../core/json-file.js'
import { getPath, type ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type { CommandFieldSpec, OperationRequest, OperationResult } from '../../operations/types.js'
import type { Ctx, JsonObject } from '../../types.js'
import { validateBaseUrl } from '../../core/validate.js'
import {
  API_ANTHROPIC_MESSAGES,
  API_GOOGLE_GENERATIVE_AI,
  API_OPENAI_COMPLETIONS,
  API_OPENAI_RESPONSES,
} from './constants.js'
import { assertModelsHaveApi, modelWrites } from './providers.js'
import { piOperationResult } from './result.js'
import {
  providerApiKeyPath,
  providerApiPath,
  providerBaseUrlPath,
  providerModelsPath,
  providerPath,
} from './manifest.js'
import { backupsDir, modelsFile } from './paths.js'

/**
 * pi's provider.set over the Non-interactive seam. The command is a Managed
 * patch: supplied fields change, omitted fields preserve the disk state, and
 * --unset removes. The TUI's template defaults (manifest.ts PROVIDER_DEFAULTS)
 * never reach this path.
 */

export const PROVIDER_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'baseUrl', option: '--base-url', type: 'text', validate: validateBaseUrl },
  {
    id: 'api',
    option: '--api',
    type: 'choice',
    choices: [
      API_OPENAI_COMPLETIONS,
      API_OPENAI_RESPONSES,
      API_ANTHROPIC_MESSAGES,
      API_GOOGLE_GENERATIVE_AI,
    ],
    unsettable: true,
  },
  { id: 'models', option: '--model', type: 'list', unsettable: true },
]

function providerFieldPath(fieldId: string, id: string): string[] | undefined {
  // Resolved through the manifest builders, so the command surface cannot name
  // a leaf the manifest does not own.
  const byId: Record<string, (pid: string) => string[]> = {
    baseUrl: providerBaseUrlPath,
    api: providerApiPath,
  }
  return byId[fieldId]?.(id)
}

function providerPatchWrites(request: OperationRequest, base: JsonObject): ManagedWrite[] {
  const id = request.providerId ?? ''
  const writes: ManagedWrite[] = []
  for (const field of PROVIDER_COMMAND_FIELDS) {
    if (field.id === 'models') continue
    const path = providerFieldPath(field.id, id)
    if (path === undefined) continue
    if (request.unsets.includes(field.id)) {
      writes.push({ path, value: undefined })
      continue
    }
    const value = request.patch[field.id]
    if (value !== undefined) writes.push({ path, value: String(value) })
  }
  if (request.unsets.includes('models')) {
    writes.push({ path: providerModelsPath(id), value: undefined })
    return writes
  }
  const models = request.patch['models']
  if (models !== undefined) {
    const listed = Array.isArray(models) ? models : [String(models)]
    const wanted = [...new Set(listed.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0))]
    writes.push(...modelWrites(id, wanted, base))
  }
  return writes
}

async function runProviderSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const id = request.providerId ?? ''
  const file = modelsFile(ctx.home)
  const base = await readPatchBase(file, request.replaceInvalid)
  const block = getPath(base.data, providerPath(id))
  if (!base.exists || !isPlainObject(block)) {
    if (typeof request.patch['baseUrl'] !== 'string') {
      throw new ValidationError('pi.validate.providerBaseUrlRequired', { name: id })
    }
    if (request.secret === undefined) {
      throw new ValidationError('pi.validate.providerTokenRequired', { name: id })
    }
  }
  const writes = providerPatchWrites(request, base.data)
  if (request.secret !== undefined) writes.push({ path: providerApiKeyPath(id), value: request.secret })
  assertModelsHaveApi(id, base.data, writes)
  const outcome = await applyPlan(
    planTargets([{ file, base, writes, backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return piOperationResult({ operation: 'provider.set', request, outcome, providerId: id })
}

export { runProviderSet }
