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
 * The raw status payload. This is what the operation seam returns and what
 * JSON serializes: machine-readable, secret-free (a presence flag stands in
 * for every credential), and free of translated text -- the agent's keyed
 * presenter turns it into sections for the human report, and the TUI keeps
 * its own translated view of the same loaders.
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

/** The agent's own keyed rendering of its DTO for the human report. */
export function presentClaudeStatus(dto: ClaudeStatusDto): KeyedStatusSection[] {
  const sections: KeyedStatusSection[] = []
  sections.push(stateSection(dto))
  sections.push(globalSection(dto))
  if (dto.providers.length === 0) {
    sections.push({ titleKey: 'status.providersTitle', lines: [], noteKey: 'claudeCode.status.noProviders' })
  }
  for (const provider of dto.providers) sections.push(providerSection(provider))
  sections.push(backupsSection(dto))
  return sections
}

function stateSection(dto: ClaudeStatusDto): KeyedStatusSection {
  const state = dto.state
  const lines: KeyedLineInput[] = [
    { labelKey: 'status.path', value: state.path },
  ]
  if (!state.exists) {
    lines.push({ labelKey: 'status.present', valueKey: 'status.absent' })
    return { titleKey: 'claudeCode.status.stateTitle', lines, noteKey: 'claudeCode.status.stateAbsentNote' }
  }
  lines.push({ labelKey: 'status.mode', value: state.mode })
  if (!state.parsed) {
    lines.push({ labelKey: 'status.onboarding', valueKey: 'status.unreadable', tone: 'error' })
    return { titleKey: 'claudeCode.status.stateTitle', lines }
  }
  lines.push({ labelKey: 'status.onboarding', valueKey: state.onboarded ? 'status.yes' : 'status.no' })
  return { titleKey: 'claudeCode.status.stateTitle', lines, noteKey: 'claudeCode.status.readOnlyNote' }
}

type KeyedLineInput = KeyedStatusSection['lines'][number]

function valueOf(id: string, managed: Record<string, JsonValue | undefined>): KeyedLineInput {
  const value = managed[id]
  if (value === undefined) return { labelKey: labelOf(id), valueKey: 'status.unset' }
  return { labelKey: labelOf(id), value: String(value) }
}

function labelOf(fieldId: string): string {
  const labels: Record<string, string> = {
    model: 'field.globalModel',
    cleanupPeriodDays: 'claudeCode.field.cleanupPeriodDays',
    disableNonessentialTraffic: 'claudeCode.field.disableNonessentialTraffic',
    attributionHeader: 'claudeCode.field.attributionHeader',
    disableInstallationChecks: 'claudeCode.field.disableInstallationChecks',
    enableToolSearch: 'claudeCode.field.enableToolSearch',
    baseUrl: 'field.baseUrl',
    fallbackModel: 'claudeCode.field.fallbackModel',
  }
  return labels[fieldId] ?? fieldId
}

function globalSection(dto: ClaudeStatusDto): KeyedStatusSection {
  const lines: KeyedLineInput[] = [{ labelKey: 'status.path', value: dto.global.path }]
  if (!dto.global.exists) {
    lines.push({ labelKey: 'status.present', valueKey: 'status.absent', tone: 'warn' })
    return { titleKey: 'status.globalTitle', lines }
  }
  lines.push({ labelKey: 'status.mode', value: dto.global.mode })
  if (!dto.global.parsed) {
    lines.push({ labelKey: 'status.error', valueKey: 'status.unreadable', tone: 'error' })
    return { titleKey: 'status.globalTitle', lines }
  }
  const managed = dto.global.managed ?? {}
  const proxyUrl = managed['proxyUrl']
  lines.push({
    labelKey: 'claudeCode.field.proxyEnabled',
    value: proxyUrl !== undefined ? String(proxyUrl) : undefined,
    valueKey: proxyUrl !== undefined ? undefined : 'status.disabled',
  })
  lines.push(valueOf('model', managed))
  lines.push(valueOf('cleanupPeriodDays', managed))
  for (const id of ['disableNonessentialTraffic', 'attributionHeader', 'disableInstallationChecks', 'enableToolSearch']) {
    const value = managed[id]
    lines.push({
      labelKey: labelOf(id),
      valueKey: value === '1' ? 'choice.on' : value === '0' ? 'choice.off' : 'choice.unmanaged',
    })
  }
  return {
    titleKey: 'status.globalTitle',
    lines,
    noteKey: 'status.unmanagedNote',
    noteParams: { count: String(dto.global.unmanagedKeys ?? 0) },
  }
}

function providerSection(provider: ClaudeProviderStatus): KeyedStatusSection {
  const lines: KeyedLineInput[] = [{ labelKey: 'status.path', value: provider.path }]
  if (!provider.parsed) {
    lines.push({ labelKey: 'status.error', valueKey: 'status.unreadable', tone: 'error' })
    return { titleKey: 'status.providerTitle', titleParams: { name: provider.name }, lines }
  }
  const managed = provider.managed ?? {}
  lines.push(valueOf('baseUrl', managed))
  lines.push(valueOf('model', managed))
  lines.push({
    labelKey: 'field.token',
    valueKey: provider.tokenPresent ? 'status.present' : 'status.absent',
  })
  return {
    titleKey: 'status.providerTitle',
    titleParams: { name: provider.name },
    lines,
    noteKey: provider.managed?.['baseUrl'] === undefined ? 'claudeCode.status.noBaseUrl' : undefined,
  }
}

function backupsSection(dto: ClaudeStatusDto): KeyedStatusSection {
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
