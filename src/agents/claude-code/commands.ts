import { ValidationError } from '../../core/errors.js'
import { jsonFile } from '../../core/json-file.js'
import { getStringAt, type ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type {
  CommandDeclaration,
  CommandFieldSpec,
  OperationRequest,
  OperationResult,
} from '../../operations/types.js'
import type { Ctx, JsonObject } from '../../types.js'
import { validateOptionalPositiveInt, validateOptionalUrl } from '../../core/validate.js'
import { ENV_HTTPS_PROXY, ENV_HTTP_PROXY, GLOBAL_FIELDS } from './manifest.js'
import { SWITCH_OFF, SWITCH_ON } from './constants.js'
import { backupsDir, globalSettingsPath } from './paths.js'

/**
 * The agent's Non-interactive declarations. Field ids here are stable script
 * contracts; the TUI's FormValues stay in the TUI Adapter, and the mapping
 * from these ids to managed keys lives beside the manifest they both cite.
 */

const SWITCH_VALUES = ['on', 'off']

const GLOBAL_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'proxy', option: '--proxy', type: 'boolean' },
  {
    id: 'proxyUrl',
    option: '--proxy-url',
    type: 'text',
    validate: validateOptionalUrl,
    unsettable: true,
  },
  {
    id: 'disableNonessentialTraffic',
    option: '--disable-nonessential-traffic',
    type: 'choice',
    choices: SWITCH_VALUES,
    unsettable: true,
  },
  {
    id: 'attributionHeader',
    option: '--attribution-header',
    type: 'choice',
    choices: SWITCH_VALUES,
    unsettable: true,
  },
  {
    id: 'disableInstallationChecks',
    option: '--disable-installation-checks',
    type: 'choice',
    choices: SWITCH_VALUES,
    unsettable: true,
  },
  {
    id: 'enableToolSearch',
    option: '--enable-tool-search',
    type: 'choice',
    choices: SWITCH_VALUES,
    unsettable: true,
  },
  {
    id: 'cleanupPeriodDays',
    option: '--cleanup-period-days',
    type: 'int',
    validate: validateOptionalPositiveInt,
    unsettable: true,
  },
  { id: 'model', option: '--model', type: 'text', unsettable: true },
]

function managedPathOf(fieldId: string): string[] | undefined {
  return GLOBAL_FIELDS.find((field) => field.id === fieldId)?.path
}

function conflict(messageKey: string): never {
  throw new ValidationError(messageKey)
}

/**
 * The proxy is two keys behind one toggle, as on the TUI form: on sets both,
 * off deletes both, and neither may contradict the URL the same patch carries.
 * With no URL supplied, the disk's own value is kept -- a toggle without a
 * destination is refused rather than guessed.
 */
function proxyWrites(request: OperationRequest, base: JsonObject): ManagedWrite[] {
  const proxy = request.patch['proxy']
  const url = request.patch['proxyUrl']
  const unsetUrl = request.unsets.includes('proxyUrl')
  if (proxy === false && url !== undefined) conflict('claudeCode.validate.proxyConflict')
  if (proxy === true && unsetUrl) conflict('claudeCode.validate.proxyConflict')
  if (proxy === undefined && url === undefined && !unsetUrl) return []
  if (proxy === false || unsetUrl) {
    return [
      { path: ENV_HTTPS_PROXY, value: undefined },
      { path: ENV_HTTP_PROXY, value: undefined },
    ]
  }
  const diskUrl = getStringAt(base, ENV_HTTPS_PROXY) ?? getStringAt(base, ENV_HTTP_PROXY)
  const value = typeof url === 'string' ? url : diskUrl
  if (value === undefined) conflict('claudeCode.validate.proxyNeedsUrl')
  return [
    { path: ENV_HTTPS_PROXY, value },
    { path: ENV_HTTP_PROXY, value },
  ]
}

function switchWrites(request: OperationRequest): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of GLOBAL_COMMAND_FIELDS) {
    if (field.type !== 'choice') continue
    const path = managedPathOf(field.id)
    if (path === undefined) continue
    if (request.unsets.includes(field.id)) {
      writes.push({ path, value: undefined })
      continue
    }
    const value = request.patch[field.id]
    if (value !== undefined) writes.push({ path, value: value === 'on' ? SWITCH_ON : SWITCH_OFF })
  }
  return writes
}

function fieldWrites(request: OperationRequest, id: string): ManagedWrite[] {
  const path = managedPathOf(id)
  if (path === undefined) return []
  if (request.unsets.includes(id)) return [{ path, value: undefined }]
  const value = request.patch[id]
  return value === undefined ? [] : [{ path, value: typeof value === 'number' ? value : String(value) }]
}

/** Maps the normalized patch onto managed keys. Omitted fields keep disk values. */
function globalPatchWrites(request: OperationRequest, base: JsonObject): ManagedWrite[] {
  return [
    ...proxyWrites(request, base),
    ...switchWrites(request),
    ...fieldWrites(request, 'cleanupPeriodDays'),
    ...fieldWrites(request, 'model'),
  ]
}

async function runGlobalSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const target = globalSettingsPath(ctx.home)
  const file = jsonFile(target)
  const base = await readPatchBase(file, request.replaceInvalid)
  const writes = globalPatchWrites(request, base.data)
  const outcome = await applyPlan(
    planTargets([{ file, base, writes, backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return {
    agent: 'claude-code',
    operation: 'global.set',
    changed: outcome.changed,
    dryRun: request.dryRun,
    targets: outcome.records,
    warnings: [],
  }
}

export const claudeCodeCommands: CommandDeclaration[] = [
  {
    id: 'global.set',
    fields: GLOBAL_COMMAND_FIELDS,
    patchRequired: true,
    replaceable: true,
    presentation: { successTitleKey: () => 'write.globalSaved' },
    run: runGlobalSet,
  },
]
