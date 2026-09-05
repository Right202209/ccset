import type { Ctx, FormValues, JsonObject, WriteReport } from '../../types.js'
import { readConfigFile } from '../../core/config-file.js'
import { isPlainObject } from '../../core/json-file.js'
import {
  countUnmanagedKeys,
  getPath,
  type ManagedWrite,
} from '../../core/merge.js'
import { commitOne, readPatchBase } from '../../operations/commit.js'
import {
  csvOrUndefined,
  intOrUndefined,
  jsonToText,
  textOrUndefined,
  withDefaults,
} from '../../core/values.js'
import { JsonParseError, ValidationError } from '../../core/errors.js'
import {
  PROVIDER_DEFAULTS,
  PROVIDER_ROOT,
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
import { backupsDir, launchCommand, opencodeTarget } from './paths.js'

/** One provider block inside the single config document. */
export interface ProviderRecord {
  id: string
  displayName: string
  baseUrl: string
  apiKey: string
  npm: string
  models: string[]
  unmanagedKeys: number
  /** i18n key describing why the block is unusable, when it is. */
  problemKey?: string
}

/**
 * Every provider lives in one file, so a parse failure is a property of the
 * file rather than of a provider. Modelling that here keeps the UI from having
 * to invent a per-provider error that cannot exist.
 */
export interface ProviderList {
  path: string
  exists: boolean
  parsed: boolean
  records: ProviderRecord[]
  problemKey?: string
  problemDetail?: string
}

function providerIdOf(values: FormValues): string {
  return String(values['id'] ?? '').trim()
}

function managedProviderPaths(id: string): string[][] {
  return [
    providerNamePath(id),
    providerNpmPath(id),
    providerBaseUrlPath(id),
    providerApiKeyPath(id),
    providerTimeoutPath(id),
    providerModelsPath(id),
  ]
}

/** Provider blocks are seeded from disk, plus the one guessable default. */
export function seedProvider(data: JsonObject, id: string): FormValues {
  const seed: FormValues = {
    id,
    displayName: jsonToText(getPath(data, providerNamePath(id))),
    baseUrl: jsonToText(getPath(data, providerBaseUrlPath(id))),
    apiKey: jsonToText(getPath(data, providerApiKeyPath(id))),
    npm: jsonToText(getPath(data, providerNpmPath(id))),
    models: modelIds(data, id).join(', '),
    timeout: jsonToText(getPath(data, providerTimeoutPath(id))),
  }
  return id.length === 0 ? withDefaults(seed, PROVIDER_DEFAULTS) : seed
}

function modelIds(data: JsonObject, id: string): string[] {
  const models = getPath(data, providerModelsPath(id))
  return isPlainObject(models) ? Object.keys(models).sort() : []
}

/**
 * The models map is merged per key, never written wholesale. A model already on
 * disk keeps the options ccset does not manage; a new one is added as an empty
 * object; one the user removed from the list is deleted. Writing the object
 * outright would silently discard per-model settings, which is the same data
 * loss the whole manifest exists to prevent.
 */
function modelWrites(id: string, values: FormValues, base: JsonObject): ManagedWrite[] {
  const wanted = csvOrUndefined(values['models']) ?? []
  const current = modelIds(base, id)
  const writes: ManagedWrite[] = []
  for (const modelId of wanted) {
    if (current.includes(modelId)) continue
    writes.push({ path: providerModelPath(id, modelId), value: {} })
  }
  for (const modelId of current) {
    if (wanted.includes(modelId)) continue
    writes.push({ path: providerModelPath(id, modelId), value: undefined })
  }
  return writes
}

export function emitProvider(values: FormValues, base: JsonObject): ManagedWrite[] {
  const id = providerIdOf(values)
  return [
    { path: providerNamePath(id), value: textOrUndefined(values['displayName']) },
    { path: providerNpmPath(id), value: textOrUndefined(values['npm']) },
    { path: providerBaseUrlPath(id), value: textOrUndefined(values['baseUrl']) },
    { path: providerApiKeyPath(id), value: textOrUndefined(values['apiKey']) },
    { path: providerTimeoutPath(id), value: intOrUndefined(values['timeout']) },
    ...modelWrites(id, values, base),
  ]
}

/** `startFresh` is the confirmed answer to a target that no longer parses. */
export async function saveProvider(
  ctx: Ctx,
  values: FormValues,
  startFresh = false,
): Promise<WriteReport> {
  const id = providerIdOf(values)
  const problem = validateProviderId(id)
  if (problem !== null) throw new ValidationError(problem, { name: id })
  const file = await opencodeTarget(ctx.home)
  const base = await readPatchBase(file, startFresh)
  const report = await commitOne({
    file,
    base,
    writes: emitProvider(values, base.data),
    backupsDir: backupsDir(ctx.home),
  })
  return { ...report, command: launchCommand(), activateKey: 'opencode.write.activate' }
}

function describeRecord(data: JsonObject, id: string): ProviderRecord {
  const record: ProviderRecord = {
    id,
    displayName: jsonToText(getPath(data, providerNamePath(id))),
    baseUrl: jsonToText(getPath(data, providerBaseUrlPath(id))),
    apiKey: jsonToText(getPath(data, providerApiKeyPath(id))),
    npm: jsonToText(getPath(data, providerNpmPath(id))),
    models: modelIds(data, id),
    unmanagedKeys: countUnmanagedKeys(
      { [PROVIDER_ROOT]: { [id]: asObject(getPath(data, providerPath(id))) } },
      managedProviderPaths(id),
    ),
  }
  if (record.baseUrl.length === 0) record.problemKey = 'opencode.status.noBaseUrl'
  return record
}

function asObject(value: unknown): JsonObject {
  return isPlainObject(value) ? value : {}
}

/**
 * A malformed file must never stop the screen rendering, so a parse error is
 * reported on the list rather than thrown. The target is the managed one: a
 * `.jsonc` when it exists, else the `.json`.
 */
export async function loadProviders(ctx: Ctx): Promise<ProviderList> {
  const file = await opencodeTarget(ctx.home)
  try {
    const config = await readConfigFile(file)
    const root = asObject(getPath(config.data, [PROVIDER_ROOT]))
    return {
      path: file.path,
      exists: config.exists,
      parsed: true,
      records: Object.keys(root)
        .sort()
        .map((id) => describeRecord(config.data, id)),
    }
  } catch (err) {
    return {
      path: file.path,
      exists: true,
      parsed: false,
      records: [],
      problemKey: err instanceof JsonParseError ? 'status.parseError' : 'status.readError',
      problemDetail: err instanceof JsonParseError ? err.params['position'] : undefined,
    }
  }
}
