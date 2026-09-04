import { countBackups, countPartialBackups } from '../../core/backup.js'
import { JsonParseError } from '../../core/errors.js'
import { readJsonFile, readMode } from '../../core/json-file.js'
import { countUnmanagedKeys, getPath, getStringAt } from '../../core/merge.js'
import type { Finding, KeyedStatusSection } from '../../operations/types.js'
import type { JsonObject, JsonValue } from '../../types.js'
import { ENV_HTTPS_PROXY, ENV_HTTP_PROXY, GLOBAL_FIELDS, MANAGED_GLOBAL_PATHS, PROVIDER_FIELDS, PROVIDER_TOKEN_PATH } from './manifest.js'
import { backupsDir, globalSettingsPath } from './paths.js'
import { loadProviders } from './providers.js'
import { inspectState } from './state.js'

/**
 * The raw status payload: what the operation seam returns and what JSON
 * serializes. Machine-readable, secret-free (a presence flag stands in for
 * every credential), free of translated text -- the keyed presenter turns it
 * into sections for the human report, and the TUI keeps its own view.
 */

export interface ClaudeFileStatus {
  path: string
  exists: boolean
  mode?: string
  parsed: boolean
  /** Parse-failure position, present only when parsed is false. */
  position?: string
  /** Raw managed values by field id. Secrets are presence flags instead. */
  managed?: Record<string, JsonValue | undefined>
  unmanagedKeys?: number
}

export interface ClaudeProviderStatus extends ClaudeFileStatus {
  name: string
  tokenPresent?: boolean
}

export interface ClaudeStatusDto {
  global: ClaudeFileStatus
  state: {
    path: string
    exists: boolean
    mode?: string
    parsed: boolean
    onboarded?: boolean
  }
  providers: ClaudeProviderStatus[]
  backups: { path: string; count: number; partials: number }
}

/** Field ids that carry a credential; the DTO reports presence, never value. */
const SECRET_FIELD_IDS = new Set(['token'])

function managedValues(
  data: JsonObject,
  excludeSecrets: boolean,
): Record<string, JsonValue | undefined> {
  const managed: Record<string, JsonValue | undefined> = {}
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    managed[field.id] = getPath(data, field.path)
  }
  // The proxy is two env keys behind one toggle; the URL is their readable
  // representative on disk.
  managed['proxyUrl'] = getStringAt(data, ENV_HTTPS_PROXY) ?? getStringAt(data, ENV_HTTP_PROXY)
  return excludeSecrets ? withoutSecrets(managed) : managed
}

function withoutSecrets(
  managed: Record<string, JsonValue | undefined>,
): Record<string, JsonValue | undefined> {
  const safe = { ...managed }
  for (const id of SECRET_FIELD_IDS) delete safe[id]
  return safe
}

function tokenPresentIn(data: JsonObject): boolean {
  return getPath(data, PROVIDER_TOKEN_PATH) !== undefined
}

async function readFileStatus(path: string): Promise<ClaudeFileStatus> {
  try {
    const file = await readJsonFile(path)
    return {
      path,
      exists: file.exists,
      mode: file.exists ? await readMode(path) : undefined,
      parsed: true,
      managed: managedValues(file.data, false),
      unmanagedKeys: countUnmanagedKeys(file.data, MANAGED_GLOBAL_PATHS),
    }
  } catch (err) {
    // A parse failure is a reported finding; any other failure propagates.
    if (!(err instanceof JsonParseError)) throw err
    return {
      path,
      exists: true,
      mode: await readMode(path),
      parsed: false,
      position: String(err.params['position'] ?? ''),
    }
  }
}

/** Provider positions come from the record's problem detail, not a re-read. */
function toProviderStatus(record: Awaited<ReturnType<typeof loadProviders>>[number]): ClaudeProviderStatus {
  if (!record.parsed) {
    return {
      name: record.name,
      path: record.path,
      exists: true,
      parsed: false,
      position: record.problemDetail,
    }
  }
  const managed: Record<string, JsonValue | undefined> = {}
  for (const field of PROVIDER_FIELDS) {
    if (field.path === undefined) continue
    managed[field.id] = getPath(record.data, field.path)
  }
  return {
    name: record.name,
    path: record.path,
    exists: true,
    parsed: true,
    managed: withoutSecrets(managed),
    tokenPresent: tokenPresentIn(record.data),
    unmanagedKeys: record.unmanagedKeys,
  }
}

/** Parse failures become findings so the exit code can say so (exit 4). */
export function claudeStatusFindings(dto: ClaudeStatusDto): {
  warnings: Finding[]
  errors: Finding[]
} {
  const warnings: Finding[] = []
  const errors: Finding[] = []
  if (!dto.state.exists) {
    warnings.push({ code: 'claudeCode.warning.stateAbsent' })
  } else if (!dto.state.parsed) {
    errors.push({ code: 'cli.parseFailure', params: { path: dto.state.path, detail: 'unreadable' } })
  }
  if (dto.global.exists && !dto.global.parsed) {
    errors.push({ code: 'cli.parseFailure', params: { path: dto.global.path, detail: dto.global.position ?? '' } })
  }
  for (const provider of dto.providers) {
    if (provider.parsed) {
      if (provider.managed?.['baseUrl'] === undefined) {
        warnings.push({ code: 'claudeCode.warning.noBaseUrl', params: { name: provider.name } })
      }
      continue
    }
    errors.push({
      code: 'cli.parseFailure',
      params: { path: provider.path, detail: provider.position ?? '' },
    })
  }
  return { warnings, errors }
}

/** Reads everything, writes nothing. */
export async function readClaudeStatus(ctx: { home: string }): Promise<ClaudeStatusDto> {
  const [global, state, providerRecords, count, partials] = await Promise.all([
    readFileStatus(globalSettingsPath(ctx.home)),
    inspectState(ctx),
    loadProviders(ctx),
    countBackups(backupsDir(ctx.home)),
    countPartialBackups(backupsDir(ctx.home)),
  ])
  return {
    global,
    state: {
      path: state.path,
      exists: state.exists,
      mode: state.exists ? state.mode : undefined,
      parsed: state.parsed,
      onboarded: state.parsed ? state.onboarded === true : undefined,
    },
    providers: providerRecords.map(toProviderStatus),
    backups: { path: backupsDir(ctx.home), count, partials },
  }
}
