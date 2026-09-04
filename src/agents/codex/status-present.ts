import type { KeyedStatusSection } from '../../operations/types.js'
import { backupsSection } from '../../operations/status-sections.js'
import type { JsonValue } from '../../types.js'
import type { CodexAuthStatus, CodexProviderStatus, CodexProfileStatus, CodexStatusDto } from './status-dto.js'

/**
 * The agent's own keyed rendering of its status DTO for the human report.
 * Labels resolve through the catalog; values are raw display strings or
 * keyed yes/no/unset tokens, never credential material.
 */

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
  sections.push(backupsSection(dto.backups))
  return sections
}
