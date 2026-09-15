import { countBackups, countPartialBackups } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { ConfigParseError } from '../../core/errors.js'
import { fileExists, readMode } from '../../core/json-file.js'
import { countUnmanagedKeys, getPath } from '../../core/merge.js'
import type { Finding, KeyedStatusSection } from '../../operations/types.js'
import { backupsSection, type BackupsSummary } from '../../operations/status-sections.js'
import type { ConfigFile, JsonObject } from '../../types.js'
import { MANAGED_GLOBAL_PATHS, PROVIDER_KEYS, providerKeyPath } from './manifest.js'
import { authPath, backupsDir, configFile } from './paths.js'
import { loadProviders, type ProviderRecord } from './providers.js'

/**
 * The raw status payload for Grok Build, secret-free and machine-readable: the
 * one config.toml document (managed default plus provider blocks), the
 * auth.json ccset never edits, and the backup counts. The TUI keeps its own
 * translated view of the same loaders; this DTO is what the operation seam and
 * JSON output carry.
 */

export interface GrokFileStatus {
  path: string
  exists: boolean
  mode?: string
  parsed: boolean
  position?: string
  managed?: Record<string, unknown>
  unmanagedKeys?: number
}

export interface GrokProviderStatus {
  id: string
  managed?: Record<string, unknown>
  apiKeyPresent?: boolean
  unmanagedKeys?: number
  noBaseUrl?: boolean
}

export interface GrokStatusDto {
  config: GrokFileStatus
  providers: GrokProviderStatus[]
  /** Present when auth.json exists: real credentials ccset does not touch. */
  authFile?: { path: string }
  backups: BackupsSummary
}

/**
 * The operation seam carries `Record<string, unknown>`, so the typed DTO
 * crosses it through exactly two casts, both living here. Nothing else in the
 * module, the fixtures, or the presenter sees one.
 */
export function toStatusData(dto: GrokStatusDto): Record<string, unknown> {
  return dto as unknown as Record<string, unknown>
}

export function fromStatusData(data: Record<string, unknown>): GrokStatusDto {
  return data as unknown as GrokStatusDto
}

export function grokStatusFindings(dto: GrokStatusDto): {
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
  for (const provider of dto.providers) {
    if (provider.noBaseUrl) {
      warnings.push({ code: 'grokBuild.warning.noBaseUrl', params: { name: provider.id } })
    }
  }
  return { warnings, errors }
}

/**
 * The file's parse-and-mode status, with a parse failure as an outcome rather
 * than an exception -- status must survive every malformed file it reports on.
 */
async function parseStatus(file: ConfigFile): Promise<{ status: GrokFileStatus; data?: JsonObject }> {
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
    if (!(err instanceof ConfigParseError)) throw err
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

function providerStatus(data: JsonObject, record: ProviderRecord): GrokProviderStatus {
  return {
    id: record.id,
    managed: {
      model: getPath(data, providerKeyPath(record.id, PROVIDER_KEYS.model)),
      baseUrl: getPath(data, providerKeyPath(record.id, PROVIDER_KEYS.baseUrl)),
      name: getPath(data, providerKeyPath(record.id, PROVIDER_KEYS.name)),
      apiBackend: getPath(data, providerKeyPath(record.id, PROVIDER_KEYS.apiBackend)),
    },
    apiKeyPresent: getPath(data, providerKeyPath(record.id, PROVIDER_KEYS.apiKey)) !== undefined,
    unmanagedKeys: record.unmanagedKeys,
    noBaseUrl: record.baseUrl.length === 0,
  }
}

/** Reads everything, writes nothing. */
export async function readGrokStatus(ctx: { home: string }): Promise<GrokStatusDto> {
  const file = configFile(ctx.home)
  const backupsDirPath = backupsDir(ctx.home)
  const [count, partials, authPresent, configRead] = await Promise.all([
    countBackups(backupsDirPath),
    countPartialBackups(backupsDirPath),
    fileExists(authPath(ctx.home)),
    parseStatus(file),
  ])
  const status = configRead.status
  if (status.parsed) {
    status.managed = { default: getPath(configRead.data ?? {}, ['models', 'default']) }
    status.unmanagedKeys = countUnmanagedKeys(configRead.data ?? {}, MANAGED_GLOBAL_PATHS)
  }
  const providers =
    status.parsed && status.exists ? await loadProviders(ctx) : { records: [] as ProviderRecord[] }
  return {
    config: status,
    providers: providers.records.map((record) => providerStatus(configRead.data ?? {}, record)),
    authFile: authPresent ? { path: authPath(ctx.home) } : undefined,
    backups: { path: backupsDirPath, count, partials },
  }
}

type Line = KeyedStatusSection['lines'][number]

function lineOf(labelKey: string, value: unknown): Line {
  if (value === undefined) return { labelKey, valueKey: 'status.unset' }
  return {
    labelKey,
    value: Array.isArray(value) ? value.map((item) => String(item)).join(', ') : String(value),
  }
}

function providerSection(provider: GrokProviderStatus): KeyedStatusSection {
  const managed = provider.managed ?? {}
  return {
    titleKey: 'status.providerTitle',
    titleParams: { name: provider.id },
    lines: [
      lineOf('field.baseUrl', managed['baseUrl']),
      lineOf('grokBuild.field.modelId', managed['model']),
      lineOf('grokBuild.field.apiBackend', managed['apiBackend']),
      {
        labelKey: 'grokBuild.field.apiKey',
        valueKey: provider.apiKeyPresent ? 'status.present' : 'status.absent',
      },
    ],
    noteKey: provider.noBaseUrl ? 'grokBuild.status.noBaseUrl' : undefined,
  }
}

function configSection(config: GrokFileStatus): KeyedStatusSection {
  const lines: Line[] = [{ labelKey: 'status.path', value: config.path }]
  if (config.exists) {
    lines.push({ labelKey: 'status.mode', value: config.mode })
    if (!config.parsed) {
      lines.push({ labelKey: 'status.error', valueKey: 'status.unreadable', tone: 'error' })
    } else {
      lines.push(lineOf('field.globalModel', config.managed?.['default']))
    }
  } else {
    lines.push({ labelKey: 'status.present', valueKey: 'status.absent', tone: 'warn' })
  }
  return {
    titleKey: 'status.globalTitle',
    lines,
    noteKey: config.exists && config.parsed ? 'status.unmanagedNote' : undefined,
    noteParams: { count: String(config.unmanagedKeys ?? 0) },
  }
}

/** The agent's own keyed rendering of its DTO for the human report. */
export function presentGrokStatus(dto: GrokStatusDto): KeyedStatusSection[] {
  const sections: KeyedStatusSection[] = [configSection(dto.config)]
  if (dto.config.exists && !dto.config.parsed) {
    sections.push({
      titleKey: 'status.providersTitle',
      lines: [{ labelKey: 'status.error', valueKey: 'status.unreadable', tone: 'error' }],
      noteKey: 'status.parseErrorToml',
      noteParams: { detail: dto.config.position ?? '' },
    })
  } else if (dto.providers.length === 0) {
    sections.push({
      titleKey: 'status.providersTitle',
      lines: [],
      noteKey: dto.config.exists ? 'grokBuild.status.noProviders' : 'grokBuild.status.noConfigFile',
    })
  }
  for (const provider of dto.providers) sections.push(providerSection(provider))
  if (dto.authFile !== undefined) {
    sections.push({
      titleKey: 'grokBuild.status.authTitle',
      lines: [{ labelKey: 'status.path', value: dto.authFile.path }],
      noteKey: 'grokBuild.status.authNote',
    })
  }
  sections.push(backupsSection(dto.backups))
  return sections
}
