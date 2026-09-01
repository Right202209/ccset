import type { Ctx, JsonObject, StatusLine, StatusSection } from '../../types.js'
import { countBackups } from '../../core/backup.js'
import { JsonParseError } from '../../core/errors.js'
import { readJsonFile, readMode } from '../../core/json-file.js'
import { maskSecret } from '../../core/mask.js'
import { countUnmanagedKeys } from '../../core/merge.js'
import { backupsDir, globalSettingsPath } from './paths.js'
import { t } from '../../i18n/index.js'
import { MANAGED_GLOBAL_PATHS } from './manifest.js'
import { seedGlobalFromDisk } from './global.js'
import { loadProviders, type ProviderRecord } from './providers.js'
import { inspectState, onboardingFixHint, type StateReport } from './state.js'

export interface StatusData {
  sections: StatusSection[]
  state: StateReport
  providers: ProviderRecord[]
}

function stateSection(state: StateReport): StatusSection {
  const lines: StatusLine[] = [{ label: t('status.path'), value: state.path }]
  if (!state.exists) {
    lines.push({ label: t('status.present'), value: t('status.absent'), tone: 'warn' })
    return { title: t('claudeCode.status.stateTitle'), lines, note: t('claudeCode.status.stateAbsentNote') }
  }
  lines.push({ label: t('status.present'), value: t('status.yes') })
  lines.push({ label: t('status.mode'), value: state.mode })
  if (!state.parsed) {
    lines.push({ label: t('status.onboarding'), value: t('status.unreadable'), tone: 'error' })
    return { title: t('claudeCode.status.stateTitle'), lines }
  }
  const onboarded = state.onboarded === true
  lines.push({
    label: t('status.onboarding'),
    value: onboarded ? t('status.yes') : t('status.no'),
    tone: onboarded ? 'info' : 'warn',
  })
  const note = onboarded ? t('claudeCode.status.readOnlyNote') : t('status.fixHint', { fix: onboardingFixHint() })
  return { title: t('claudeCode.status.stateTitle'), lines, note }
}

function globalLines(data: JsonObject): StatusLine[] {
  const values = seedGlobalFromDisk(data)
  const proxy = String(values['proxyUrl'] ?? '')
  return [
    {
      label: t('claudeCode.field.proxyEnabled'),
      value: values['proxyEnabled'] === true ? proxy : t('status.disabled'),
    },
    { label: t('field.globalModel'), value: blankAsUnset(String(values['model'] ?? '')) },
    {
      label: t('claudeCode.field.cleanupPeriodDays'),
      value: blankAsUnset(String(values['cleanupPeriodDays'] ?? '')),
    },
    {
      label: t('claudeCode.field.disableNonessentialTraffic'),
      value: switchLabel(String(values['disableNonessentialTraffic'] ?? '')),
    },
    {
      label: t('claudeCode.field.attributionHeader'),
      value: switchLabel(String(values['attributionHeader'] ?? '')),
    },
    {
      label: t('claudeCode.field.disableInstallationChecks'),
      value: switchLabel(String(values['disableInstallationChecks'] ?? '')),
    },
    { label: t('claudeCode.field.enableToolSearch'), value: switchLabel(String(values['enableToolSearch'] ?? '')) },
  ]
}

function blankAsUnset(value: string): string {
  return value.length > 0 ? value : t('status.unset')
}

function switchLabel(value: string): string {
  if (value === '1') return t('choice.on')
  if (value === '0') return t('choice.off')
  return t('choice.unmanaged')
}

async function globalSection(ctx: Ctx): Promise<StatusSection> {
  const target = globalSettingsPath(ctx.home)
  const lines: StatusLine[] = [{ label: t('status.path'), value: target }]
  try {
    const file = await readJsonFile(target)
    if (!file.exists) {
      lines.push({ label: t('status.present'), value: t('status.absent'), tone: 'warn' })
      return { title: t('status.globalTitle'), lines }
    }
    lines.push({ label: t('status.mode'), value: await readMode(target) })
    lines.push(...globalLines(file.data))
    const unmanaged = countUnmanagedKeys(file.data, MANAGED_GLOBAL_PATHS)
    return {
      title: t('status.globalTitle'),
      lines,
      note: t('status.unmanagedNote', { count: unmanaged }),
    }
  } catch (err) {
    const detail = err instanceof JsonParseError ? String(err.params['position']) : ''
    lines.push({ label: t('status.error'), value: t('status.parseError', { detail }), tone: 'error' })
    return { title: t('status.globalTitle'), lines }
  }
}

function providerSection(record: ProviderRecord): StatusSection {
  const lines: StatusLine[] = [{ label: t('status.path'), value: record.path }]
  if (!record.parsed) {
    lines.push({
      label: t('status.error'),
      value: t(record.problemKey ?? 'status.readError', { detail: record.problemDetail ?? '' }),
      tone: 'error',
    })
    return { title: t('status.providerTitle', { name: record.name }), lines }
  }
  lines.push({ label: t('field.baseUrl'), value: blankAsUnset(record.baseUrl) })
  lines.push({ label: t('field.providerModel'), value: blankAsUnset(record.model) })
  lines.push({ label: t('field.token'), value: blankAsUnset(maskSecret(record.token)) })
  lines.push({ label: t('status.command'), value: record.command })
  return {
    title: t('status.providerTitle', { name: record.name }),
    lines,
    note: record.problemKey !== undefined ? t(record.problemKey) : undefined,
  }
}

async function backupSection(ctx: Ctx): Promise<StatusSection> {
  const count = await countBackups(backupsDir(ctx.home))
  return {
    title: t('status.backupsTitle'),
    lines: [
      { label: t('status.path'), value: backupsDir(ctx.home) },
      { label: t('status.count'), value: String(count) },
    ],
    note: t('status.backupsNote'),
  }
}

/** Reads everything, writes nothing. */
export async function buildStatus(ctx: Ctx): Promise<StatusData> {
  const [state, providers, global, backups] = await Promise.all([
    inspectState(ctx),
    loadProviders(ctx),
    globalSection(ctx),
    backupSection(ctx),
  ])
  const sections = [stateSection(state), global, ...providers.map(providerSection), backups]
  if (providers.length === 0) {
    sections.splice(2, 0, { title: t('status.providersTitle'), lines: [], note: t('claudeCode.status.noProviders') })
  }
  return { sections, state, providers }
}
