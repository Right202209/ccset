import type { KeyedStatusSection } from '../../operations/types.js'
import type { JsonValue } from '../../types.js'
import type { ClaudeProviderStatus, ClaudeStatusDto } from './status-dto.js'

/**
 * The agent's own keyed rendering of its status DTO for the human report.
 */

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
