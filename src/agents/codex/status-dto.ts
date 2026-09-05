import { countBackups, countPartialBackups } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { TomlParseError } from '../../core/errors.js'
import { readMode } from '../../core/json-file.js'
import { countUnmanagedKeys, getPath } from '../../core/merge.js'
import type { Finding, KeyedStatusSection } from '../../operations/types.js'
import type { BackupsSummary } from '../../operations/status-sections.js'
import type { JsonObject, JsonValue } from '../../types.js'
import { keyringInUseIn, loadAuthState, type AuthState } from './auth.js'
import { codexConfigFile } from './global.js'
import { GLOBAL_FIELDS, MANAGED_GLOBAL_PATHS } from './manifest.js'
import { loadProviders, type ProviderRecord } from './providers.js'
import { backupsDir, codexConfigPath, codexHomeOverride } from './paths.js'

/**
 * The raw status payload for Codex, secret-free and machine-readable: the one
 * TOML document, the provider tables inside it, the live credential and the
 * saved profiles as presence flags, and the two findings that change what a
 * write is worth (keyring store, CODEX_HOME). The TUI keeps its own translated
 * view of the same loaders; this DTO is what the operation seam and JSON
 * output carry.
 */

export interface CodexConfigStatus {
  path: string
  exists: boolean
  mode?: string
  parsed: boolean
  position?: string
  managed?: Record<string, JsonValue | undefined>
  unmanagedKeys?: number
}

export interface CodexProviderStatus {
  id: string
  displayName: string
  baseUrl: string
  wireApi: string
  requiresOpenaiAuth: boolean
  unmanagedKeys: number
  noBaseUrl: boolean
  noAmbientAuth: boolean
}

export interface CodexAuthStatus {
  path: string
  exists: boolean
  mode?: string
  readable: boolean
  authMode?: string
  apiKeyPresent: boolean
  activeName: string | null
}

export interface CodexProfileStatus {
  name: string
  path: string
  readable: boolean
  authMode?: string
  apiKeyPresent: boolean
}

export interface CodexStatusDto {
  config: CodexConfigStatus
  providers: CodexProviderStatus[]
  auth: CodexAuthStatus
  profiles: CodexProfileStatus[]
  keyringInUse: boolean
  homeOverride: string | null
  backups: BackupsSummary
}

function managedValues(data: JsonObject): Record<string, JsonValue | undefined> {
  const managed: Record<string, JsonValue | undefined> = {}
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    managed[field.id] = getPath(data, field.path)
  }
  return managed
}

function toProviderStatus(record: ProviderRecord): CodexProviderStatus {
  return {
    id: record.id,
    displayName: record.displayName,
    baseUrl: record.baseUrl,
    wireApi: record.wireApi,
    requiresOpenaiAuth: record.requiresOpenaiAuth,
    unmanagedKeys: record.unmanagedKeys,
    noBaseUrl: record.baseUrl.length === 0,
    noAmbientAuth: !record.requiresOpenaiAuth,
  }
}

function toAuthStatus(auth: AuthState): CodexAuthStatus {
  return {
    path: auth.path,
    exists: auth.exists,
    mode: auth.exists ? auth.mode : undefined,
    readable: auth.readable,
    authMode: auth.authMode.length > 0 ? auth.authMode : undefined,
    apiKeyPresent: auth.apiKey.length > 0,
    activeName: auth.activeName,
  }
}

function toProfileStatuses(auth: AuthState): CodexProfileStatus[] {
  return auth.profiles.map((profile) => ({
    name: profile.name,
    path: profile.path,
    readable: profile.readable,
    authMode: profile.readable && profile.authMode.length > 0 ? profile.authMode : undefined,
    apiKeyPresent: profile.readable && profile.apiKey.length > 0,
  }))
}

async function readConfigAndProviders(
  home: string,
): Promise<{ config: CodexConfigStatus; providers: CodexProviderStatus[]; keyringInUse: boolean }> {
  const target = codexConfigPath(home)
  const file = codexConfigFile(home)
  try {
    const [loaded, list] = await Promise.all([readConfigFile(file), loadProviders({ home })])
    return {
      config: {
        path: target,
        exists: loaded.exists,
        mode: loaded.exists ? await readMode(target) : undefined,
        parsed: true,
        managed: loaded.exists ? managedValues(loaded.data) : undefined,
        unmanagedKeys: loaded.exists
          ? countUnmanagedKeys(loaded.data, MANAGED_GLOBAL_PATHS)
          : undefined,
      },
      providers: list.records.map(toProviderStatus),
      keyringInUse: loaded.exists && keyringInUseIn(loaded.data),
    }
  } catch (err) {
    // A parse failure is a reported finding; any other failure propagates. The
    // sections that come from the auth store are read independently and still
    // ship, which is what "keeps parseable sections" asks of status.
    if (!(err instanceof TomlParseError)) throw err
    return {
      config: {
        path: target,
        exists: true,
        mode: await readMode(target),
        parsed: false,
        position: String(err.params['position'] ?? ''),
      },
      providers: [],
      keyringInUse: false,
    }
  }
}

export function codexStatusFindings(dto: CodexStatusDto): {
  warnings: Finding[]
  errors: Finding[]
} {
  const warnings: Finding[] = []
  const errors: Finding[] = []
  if (dto.config.exists && !dto.config.parsed) {
    errors.push({
      code: 'cli.parseFailure',
      params: { path: dto.config.path, detail: dto.config.position ?? '' },
    })
  }
  if (dto.auth.exists && !dto.auth.readable) {
    errors.push({ code: 'cli.parseFailure', params: { path: dto.auth.path, detail: 'unreadable' } })
  }
  for (const profile of dto.profiles) {
    if (!profile.readable) {
      errors.push({ code: 'cli.parseFailure', params: { path: profile.path, detail: 'unreadable' } })
    }
  }
  for (const provider of dto.providers) {
    if (provider.noBaseUrl) {
      warnings.push({ code: 'codex.warning.noBaseUrl', params: { name: provider.id } })
    }
    if (provider.noAmbientAuth) {
      warnings.push({ code: 'codex.warning.noAmbientAuth', params: { name: provider.id } })
    }
  }
  if (dto.keyringInUse) warnings.push({ code: 'codex.warning.keyringStore' })
  if (dto.homeOverride !== null) {
    warnings.push({ code: 'codex.warning.homeOverride', params: { path: dto.homeOverride } })
  }
  return { warnings, errors }
}

/** Reads everything, writes nothing. */
export async function readCodexStatus(ctx: { home: string }): Promise<CodexStatusDto> {
  const backupsDirPath = backupsDir(ctx.home)
  const [configAndProviders, auth, count, partials] = await Promise.all([
    readConfigAndProviders(ctx.home),
    loadAuthState(ctx),
    countBackups(backupsDirPath),
    countPartialBackups(backupsDirPath),
  ])
  return {
    config: configAndProviders.config,
    providers: configAndProviders.providers,
    auth: toAuthStatus(auth),
    profiles: toProfileStatuses(auth),
    keyringInUse: configAndProviders.keyringInUse,
    homeOverride: codexHomeOverride(ctx.home),
    backups: { path: backupsDirPath, count, partials },
  }
}
