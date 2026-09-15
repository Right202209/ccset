import { isPlainObject } from '../../core/json-file.js'
import { getPath, type ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type { CommandFieldSpec, OperationRequest, OperationResult } from '../../operations/types.js'
import type { Ctx, JsonObject } from '../../types.js'
import { validateBaseUrl } from '../../core/validate.js'
import {
  API_BACKEND_CHAT_COMPLETIONS,
  API_BACKEND_MESSAGES,
  API_BACKEND_RESPONSES,
} from './constants.js'
import { PROVIDER_KEYS, providerKeyPath } from './manifest.js'
import { grokOperationResult } from './result.js'
import { backupsDir, configFile } from './paths.js'
import {
  fromStatusData,
  grokStatusFindings,
  readGrokStatus,
  toStatusData,
} from './status-dto.js'

/**
 * Grok Build's provider.set over the Non-interactive seam. The command is a
 * Managed patch: supplied fields change, omitted fields preserve the disk
 * state, and --unset removes. The TUI's template defaults (manifest.ts
 * PROVIDER_DEFAULTS) never reach this path.
 *
 * A new block is not required to carry a base_url or a key: a block whose id
 * names a built-in model may set only the fields it overrides (Grok's
 * documented `[model.grok-4.6]` with just an `api_key`), and a custom model's
 * credential may come from `env_key`, the session token, or `XAI_API_KEY`.
 * A block that ends up with no base_url draws a warning instead, since only
 * Grok knows whether the id names a built-in.
 */

export const PROVIDER_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'modelId', option: '--model', type: 'text', unsettable: true },
  { id: 'baseUrl', option: '--base-url', type: 'text', validate: validateBaseUrl, unsettable: true },
  { id: 'displayName', option: '--name', type: 'text', unsettable: true },
  {
    id: 'apiBackend',
    option: '--api-backend',
    type: 'choice',
    choices: [API_BACKEND_CHAT_COMPLETIONS, API_BACKEND_RESPONSES, API_BACKEND_MESSAGES],
    unsettable: true,
  },
]

function providerFieldPath(fieldId: string, id: string): string[] | undefined {
  // Resolved through the manifest keys, so the command surface cannot name a
  // leaf the manifest does not own.
  const byId: Record<string, string> = {
    modelId: PROVIDER_KEYS.model,
    baseUrl: PROVIDER_KEYS.baseUrl,
    displayName: PROVIDER_KEYS.name,
    apiBackend: PROVIDER_KEYS.apiBackend,
  }
  const key = byId[fieldId]
  return key === undefined ? undefined : providerKeyPath(id, key)
}

function providerPatchWrites(request: OperationRequest, id: string): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of PROVIDER_COMMAND_FIELDS) {
    const path = providerFieldPath(field.id, id)
    if (path === undefined) continue
    if (request.unsets.includes(field.id)) {
      writes.push({ path, value: undefined })
      continue
    }
    const value = request.patch[field.id]
    if (value !== undefined) writes.push({ path, value: String(value) })
  }
  return writes
}

async function runProviderSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const id = request.providerId ?? ''
  const file = configFile(ctx.home)
  const base = await readPatchBase(file, request.replaceInvalid)
  const writes = providerPatchWrites(request, id)
  if (request.secret !== undefined) {
    writes.push({ path: providerKeyPath(id, PROVIDER_KEYS.apiKey), value: request.secret })
  }
  const outcome = await applyPlan(
    planTargets([{ file, base, writes, backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return grokOperationResult({ operation: 'provider.set', request, outcome, providerId: id })
}

/** Status reads the managed document through the raw DTO and never writes. */
async function runStatus(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const data = await readGrokStatus(ctx)
  const { warnings, errors } = grokStatusFindings(data)
  return {
    agent: 'grok-build',
    operation: 'status',
    changed: false,
    dryRun: request.dryRun,
    targets: [],
    warnings,
    errors,
    data: toStatusData(data),
  }
}

/** True when the id names a [model.*] block in the parsed config. */
export function hasModelBlock(data: JsonObject, id: string): boolean {
  const root = getPath(data, ['model'])
  return isPlainObject(root) && Object.prototype.hasOwnProperty.call(root, id)
}

export { runProviderSet, runStatus }
