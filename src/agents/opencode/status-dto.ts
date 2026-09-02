import { countBackups, countPartialBackups } from '../../core/backup.js'
import { JsonParseError } from '../../core/errors.js'
import { fileExists, readJsonFile, readMode } from '../../core/json-file.js'
import { countUnmanagedKeys, getPath } from '../../core/merge.js'
import type { Finding, KeyedStatusSection } from '../../operations/types.js'
import type { JsonObject, JsonValue } from '../../types.js'
import { GLOBAL_FIELDS, MANAGED_GLOBAL_PATHS, providerApiKeyPath } from './manifest.js'
import { backupsDir, opencodeConfigPath, opencodeJsoncPath } from './paths.js'
import { loadProviders, type ProviderRecord } from './providers.js'

/**
 * The raw status payload for opencode, secret-free and machine-readable: the
 * one config document, the provider blocks inside it, the JSONC warning, and
 * the backup counts. The TUI keeps its own translated view of the same
 * loaders; this DTO is what the operation seam and JSON output carry.
 */

export interface OpencodeConfigStatus {
  path: string
  exists: boolean
  mode?: string
  parsed: boolean
  position?: string
  managed?: Record<string, JsonValue | undefined>
  unmanagedKeys?: number
}

export interface OpencodeProviderStatus {
  id: string
  managed?: Record<string, JsonValue | undefined>
  apiKeyPresent?: boolean
  unmanagedKeys?: number
  noBaseUrl?: boolean
}

export interface OpencodeStatusDto {
  config: OpencodeConfigStatus
  providers: OpencodeProviderStatus[]
  jsoncPresent: boolean
  jsoncPath: string
  backups: { path: string; count: number; partials: number }
}

const SECRET_FIELD_IDS = new Set(['apiKey'])

function managedValues(data: JsonObject): Record<string, JsonValue | undefined> {
  const managed: Record<string, JsonValue | undefined> = {}
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    managed[field.id] = getPath(data, field.path)
  }
  return managed
}

function withoutSecrets(
  managed: Record<string, JsonValue | undefined>,
): Record<string, JsonValue | undefined> {
  const safe = { ...managed }
  for (const id of SECRET_FIELD_IDS) delete safe[id]
  return safe
}

function toProviderStatus(data: JsonObject, record: ProviderRecord): OpencodeProviderStatus {
  const managed: Record<string, JsonValue | undefined> = {
    displayName: getPath(data, ['provider', record.id, 'name']),
    npm: getPath(data, ['provider', record.id, 'npm']),
    baseUrl: getPath(data, ['provider', record.id, 'options', 'baseURL']),
    models: getPath(data, ['provider', record.id, 'models']),
  }
  return {
    id: record.id,
    managed: withoutSecrets(managed),
    apiKeyPresent: getPath(data, providerApiKeyPath(record.id)) !== undefined,
    unmanagedKeys: record.unmanagedKeys,
    noBaseUrl: record.baseUrl.length === 0,
  }
}

export function opencodeStatusFindings(dto: OpencodeStatusDto): {
  warnings: Finding[]
  errors: Finding[]
} {
  const warnings: Finding[] = []
  const errors: Finding[] = []
  if (dto.jsoncPresent) warnings.push({ code: 'opencode.warning.jsoncPresent' })
  if (dto.config.exists && !dto.config.parsed) {
    errors.push({
      code: 'cli.parseFailure',
      params: { path: dto.config.path, detail: dto.config.position ?? '' },
    })
  }
  for (const provider of dto.providers) {
    if (provider.noBaseUrl) {
      warnings.push({ code: 'opencode.warning.noBaseUrl', params: { name: provider.id } })
    }
  }
  return { warnings, errors }
}

/** Reads everything, writes nothing. */
export async function readOpencodeStatus(ctx: { home: string }): Promise<OpencodeStatusDto> {
  const target = opencodeConfigPath(ctx.home)
  const backupsDirPath = backupsDir(ctx.home)
  const [count, partials, jsoncPresent] = await Promise.all([
    countBackups(backupsDirPath),
    countPartialBackups(backupsDirPath),
    fileExists(opencodeJsoncPath(ctx.home)),
  ])
  const backups = { path: backupsDirPath, count, partials }
  try {
    const file = await readJsonFile(target)
    const list = await loadProviders(ctx)
    return {
      config: {
        path: target,
        exists: file.exists,
        mode: file.exists ? await readMode(target) : undefined,
        parsed: true,
        managed: managedValues(file.data),
        unmanagedKeys: countUnmanagedKeys(file.data, MANAGED_GLOBAL_PATHS),
      },
      providers: list.records.map((record) => toProviderStatus(file.data, record)),
      jsoncPresent,
      jsoncPath: opencodeJsoncPath(ctx.home),
      backups,
    }
  } catch (err) {
    if (!(err instanceof JsonParseError)) throw err
    return {
      config: {
        path: target,
        exists: true,
        mode: await readMode(target),
        parsed: false,
        position: String(err.params['position'] ?? ''),
      },
      providers: [],
      jsoncPresent,
      jsoncPath: opencodeJsoncPath(ctx.home),
      backups,
    }
  }
}

type Line = KeyedStatusSection['lines'][number]

function lineOf(id: string, labelKey: string, managed: Record<string, JsonValue | undefined>): Line {
  const value = managed[id]
  if (value === undefined) return { labelKey, valueKey: 'status.unset' }
  return {
    labelKey,
    value: Array.isArray(value) ? value.join(', ') : String(value),
  }
}

function backupsSection(dto: OpencodeStatusDto): KeyedStatusSection {
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

function providerSection(provider: OpencodeProviderStatus): KeyedStatusSection {
  const managed = provider.managed ?? {}
  return {
    titleKey: 'status.providerTitle',
    titleParams: { name: provider.id },
    lines: [
      lineOf('displayName', 'opencode.field.displayName', managed),
      lineOf('baseUrl', 'field.baseUrl', managed),
      {
        labelKey: 'opencode.field.apiKey',
        valueKey: provider.apiKeyPresent ? 'status.present' : 'status.absent',
      },
      lineOf('npm', 'opencode.field.npm', managed),
      lineOf('models', 'opencode.field.models', managed),
    ],
    noteKey: provider.noBaseUrl ? 'opencode.status.noBaseUrl' : undefined,
  }
}

/** The agent's own keyed rendering of its DTO for the human report. */
export function presentOpencodeStatus(dto: OpencodeStatusDto): KeyedStatusSection[] {
  const lines: Line[] = [{ labelKey: 'status.path', value: dto.config.path }]
  if (dto.config.exists) {
    lines.push({ labelKey: 'status.mode', value: dto.config.mode })
    if (!dto.config.parsed) {
      lines.push({ labelKey: 'status.error', valueKey: 'status.unreadable', tone: 'error' })
    } else {
      const managed = dto.config.managed ?? {}
      lines.push(lineOf('model', 'field.globalModel', managed))
      lines.push(lineOf('smallModel', 'opencode.field.smallModel', managed))
      lines.push(lineOf('share', 'opencode.field.share', managed))
      lines.push(lineOf('autoupdate', 'opencode.field.autoupdate', managed))
      lines.push(lineOf('username', 'opencode.field.username', managed))
      lines.push(lineOf('disabledProviders', 'opencode.field.disabledProviders', managed))
    }
  } else {
    lines.push({ labelKey: 'status.present', valueKey: 'status.absent', tone: 'warn' })
  }
  const global: KeyedStatusSection = {
    titleKey: 'status.globalTitle',
    lines,
    noteKey:
      dto.config.exists && dto.config.parsed
        ? 'status.unmanagedNote'
        : undefined,
    noteParams: { count: String(dto.config.unmanagedKeys ?? 0) },
  }
  const sections: KeyedStatusSection[] = [global]
  if (dto.providers.length === 0) {
    sections.push({ titleKey: 'status.providersTitle', lines: [], noteKey: 'opencode.status.noProviders' })
  }
  for (const provider of dto.providers) sections.push(providerSection(provider))
  if (dto.jsoncPresent) {
    sections.push({
      titleKey: 'opencode.status.jsoncTitle',
      lines: [{ labelKey: 'status.path', value: dto.jsoncPath, tone: 'warn' }],
      noteKey: 'opencode.status.jsoncNote',
    })
  }
  sections.push(backupsSection(dto))
  return sections
}
