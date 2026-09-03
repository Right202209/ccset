import { countBackups, countPartialBackups } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { TomlParseError } from '../../core/errors.js'
import { readMode } from '../../core/json-file.js'
import { countUnmanagedKeys, getPath } from '../../core/merge.js'
import type { Finding, KeyedStatusSection } from '../../operations/types.js'
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
  backups: { path: string; count: number; partials: number }
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

type Line = KeyedStatusSection['lines'][number]

function lineOf(id: string, labelKey: string, managed: Record<string, JsonValue | undefined>): Line {
  const value = managed[id]
  if (value === undefined) return { labelKey, valueKey: 'status.unset' }
  return { labelKey, value: String(value) }
}

function globalSection(dto: CodexStatusDto): KeyedStatusSection {
  const lines: Line[] = [{ labelKey: 'status.path', value: dto.config.path }]
  if (!dto.config.exists) {
    lines.push({ labelKey: 'status.present', valueKey: 'status.absent', tone: 'warn' })
    return { titleKey: 'status.globalTitle', lines }
  }
  lines.push({ labelKey: 'status.mode', value: dto.config.mode })
  if (!dto.config.parsed) {
    lines.push({ labelKey: 'status.error', valueKey: 'status.unreadable', tone: 'error' })
    return { titleKey: 'status.globalTitle', lines }
  }
  const managed = dto.config.managed ?? {}
  lines.push(lineOf('model', 'field.globalModel', managed))
  lines.push(lineOf('modelProvider', 'codex.field.modelProvider', managed))
  lines.push(lineOf('reasoningEffort', 'codex.field.reasoningEffort', managed))
  lines.push(lineOf('approvalPolicy', 'codex.field.approvalPolicy', managed))
  lines.push(lineOf('sandboxMode', 'codex.field.sandboxMode', managed))
  lines.push(lineOf('verbosity', 'codex.field.verbosity', managed))
  lines.push(lineOf('contextWindow', 'codex.field.contextWindow', managed))
  return {
    titleKey: 'status.globalTitle',
    lines,
    noteKey: 'status.unmanagedNote',
    noteParams: { count: String(dto.config.unmanagedKeys ?? 0) },
  }
}

function providerSection(provider: CodexProviderStatus): KeyedStatusSection {
  const lines: Line[] = []
  if (provider.displayName.length > 0) {
    lines.push({ labelKey: 'codex.field.displayName', value: provider.displayName })
  }
  lines.push(
    provider.baseUrl.length > 0
      ? { labelKey: 'field.baseUrl', value: provider.baseUrl }
      : { labelKey: 'field.baseUrl', valueKey: 'status.unset' },
  )
  lines.push(
    provider.wireApi.length > 0
      ? { labelKey: 'codex.field.wireApi', value: provider.wireApi }
      : { labelKey: 'codex.field.wireApi', valueKey: 'status.unset' },
  )
  lines.push({
    labelKey: 'codex.field.requiresOpenaiAuth',
    valueKey: provider.requiresOpenaiAuth ? 'status.yes' : 'status.no',
    tone: provider.requiresOpenaiAuth ? undefined : 'warn',
  })
  return {
    titleKey: 'status.providerTitle',
    titleParams: { name: provider.id },
    lines,
    noteKey: provider.noBaseUrl
      ? 'codex.status.noBaseUrl'
      : provider.noAmbientAuth
        ? 'codex.status.noAmbientAuth'
        : undefined,
  }
}

function authSection(dto: CodexStatusDto): KeyedStatusSection {
  const auth = dto.auth
  const lines: Line[] = [{ labelKey: 'status.path', value: auth.path }]
  if (!auth.exists) {
    lines.push({ labelKey: 'status.present', valueKey: 'status.absent', tone: 'warn' })
    return { titleKey: 'codex.status.authTitle', lines, noteKey: 'codex.status.authNote' }
  }
  lines.push({ labelKey: 'status.mode', value: auth.mode })
  if (!auth.readable) {
    lines.push({ labelKey: 'status.error', valueKey: 'status.unreadable', tone: 'error' })
    return { titleKey: 'codex.status.authTitle', lines, noteKey: 'codex.status.authNote' }
  }
  lines.push({ labelKey: 'codex.status.authMode', value: auth.authMode })
  lines.push({
    labelKey: 'codex.field.apiKey',
    valueKey: auth.apiKeyPresent ? 'status.present' : 'status.absent',
  })
  lines.push({
    labelKey: 'codex.status.activeProfile',
    value: auth.activeName ?? undefined,
    valueKey: auth.activeName === null ? 'codex.status.noActiveProfile' : undefined,
  })
  return { titleKey: 'codex.status.authTitle', lines, noteKey: 'codex.status.authNote' }
}

function profilesSection(dto: CodexStatusDto): KeyedStatusSection {
  const lines: Line[] = dto.profiles.map((profile) => ({
    // A profile's name is user data, not a catalog key; t() renders an unknown
    // key verbatim, which is exactly the label the section wants.
    labelKey: profile.name,
    valueKey: !profile.readable
      ? 'status.unreadable'
      : profile.apiKeyPresent
        ? 'status.present'
        : 'status.absent',
    tone: profile.readable ? undefined : 'error',
  }))
  return {
    titleKey: 'codex.status.profilesTitle',
    lines,
    noteKey: lines.length === 0 ? 'codex.status.noProfiles' : 'codex.status.profilesNote',
  }
}

function backupsSection(dto: CodexStatusDto): KeyedStatusSection {
  return {
    titleKey: 'status.backupsTitle',
    lines: [
      { labelKey: 'status.path', value: dto.backups.path },
      { labelKey: 'status.count', value: String(dto.backups.count) },
      ...(dto.backups.partials > 0
        ? [{ labelKey: 'status.partials', value: String(dto.backups.partials), tone: 'warn' as const }]
        : []),
    ],
    noteKey: 'status.backupsNote',
  }
}

/** The agent's own keyed rendering of its DTO for the human report. */
export function presentCodexStatus(dto: CodexStatusDto): KeyedStatusSection[] {
  const sections: KeyedStatusSection[] = [globalSection(dto)]
  if (dto.providers.length === 0) {
    sections.push({ titleKey: 'status.providersTitle', lines: [], noteKey: 'codex.status.noProviders' })
  }
  for (const provider of dto.providers) sections.push(providerSection(provider))
  sections.push(authSection(dto))
  sections.push(profilesSection(dto))
  if (dto.keyringInUse) {
    sections.push({
      titleKey: 'codex.status.keyringTitle',
      lines: [{ labelKey: 'codex.status.keyringLabel', value: 'keyring', tone: 'warn' }],
      noteKey: 'codex.status.keyringNote',
    })
  }
  if (dto.homeOverride !== null) {
    sections.push({
      titleKey: 'codex.status.homeOverrideTitle',
      lines: [{ labelKey: 'codex.status.homeOverrideLabel', value: dto.homeOverride, tone: 'warn' }],
      noteKey: 'codex.status.homeOverrideNote',
    })
  }
  sections.push(backupsSection(dto))
  return sections
}
