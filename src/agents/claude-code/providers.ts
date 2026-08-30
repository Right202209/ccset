import type { Ctx, FormValues, JsonObject, WriteReport } from '../../types.js'
import { backupFile } from '../../core/backup.js'
import { ValidationError, JsonParseError } from '../../core/errors.js'
import {
  jsonFile,
  readJsonFile,
  readMode,
  writeJsonFileAtomic,
} from '../../core/json-file.js'
import { applyManagedWrites, countUnmanagedKeys, getPath, type ManagedWrite } from '../../core/merge.js'
import { activationCommand, listProviderFiles, providerSettingsPath } from '../../core/paths.js'
import { validateProviderName } from '../../core/validate.js'
import {
  MANAGED_PROVIDER_PATHS,
  PROVIDER_BASE_URL_PATH,
  PROVIDER_FIELDS,
  PROVIDER_MODEL_PATH,
  PROVIDER_TOKEN_PATH,
} from './manifest.js'
import { csvOrUndefined, jsonToText, textOrUndefined } from './values.js'

/** One discovered provider file, parsed or not. */
export interface ProviderRecord {
  name: string
  path: string
  command: string
  parsed: boolean
  /** Present only when parsed; free of interpretation. */
  data: JsonObject
  baseUrl: string
  model: string
  token: string
  unmanagedKeys: number
  /** i18n key describing why the file could not be used, when parsed is false. */
  problemKey?: string
  problemDetail?: string
}

/** Provider files have no template defaults: seeding is disk-only. */
export function seedProvider(data: JsonObject, name: string): FormValues {
  const seed: FormValues = { name }
  for (const field of PROVIDER_FIELDS) {
    if (field.path === undefined) continue
    seed[field.id] = jsonToText(getPath(data, field.path))
  }
  return seed
}

export function emitProvider(values: FormValues): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of PROVIDER_FIELDS) {
    if (field.path === undefined) continue
    const value =
      field.type === 'csv' ? csvOrUndefined(values[field.id]) : textOrUndefined(values[field.id])
    writes.push({ path: field.path, value })
  }
  return writes
}

/** `startFresh` is documented in saveGlobal: it is the confirmed answer to a
 * target that no longer parses, never a silent fallback. */
export async function saveProvider(
  ctx: Ctx,
  values: FormValues,
  startFresh = false,
): Promise<WriteReport> {
  const name = String(values['name'] ?? '').trim()
  const problem = validateProviderName(name)
  if (problem !== null) throw new ValidationError(problem, { name })
  const target = providerSettingsPath(ctx.home, name)
  const base = startFresh ? {} : (await readJsonFile(target)).data
  const backupPath = await backupFile(ctx.home, target)
  await writeJsonFileAtomic(jsonFile(target), applyManagedWrites(base, emitProvider(values)))
  return {
    path: target,
    mode: await readMode(target),
    backupPath,
    command: activationCommand(target),
  }
}

function emptyRecord(name: string, filePath: string): ProviderRecord {
  return {
    name,
    path: filePath,
    command: activationCommand(filePath),
    parsed: false,
    data: {},
    baseUrl: '',
    model: '',
    token: '',
    unmanagedKeys: 0,
  }
}

function describeRecord(name: string, filePath: string, data: JsonObject): ProviderRecord {
  const record = emptyRecord(name, filePath)
  record.parsed = true
  record.data = data
  record.baseUrl = jsonToText(getPath(data, PROVIDER_BASE_URL_PATH))
  record.model = jsonToText(getPath(data, PROVIDER_MODEL_PATH))
  record.token = jsonToText(getPath(data, PROVIDER_TOKEN_PATH))
  record.unmanagedKeys = countUnmanagedKeys(data, MANAGED_PROVIDER_PATHS)
  if (record.baseUrl.length === 0) record.problemKey = 'status.noBaseUrl'
  return record
}

/**
 * A single broken file must never stop the screen rendering, so a parse error
 * becomes an entry rather than an exception.
 */
async function loadProvider(name: string, filePath: string): Promise<ProviderRecord> {
  try {
    const file = await readJsonFile(filePath)
    return describeRecord(name, filePath, file.data)
  } catch (err) {
    const record = emptyRecord(name, filePath)
    record.problemKey = err instanceof JsonParseError ? 'status.parseError' : 'status.readError'
    record.problemDetail = err instanceof JsonParseError ? err.params['position'] : undefined
    return record
  }
}

export async function loadProviders(ctx: Ctx): Promise<ProviderRecord[]> {
  const refs = await listProviderFiles(ctx.home)
  return Promise.all(refs.map((ref) => loadProvider(ref.name, ref.path)))
}
