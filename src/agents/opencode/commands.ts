import { ValidationError } from '../../core/errors.js'
import { fileExists, isPlainObject, jsonFile } from '../../core/json-file.js'
import { getPath, type ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type {
  CommandDeclaration,
  CommandFieldSpec,
  Finding,
  OperationRequest,
  OperationResult,
} from '../../operations/types.js'
import type { Ctx, JsonObject } from '../../types.js'
import { validateBaseUrl, validateOptionalPositiveInt } from '../../core/validate.js'
import {
  GLOBAL_FIELDS,
  providerApiKeyPath,
  providerBaseUrlPath,
  providerModelPath,
  providerModelsPath,
  providerNamePath,
  providerNpmPath,
  providerPath,
  providerTimeoutPath,
  validateProviderId,
} from './manifest.js'
import { backupsDir, launchCommand, opencodeConfigPath, opencodeJsoncPath } from './paths.js'
import {
  opencodeStatusFindings,
  presentOpencodeStatus,
  readOpencodeStatus,
  type OpencodeStatusDto,
} from './status-dto.js'

/**
 * opencode's Non-interactive declarations. The one config document is the
 * target of every patch; the TUI's string coercions stay in the TUI Adapter.
 */

const GLOBAL_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'model', option: '--model', type: 'text', unsettable: true },
  { id: 'smallModel', option: '--small-model', type: 'text', unsettable: true },
  {
    id: 'share',
    option: '--share',
    type: 'choice',
    choices: ['manual', 'auto', 'disabled'],
    unsettable: true,
  },
  {
    id: 'autoupdate',
    option: '--autoupdate',
    type: 'choice',
    choices: ['true', 'false', 'notify'],
    unsettable: true,
  },
  { id: 'username', option: '--username', type: 'text', unsettable: true },
  { id: 'disabledProviders', option: '--disabled-provider', type: 'list', unsettable: true },
]

function managedPathOf(fieldId: string): string[] | undefined {
  return GLOBAL_FIELDS.find((field) => field.id === fieldId)?.path
}

/**
 * The one warning every write to opencode's config can carry: a `.jsonc`
 * beside the managed file means the save may not be the document opencode
 * reads. Status says it too; a write result saying it is what makes an
 * unattended save honest.
 */
async function jsoncWarning(ctx: Ctx): Promise<Finding[]> {
  const present = await fileExists(opencodeJsoncPath(ctx.home))
  return present ? [{ code: 'opencode.warning.jsoncPresent' }] : []
}

/** `autoupdate` is `true | false | "notify"` in the schema -- real booleans. */
function autoupdateValue(raw: string): boolean | string {
  if (raw === 'true') return true
  if (raw === 'false') return false
  return raw
}

function globalPatchWrites(request: OperationRequest): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of GLOBAL_COMMAND_FIELDS) {
    const path = managedPathOf(field.id)
    if (path === undefined) continue
    if (request.unsets.includes(field.id)) {
      writes.push({ path, value: undefined })
      continue
    }
    const value = request.patch[field.id]
    if (value === undefined) continue
    writes.push({
      path,
      value:
        field.id === 'autoupdate'
          ? autoupdateValue(String(value))
          : Array.isArray(value)
            ? value
            : String(value),
    })
  }
  return writes
}

async function runGlobalSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const target = opencodeConfigPath(ctx.home)
  const file = jsonFile(target)
  const base = await readPatchBase(file, request.replaceInvalid)
  const outcome = await applyPlan(
    planTargets([{ file, base, writes: globalPatchWrites(request), backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return {
    agent: 'opencode',
    operation: 'global.set',
    changed: outcome.changed,
    dryRun: request.dryRun,
    targets: outcome.records,
    warnings: await jsoncWarning(ctx),
    launchCommand: launchCommand(),
    launchKey: 'opencode.write.activate',
  }
}

/** Status reads the one document through the raw DTO and never writes. */
async function runStatus(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const data = await readOpencodeStatus(ctx)
  const { warnings, errors } = opencodeStatusFindings(data)
  return {
    agent: 'opencode',
    operation: 'status',
    changed: false,
    dryRun: request.dryRun,
    targets: [],
    warnings,
    errors,
    data: data as unknown as Record<string, unknown>,
  }
}

/* ---------------------------------------------------------- provider set */

const PROVIDER_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'displayName', option: '--display-name', type: 'text', unsettable: true },
  { id: 'baseUrl', option: '--base-url', type: 'text', validate: validateBaseUrl },
  { id: 'npm', option: '--npm', type: 'text', unsettable: true },
  { id: 'models', option: '--model', type: 'list', unsettable: true },
  {
    id: 'timeout',
    option: '--timeout',
    type: 'int',
    validate: validateOptionalPositiveInt,
    unsettable: true,
  },
]

/**
 * The models map merges per key, never wholesale: a model id already on disk
 * is left untouched with its unmanaged options, a new one is added as an
 * empty object, and one the user dropped is deleted. Writing the map outright
 * would silently discard per-model settings.
 */
function modelWrites(id: string, wanted: string[], base: JsonObject): ManagedWrite[] {
  const current = modelIdsOnDisk(base, id)
  const writes: ManagedWrite[] = []
  for (const modelId of wanted) {
    if (!current.includes(modelId)) writes.push({ path: providerModelPath(id, modelId), value: {} })
  }
  for (const modelId of current) {
    if (!wanted.includes(modelId)) writes.push({ path: providerModelPath(id, modelId), value: undefined })
  }
  return writes
}

function modelIdsOnDisk(base: JsonObject, id: string): string[] {
  const models = getPath(base, providerModelsPath(id))
  return isPlainObject(models) ? Object.keys(models).sort() : []
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
    if (value !== undefined) {
      writes.push({ path, value: field.id === 'timeout' ? Number(value) : String(value) })
    }
  }
  if (request.unsets.includes('models')) {
    writes.push({ path: providerModelsPath(id), value: undefined })
    return writes
  }
  const models = request.patch['models']
  if (models !== undefined) {
    const wanted = [...new Set(Array.isArray(models) ? models : [String(models)])]
    writes.push(...modelWrites(id, wanted, base))
  }
  return writes
}

function providerFieldPath(fieldId: string, id: string): string[] | undefined {
  const byId: Record<string, string[]> = {
    displayName: providerNamePath(id),
    baseUrl: providerBaseUrlPath(id),
    npm: providerNpmPath(id),
    timeout: providerTimeoutPath(id),
  }
  return byId[fieldId]
}

async function runProviderSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const id = request.providerId ?? ''
  const target = opencodeConfigPath(ctx.home)
  const file = jsonFile(target)
  const base = await readPatchBase(file, request.replaceInvalid)
  const block = getPath(base.data, providerPath(id))
  if (!base.exists || !isPlainObject(block)) {
    if (typeof request.patch['baseUrl'] !== 'string') {
      throw new ValidationError('opencode.validate.providerBaseUrlRequired', { name: id })
    }
    if (request.secret === undefined) {
      throw new ValidationError('opencode.validate.providerTokenRequired', { name: id })
    }
  }
  const writes = providerPatchWrites(request, base.data)
  if (request.secret !== undefined) writes.push({ path: providerApiKeyPath(id), value: request.secret })
  const outcome = await applyPlan(
    planTargets([{ file, base, writes, backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return {
    agent: 'opencode',
    operation: 'provider.set',
    providerId: id,
    changed: outcome.changed,
    dryRun: request.dryRun,
    targets: outcome.records,
    warnings: await jsoncWarning(ctx),
    launchCommand: launchCommand(),
    launchKey: 'opencode.write.activate',
  }
}

export const opencodeCommands: CommandDeclaration[] = [
  {
    id: 'global.set',
    fields: GLOBAL_COMMAND_FIELDS,
    patchRequired: true,
    replaceable: true,
    presentation: { successTitleKey: () => 'write.globalSaved' },
    run: runGlobalSet,
  },
  {
    id: 'provider.set',
    argument: 'providerId',
    fields: PROVIDER_COMMAND_FIELDS,
    takesSecret: true,
    replaceable: true,
    patchRequired: true,
    validateArgument: validateProviderId,
    presentation: { successTitleKey: () => 'opencode.write.providerSaved' },
    run: runProviderSet,
  },
  {
    id: 'status',
    fields: [],
    presentation: {
      successTitleKey: () => 'action.status',
      presentStatus: (data) => presentOpencodeStatus(data as unknown as OpencodeStatusDto),
    },
    run: runStatus,
  },
]
