import type { Ctx, FormValues, JsonObject, JsonValue, WriteReport } from '../../types.js'
import { configFile, readConfigFile } from '../../core/config-file.js'
import { CcsetError, EXIT_RUNTIME, ConfigParseError, ValidationError } from '../../core/errors.js'
import { isPlainObject } from '../../core/json-file.js'
import { countUnmanagedKeys, getPath, type ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import { intOrUndefined, jsonToText, textOrUndefined, withDefaults } from '../../core/values.js'
import { t } from '../../i18n/index.js'
import { authProfileWrites } from './auth.js'
import { REQUIRES_OPENAI_AUTH, WIRE_API_RESPONSES } from './constants.js'
import { codexConfigFile } from './global.js'
import {
  INTEGER_FIELD_IDS,
  PROVIDER_DEFAULTS,
  PROVIDER_KEYS,
  PROVIDER_ROOT,
  providerKeyPath,
  providerPath,
  validateProviderId,
} from './manifest.js'
import { authProfilePath, backupsDir, launchCommand } from './paths.js'

/** One `[model_providers.<id>]` table inside the single config document. */
export interface ProviderRecord {
  id: string
  displayName: string
  baseUrl: string
  wireApi: string
  requiresOpenaiAuth: boolean
  unmanagedKeys: number
  /** i18n key describing why the block is unusable, when it is. */
  problemKey?: string
}

/**
 * Every provider lives in one file, so a parse failure is a property of the
 * file rather than of a provider -- the same shape the opencode module needs,
 * for the same reason.
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

/**
 * The block is seeded from config.toml; the key is not in that file at all, so
 * the caller reads it from the provider's auth sidecar and passes it in.
 */
export function seedProvider(data: JsonObject, id: string, apiKey: string): FormValues {
  const at = (key: string): string => jsonToText(getPath(data, providerKeyPath(id, key)))
  const seed: FormValues = {
    id,
    apiKey,
    displayName: at(PROVIDER_KEYS.name),
    baseUrl: at(PROVIDER_KEYS.baseUrl),
    requestMaxRetries: at(PROVIDER_KEYS.requestMaxRetries),
    streamMaxRetries: at(PROVIDER_KEYS.streamMaxRetries),
    streamIdleTimeoutMs: at(PROVIDER_KEYS.streamIdleTimeoutMs),
  }
  return id.length === 0 ? withDefaults(seed, PROVIDER_DEFAULTS) : seed
}

function optional(fieldId: string, values: FormValues): JsonValue | undefined {
  if (INTEGER_FIELD_IDS.has(fieldId)) return intOrUndefined(values[fieldId])
  return textOrUndefined(values[fieldId])
}

/**
 * `wire_api` and `requires_openai_auth` are written from constants rather than
 * from a form field. The first has one legal value as of Codex v0.152.0; the
 * second is what makes Codex consult auth.json for this provider at all, so it
 * is re-asserted on every save rather than left to whatever is on disk.
 */
export function emitProvider(values: FormValues): ManagedWrite[] {
  const id = providerIdOf(values)
  const at = (key: string): string[] => providerKeyPath(id, key)
  return [
    { path: at(PROVIDER_KEYS.name), value: textOrUndefined(values['displayName']) },
    { path: at(PROVIDER_KEYS.baseUrl), value: textOrUndefined(values['baseUrl']) },
    { path: at(PROVIDER_KEYS.wireApi), value: WIRE_API_RESPONSES },
    { path: at(PROVIDER_KEYS.requiresOpenaiAuth), value: REQUIRES_OPENAI_AUTH },
    { path: at(PROVIDER_KEYS.requestMaxRetries), value: optional('requestMaxRetries', values) },
    { path: at(PROVIDER_KEYS.streamMaxRetries), value: optional('streamMaxRetries', values) },
    {
      path: at(PROVIDER_KEYS.streamIdleTimeoutMs),
      value: optional('streamIdleTimeoutMs', values),
    },
  ]
}

/**
 * Two files, in this order. config.toml carries no credential, so a failure
 * after it leaves a provider block the user can simply save again; writing the
 * sidecar first would risk leaving a key on disk for a provider that does not
 * exist. `startFresh` is the confirmed answer to a config.toml that no longer
 * parses -- it never applies to the sidecar, which ccset owns outright.
 */
export async function saveProvider(
  ctx: Ctx,
  values: FormValues,
  startFresh = false,
): Promise<WriteReport> {
  const id = providerIdOf(values)
  const problem = validateProviderId(id)
  if (problem !== null) throw new ValidationError(problem, { name: id })
  const file = codexConfigFile(ctx.home)
  const authFile = configFile(authProfilePath(ctx.home, id), 'json')
  const records = (
    await applyPlan(
      planTargets([
        {
          file,
          base: await readPatchBase(file, startFresh),
          writes: emitProvider(values),
          backupsDir: backupsDir(ctx.home),
        },
        {
          file: authFile,
          base: await readConfigFile(authFile),
          writes: authProfileWrites(String(values['apiKey'] ?? '')),
          backupsDir: backupsDir(ctx.home),
        },
      ]),
      { dryRun: false, skipUnchanged: false },
    )
  ).records
  const config = records[0]
  const auth = records[1]
  if (config === undefined || auth === undefined) {
    throw new CcsetError('error.unexpected', EXIT_RUNTIME, { detail: 'a target was not planned' })
  }
  return {
    path: file.path,
    mode: config.mode,
    backupPath: config.backupPath,
    command: launchCommand(),
    activateKey: 'codex.write.activate',
    notes: [t('codex.write.authProfile', { path: auth.path })],
  }
}

function describeRecord(data: JsonObject, id: string): ProviderRecord {
  const at = (key: string): string => jsonToText(getPath(data, providerKeyPath(id, key)))
  const ambient = getPath(data, providerKeyPath(id, PROVIDER_KEYS.requiresOpenaiAuth))
  const record: ProviderRecord = {
    id,
    displayName: at(PROVIDER_KEYS.name),
    baseUrl: at(PROVIDER_KEYS.baseUrl),
    wireApi: at(PROVIDER_KEYS.wireApi),
    requiresOpenaiAuth: ambient === true,
    unmanagedKeys: countUnmanagedKeys(
      { [PROVIDER_ROOT]: { [id]: asObject(getPath(data, providerPath(id))) } },
      managedProviderPaths(id),
    ),
  }
  if (record.baseUrl.length === 0) record.problemKey = 'codex.status.noBaseUrl'
  else if (!record.requiresOpenaiAuth) record.problemKey = 'codex.status.noAmbientAuth'
  return record
}

/**
 * A malformed file must never stop the screen rendering, so a parse error is
 * reported on the list rather than thrown.
 */
export async function loadProviders(ctx: Ctx): Promise<ProviderList> {
  const file = codexConfigFile(ctx.home)
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
