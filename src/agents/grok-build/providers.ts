import type { Ctx, FormValues, JsonObject, WriteReport } from '../../types.js'
import { readConfigFile } from '../../core/config-file.js'
import { ConfigParseError } from '../../core/errors.js'
import { isPlainObject } from '../../core/json-file.js'
import { countUnmanagedKeys, getPath, type ManagedWrite } from '../../core/merge.js'
import { commitOne, readPatchBase } from '../../operations/commit.js'
import { jsonToText, textOrUndefined, withDefaults } from '../../core/values.js'
import { ValidationError } from '../../core/errors.js'
import {
  PROVIDER_DEFAULTS,
  PROVIDER_KEYS,
  PROVIDER_ROOT,
  providerKeyPath,
  providerPath,
  validateProviderId,
} from './manifest.js'
import { backupsDir, configFile } from './paths.js'
import { withActivation } from './result.js'

/** One `[model.<id>]` table inside the single config document. */
export interface ProviderRecord {
  id: string
  modelId: string
  baseUrl: string
  displayName: string
  apiBackend: string
  apiKey: string
  unmanagedKeys: number
  /** i18n key describing why the block is suspect, when it is. */
  problemKey?: string
}

/**
 * Every provider lives in one file, so a parse failure is a property of the
 * file rather than of a provider -- the same shape the opencode and codex
 * modules need, for the same reason.
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
  return Object.values(PROVIDER_KEYS).map((key) => providerKeyPath(id, key))
}

function asObject(value: unknown): JsonObject {
  return isPlainObject(value) ? value : {}
}

/** Provider blocks are seeded from disk; Grok's own defaults are not guessable. */
export function seedProvider(data: JsonObject, id: string): FormValues {
  const at = (key: string): string => jsonToText(getPath(data, providerKeyPath(id, key)))
  const seed: FormValues = {
    id,
    modelId: at(PROVIDER_KEYS.model),
    baseUrl: at(PROVIDER_KEYS.baseUrl),
    displayName: at(PROVIDER_KEYS.name),
    apiBackend: at(PROVIDER_KEYS.apiBackend),
    apiKey: at(PROVIDER_KEYS.apiKey),
  }
  return id.length === 0 ? withDefaults(seed, PROVIDER_DEFAULTS) : seed
}

/**
 * Writing the leaves, never the parent table, is what keeps `extra_headers`,
 * `query_params`, sampling numbers and every other unmanaged sibling of these
 * keys alive. A blank form value deletes its key: Grok resolves the credential
 * and the endpoint from what remains.
 */
export function emitProvider(values: FormValues): ManagedWrite[] {
  const id = providerIdOf(values)
  const at = (key: string): string[] => providerKeyPath(id, key)
  return [
    { path: at(PROVIDER_KEYS.model), value: textOrUndefined(values['modelId']) },
    { path: at(PROVIDER_KEYS.baseUrl), value: textOrUndefined(values['baseUrl']) },
    { path: at(PROVIDER_KEYS.name), value: textOrUndefined(values['displayName']) },
    { path: at(PROVIDER_KEYS.apiBackend), value: textOrUndefined(values['apiBackend']) },
    { path: at(PROVIDER_KEYS.apiKey), value: textOrUndefined(values['apiKey']) },
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
  const file = configFile(ctx.home)
  const base = await readPatchBase(file, startFresh)
  const report = await commitOne({
    file,
    base,
    writes: emitProvider(values),
    backupsDir: backupsDir(ctx.home),
  })
  return withActivation(report)
}

/**
 * A block without `base_url` is suspect but not necessarily broken: a block
 * whose id names a built-in model inherits that model's endpoint and only
 * overrides the fields it sets. Status and the command warnings say so instead
 * of inventing a failure Grok decides at run time.
 */
export function describeRecord(data: JsonObject, id: string): ProviderRecord {
  const at = (key: string): string => jsonToText(getPath(data, providerKeyPath(id, key)))
  const record: ProviderRecord = {
    id,
    modelId: at(PROVIDER_KEYS.model),
    baseUrl: at(PROVIDER_KEYS.baseUrl),
    displayName: at(PROVIDER_KEYS.name),
    apiBackend: at(PROVIDER_KEYS.apiBackend),
    apiKey: at(PROVIDER_KEYS.apiKey),
    unmanagedKeys: countUnmanagedKeys(
      { [PROVIDER_ROOT]: { [id]: asObject(getPath(data, providerPath(id))) } },
      managedProviderPaths(id),
    ),
  }
  if (record.baseUrl.length === 0) record.problemKey = 'grokBuild.status.noBaseUrl'
  return record
}

/**
 * A malformed file must never stop the screen rendering, so a parse error is
 * reported on the list rather than thrown.
 */
export async function loadProviders(ctx: Ctx): Promise<ProviderList> {
  const file = configFile(ctx.home)
  try {
    const loaded = await readConfigFile(file)
    const root = asObject(getPath(loaded.data, [PROVIDER_ROOT]))
    return {
      path: file.path,
      exists: loaded.exists,
      parsed: true,
      records: Object.keys(root)
        .sort()
        .map((id) => describeRecord(loaded.data, id)),
    }
  } catch (err) {
    return {
      path: file.path,
      exists: true,
      parsed: false,
      records: [],
      problemKey: err instanceof ConfigParseError ? 'status.parseErrorToml' : 'status.readError',
      problemDetail: err instanceof ConfigParseError ? err.params['position'] : undefined,
    }
  }
}
