import { countBackups, countPartialBackups } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { JsonParseError } from '../../core/errors.js'
import { fileExists, readMode } from '../../core/json-file.js'
import { countUnmanagedKeys, getPath } from '../../core/merge.js'
import type { Finding, KeyedStatusSection } from '../../operations/types.js'
import { backupsSection, type BackupsSummary } from '../../operations/status-sections.js'
import type { ConfigFile, JsonObject, JsonValue } from '../../types.js'
import {
  GLOBAL_FIELDS,
  MANAGED_SETTINGS_PATHS,
  providerApiKeyPath,
  providerApiPath,
  providerBaseUrlPath,
  providerModelsPath,
} from './manifest.js'
import { authPath, backupsDir, modelsFile, settingsFile } from './paths.js'
import { loadProviders, type ProviderRecord } from './providers.js'

/**
 * The raw status payload for pi, secret-free and machine-readable: the startup
 * defaults in settings.json, the provider blocks in models.json, the auth.json
 * ccset never edits, and the backup counts. The TUI keeps its own translated
 * view of the same loaders; this DTO is what the operation seam and JSON
 * output carry.
 */

export interface PiFileStatus {
  path: string
  exists: boolean
  mode?: string
  parsed: boolean
  position?: string
  managed?: Record<string, JsonValue | undefined>
  unmanagedKeys?: number
}

export interface PiProviderStatus {
  id: string
  managed?: Record<string, JsonValue | undefined>
  apiKeyPresent?: boolean
  unmanagedKeys?: number
  noBaseUrl?: boolean
}

export interface PiStatusDto {
  settings: PiFileStatus
  models: PiFileStatus
  providers: PiProviderStatus[]
  /** Present when auth.json exists: real credentials ccset does not touch. */
  authFile?: { path: string }
  backups: BackupsSummary
}

function settingsManaged(data: JsonObject): Record<string, JsonValue | undefined> {
  const managed: Record<string, JsonValue | undefined> = {}
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    managed[field.id] = getPath(data, field.path)
  }
  return managed
}

function toProviderStatus(data: JsonObject, record: ProviderRecord): PiProviderStatus {
  return {
    id: record.id,
    managed: {
      baseUrl: getPath(data, providerBaseUrlPath(record.id)),
      api: getPath(data, providerApiPath(record.id)),
      models: getPath(data, providerModelsPath(record.id)),
    },
    apiKeyPresent: getPath(data, providerApiKeyPath(record.id)) !== undefined,
    unmanagedKeys: record.unmanagedKeys,
    noBaseUrl: record.baseUrl.length === 0,
  }
}

/**
 * The operation seam carries `Record<string, unknown>`, so the typed DTO
 * crosses it through exactly two casts, both living here. Nothing else in the
 * module, the fixtures, or the presenter sees one.
 */
export function toStatusData(dto: PiStatusDto): Record<string, unknown> {
  return dto as unknown as Record<string, unknown>
}

export function fromStatusData(data: Record<string, unknown>): PiStatusDto {
  return data as unknown as PiStatusDto
}

export function piStatusFindings(dto: PiStatusDto): {
  warnings: Finding[]
  errors: Finding[]
} {
  const warnings: Finding[] = []
  const errors: Finding[] = []
  for (const file of [dto.settings, dto.models]) {
    if (file.exists && !file.parsed) {
      errors.push({ code: 'cli.parseFailure', params: { path: file.path, detail: file.position ?? '' } })
    }
  }
  for (const provider of dto.providers) {
    if (provider.noBaseUrl) {
      warnings.push({ code: 'pi.warning.noBaseUrl', params: { name: provider.id } })
    }
  }
  return { warnings, errors }
}

/**
 * One file's parse-and-mode status, with a parse failure as an outcome rather
 * than an exception -- status must survive every malformed file it reports on.
 */
async function parseStatus(
  file: ConfigFile,
): Promise<{ status: PiFileStatus; data?: JsonObject }> {
  try {
    const config = await readConfigFile(file)
    return {
      data: config.data,
      status: {
        path: file.path,
        exists: config.exists,
        mode: config.exists ? await readMode(file.path) : undefined,
        parsed: true,
      },
    }
  } catch (err) {
    if (!(err instanceof JsonParseError)) throw err
    return {
      status: {
        path: file.path,
        exists: true,
        mode: await readMode(file.path),
        parsed: false,
        position: String(err.params['position'] ?? ''),
      },
    }
  }
}

/** Reads everything, writes nothing. */
export async function readPiStatus(ctx: { home: string }): Promise<PiStatusDto> {
  const settings = settingsFile(ctx.home)
  const models = modelsFile(ctx.home)
  const backupsDirPath = backupsDir(ctx.home)
  const [count, partials, authPresent, settingsRead, modelsRead] = await Promise.all([
    countBackups(backupsDirPath),
    countPartialBackups(backupsDirPath),
    fileExists(authPath(ctx.home)),
    parseStatus(settings),
    parseStatus(models),
  ])
  if (settingsRead.status.parsed) {
    settingsRead.status.managed = settingsManaged(settingsRead.data ?? {})
    settingsRead.status.unmanagedKeys = countUnmanagedKeys(
      settingsRead.data ?? {},
      MANAGED_SETTINGS_PATHS,
    )
  }
  const providers =
    modelsRead.status.parsed && modelsRead.status.exists
      ? await providerStatuses(ctx, modelsRead.data ?? {})
      : []
  return {
    settings: settingsRead.status,
    models: modelsRead.status,
    providers,
    authFile: authPresent ? { path: authPath(ctx.home) } : undefined,
    backups: { path: backupsDirPath, count, partials },
  }
}

async function providerStatuses(ctx: { home: string }, data: JsonObject): Promise<PiProviderStatus[]> {
  const list = await loadProviders(ctx)
  return list.records.map((record) => toProviderStatus(data, record))
}

type Line = KeyedStatusSection['lines'][number]

function lineOf(id: string, labelKey: string, managed: Record<string, JsonValue | undefined>): Line {
  const value = managed[id]
  if (value === undefined) return { labelKey, valueKey: 'status.unset' }
  return {
    labelKey,
    value: Array.isArray(value) ? value.map((item) => String(item)).join(', ') : String(value),
  }
}

function providerSection(provider: PiProviderStatus): KeyedStatusSection {
  const managed = provider.managed ?? {}
  return {
    titleKey: 'status.providerTitle',
    titleParams: { name: provider.id },
    lines: [
      lineOf('baseUrl', 'field.baseUrl', managed),
      lineOf('api', 'pi.field.api', managed),
      {
        labelKey: 'pi.field.apiKey',
        valueKey: provider.apiKeyPresent ? 'status.present' : 'status.absent',
      },
      lineOf('models', 'pi.field.models', managed),
    ],
    noteKey: provider.noBaseUrl ? 'pi.status.noBaseUrl' : undefined,
  }
}

/** The agent's own keyed rendering of its DTO for the human report. */
export function presentPiStatus(dto: PiStatusDto): KeyedStatusSection[] {
  const sections: KeyedStatusSection[] = [settingsSection(dto.settings)]
  if (!dto.models.parsed) {
    sections.push({
      titleKey: 'status.providersTitle',
      lines: [{ labelKey: 'status.error', valueKey: 'status.unreadable', tone: 'error' }],
      noteKey: 'status.parseError',
      noteParams: { detail: dto.models.position ?? '' },
    })
  } else if (dto.providers.length === 0) {
    sections.push({ titleKey: 'status.providersTitle', lines: [], noteKey: 'pi.status.noProviders' })
  }
  for (const provider of dto.providers) sections.push(providerSection(provider))
  if (dto.authFile !== undefined) {
    sections.push({
      titleKey: 'pi.status.authTitle',
      lines: [{ labelKey: 'status.path', value: dto.authFile.path }],
      noteKey: 'pi.status.authNote',
    })
  }
  sections.push(backupsSection(dto.backups))
  return sections
}

function settingsSection(settings: PiFileStatus): KeyedStatusSection {
  const lines: Line[] = [{ labelKey: 'status.path', value: settings.path }]
  if (settings.exists) {
    lines.push({ labelKey: 'status.mode', value: settings.mode })
    if (!settings.parsed) {
      lines.push({ labelKey: 'status.error', valueKey: 'status.unreadable', tone: 'error' })
    } else {
      const managed = settings.managed ?? {}
      lines.push(lineOf('defaultProvider', 'pi.field.defaultProvider', managed))
      lines.push(lineOf('defaultModel', 'pi.field.defaultModel', managed))
      lines.push(lineOf('defaultThinkingLevel', 'pi.field.defaultThinkingLevel', managed))
    }
  } else {
    lines.push({ labelKey: 'status.present', valueKey: 'status.absent', tone: 'warn' })
  }
  return {
    titleKey: 'status.globalTitle',
    lines,
    noteKey:
      settings.exists && settings.parsed
        ? 'status.unmanagedNote'
        : undefined,
    noteParams: { count: String(settings.unmanagedKeys ?? 0) },
  }
}
