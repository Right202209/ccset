import { ValidationError } from '../../core/errors.js'
import { jsonFile } from '../../core/json-file.js'
import type { ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type { CommandFieldSpec, OperationRequest, OperationResult, Secret } from '../../operations/types.js'
import type { Ctx } from '../../types.js'
import { validateBaseUrl } from '../../core/validate.js'
import { PROVIDER_BASE_URL_PATH, PROVIDER_FIELDS, PROVIDER_TOKEN_PATH } from './manifest.js'
import { activationCommand, backupsDir, providerSettingsPath } from './paths.js'

/**
 * The provider-set operation for Claude Code: one provider file per id,
 * patched through the shared seam, with the token coming only from the
 * request's Secret.
 */

/* ---------------------------------------------------------- provider set */

export const PROVIDER_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'baseUrl', option: '--base-url', type: 'text', validate: validateBaseUrl },
  { id: 'model', option: '--model', type: 'text', unsettable: true },
  { id: 'fallbackModel', option: '--fallback-model', type: 'list', unsettable: true },
  { id: 'defaultOpusModel', option: '--default-opus-model', type: 'text', unsettable: true },
  { id: 'defaultSonnetModel', option: '--default-sonnet-model', type: 'text', unsettable: true },
  { id: 'defaultHaikuModel', option: '--default-haiku-model', type: 'text', unsettable: true },
]

function providerManagedPathOf(fieldId: string): string[] | undefined {
  return PROVIDER_FIELDS.find((field) => field.id === fieldId)?.path
}

/**
 * The token comes only from the request's secret -- CCSET_TOKEN or stdin,
 * never an option -- and lands in this provider's file alone. It is never
 * unsettable; a rotated token replaces it, deletion is not a thing.
 */
function providerPatchWrites(request: OperationRequest, secret: Secret | undefined): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  const baseUrl = request.patch['baseUrl']
  if (typeof baseUrl === 'string') writes.push({ path: PROVIDER_BASE_URL_PATH, value: baseUrl })
  if (secret !== undefined) writes.push({ path: PROVIDER_TOKEN_PATH, value: secret })
  for (const field of PROVIDER_COMMAND_FIELDS) {
    if (field.id === 'baseUrl') continue
    const path = providerManagedPathOf(field.id)
    if (path === undefined) continue
    if (request.unsets.includes(field.id)) {
      writes.push({ path, value: undefined })
      continue
    }
    const value = request.patch[field.id]
    if (value !== undefined) {
      writes.push({ path, value: Array.isArray(value) ? value : String(value) })
    }
  }
  return writes
}

export async function runProviderSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const id = request.providerId ?? ''
  const target = providerSettingsPath(ctx.home, id)
  const file = jsonFile(target)
  const base = await readPatchBase(file, request.replaceInvalid)
  if (!base.exists && typeof request.patch['baseUrl'] !== 'string') {
    throw new ValidationError('claudeCode.validate.providerBaseUrlRequired', { name: id })
  }
  if (!base.exists && request.secret === undefined) {
    throw new ValidationError('claudeCode.validate.providerTokenRequired', { name: id })
  }
  const outcome = await applyPlan(
    planTargets([
      {
        file,
        base,
        writes: providerPatchWrites(request, request.secret),
        backupsDir: backupsDir(ctx.home),
      },
    ]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return {
    agent: 'claude-code',
    operation: 'provider.set',
    providerId: id,
    changed: outcome.changed,
    dryRun: request.dryRun,
    targets: outcome.records,
    warnings: [],
    launchCommand: activationCommand(target),
  }
}
