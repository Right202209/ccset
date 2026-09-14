import type { Ctx, FormValues, JsonObject, JsonValue, WriteReport } from '../../types.js'
import { readConfigFile } from '../../core/config-file.js'
import { isPlainObject } from '../../core/json-file.js'
import {
  applyManagedWrites,
  countUnmanagedKeys,
  getPath,
  type ManagedWrite,
} from '../../core/merge.js'
import { commitOne, readPatchBase } from '../../operations/commit.js'
import { csvOrUndefined, jsonToText, textOrUndefined, withDefaults } from '../../core/values.js'
import { JsonParseError, ValidationError } from '../../core/errors.js'
import {
  PROVIDER_DEFAULTS,
  PROVIDER_ROOT,
  providerApiKeyPath,
  providerApiPath,
  providerBaseUrlPath,
  providerModelsPath,
  providerPath,
  validateProviderId,
} from './manifest.js'
import { backupsDir, modelsFile } from './paths.js'
import { withActivation } from './result.js'

/** One provider block inside the models.json document. */
export interface ProviderRecord {
  id: string
  baseUrl: string
  api: string
  apiKey: string
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
    providerBaseUrlPath(id),
    providerApiPath(id),
    providerApiKeyPath(id),
    providerModelsPath(id),
  ]
}

/**
 * The model id a disk member carries. Members without a usable string `id`
 * are not addressable by the id contract below; pi's own schema rejects them,
 * and only a hand edit can have produced one.
 */
export function memberIdOf(member: JsonValue): string {
  return isPlainObject(member) && typeof member['id'] === 'string' ? member['id'] : ''
}

export function modelIds(data: JsonObject, id: string): string[] {
  const models = getPath(data, providerModelsPath(id))
  if (!Array.isArray(models)) return []
  return models.map(memberIdOf).filter((candidate) => candidate.length > 0)
}

/** Provider blocks are seeded from disk, plus the one guessable default. */
export function seedProvider(data: JsonObject, id: string): FormValues {
  const seed: FormValues = {
    id,
    baseUrl: jsonToText(getPath(data, providerBaseUrlPath(id))),
    api: jsonToText(getPath(data, providerApiPath(id))),
    apiKey: jsonToText(getPath(data, providerApiKeyPath(id))),
    models: modelIds(data, id).join(', '),
  }
  return id.length === 0 ? withDefaults(seed, PROVIDER_DEFAULTS) : seed
}

/**
 * pi's models are an ARRAY of members keyed by their `id`, so the managed
 * collection is merged per member and materialised from the disk state at
 * save time: a member already on disk keeps every field ccset does not manage
 * (cost, compat, headers, samplingParams, ...), a new id is appended as
 * `{ id }`, and one the user dropped is removed. Writing the array outright
 * from the form would silently discard per-model settings, which is the same
 * data loss the whole manifest exists to prevent.
 *
 * Members without a usable `id` are passed through where they sit: nothing in
 * the form's id vocabulary can address them, and deleting unaddressable user
 * data is not a side effect a save may have.
 */
function mergedModels(disk: JsonValue[], wanted: string[]): JsonValue[] {
  const wantedSet = new Set(wanted)
  const merged: JsonValue[] = []
  const present = new Set<string>()
  for (const member of disk) {
    const memberId = memberIdOf(member)
    if (memberId.length > 0 && !wantedSet.has(memberId)) continue
    if (memberId.length > 0) present.add(memberId)
    merged.push(member)
  }
  for (const modelId of wanted) {
    if (!present.has(modelId)) merged.push({ id: modelId })
  }
  return merged
}

/**
 * The one models write, shared by the TUI form and the command patch. No-op
 * when the disk array already matches (an unchanged save must not rewrite the
 * span, so unmanaged member formatting survives byte for byte).
 */
export function modelWrites(id: string, wanted: string[], base: JsonObject): ManagedWrite[] {
  const disk = getPath(base, providerModelsPath(id))
  if (!Array.isArray(disk)) {
    if (wanted.length === 0) return []
    return [{ path: providerModelsPath(id), value: wanted.map((modelId) => ({ id: modelId })) }]
  }
  const merged = mergedModels(disk, wanted)
  if (JSON.stringify(merged) === JSON.stringify(disk)) return []
  return [{ path: providerModelsPath(id), value: merged }]
}

export function emitProvider(values: FormValues, base: JsonObject): ManagedWrite[] {
  const id = providerIdOf(values)
  const wanted = csvOrUndefined(values['models']) ?? []
  return [
    { path: providerBaseUrlPath(id), value: textOrUndefined(values['baseUrl']) },
    { path: providerApiPath(id), value: textOrUndefined(values['api']) },
    { path: providerApiKeyPath(id), value: textOrUndefined(values['apiKey']) },
    ...modelWrites(id, wanted, base),
  ]
}

function samePath(left: string[], right: string[]): boolean {
  return left.join('\u0000') === right.join('\u0000')
}

/**
 * pi needs a wire protocol wherever the block serves its own models
 * (models.md: "non-built-in provider configs need baseUrl and an api value").
 * A block without models is the documented built-in-override shape and needs
 * nothing more. The check runs against the complete proposal -- a value
 * already on disk satisfies it, deleting the last api value while keeping
 * models does not.
 */
export function assertModelsHaveApi(id: string, base: JsonObject, writes: ManagedWrite[]): void {
  const modelsWrite = writes.find(
    (write) => Array.isArray(write.value) && samePath(write.path, providerModelsPath(id)),
  )
  if (modelsWrite === undefined || (modelsWrite.value as JsonValue[]).length === 0) return
  const proposal = applyManagedWrites(base, writes)
  if (getPath(proposal, providerApiPath(id)) !== undefined) return
  throw new ValidationError('pi.validate.apiRequired', { name: id })
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
  const file = modelsFile(ctx.home)
  const base = await readPatchBase(file, startFresh)
  const writes = emitProvider(values, base.data)
  assertModelsHaveApi(id, base.data, writes)
  const report = await commitOne({
    file,
    base,
    writes,
    backupsDir: backupsDir(ctx.home),
  })
  return withActivation(report)
}

function describeRecord(data: JsonObject, id: string): ProviderRecord {
  const record: ProviderRecord = {
    id,
    baseUrl: jsonToText(getPath(data, providerBaseUrlPath(id))),
    api: jsonToText(getPath(data, providerApiPath(id))),
    apiKey: jsonToText(getPath(data, providerApiKeyPath(id))),
    models: modelIds(data, id),
    unmanagedKeys: countUnmanagedKeys(
      { [PROVIDER_ROOT]: { [id]: asObject(getPath(data, providerPath(id))) } },
      managedProviderPaths(id),
    ),
  }
  if (record.baseUrl.length === 0) record.problemKey = 'pi.status.noBaseUrl'
  return record
}

function asObject(value: unknown): JsonObject {
  return isPlainObject(value) ? value : {}
}

/**
 * A malformed file must never stop the screen rendering, so a parse error is
 * reported on the list rather than thrown.
 */
export async function loadProviders(ctx: Ctx): Promise<ProviderList> {
  const file = modelsFile(ctx.home)
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
