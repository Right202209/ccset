import type { Ctx, JsonObject, StatusLine, StatusSection } from '../../types.js'
import { backupStatusSection } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { JsonParseError } from '../../core/errors.js'
import { fileExists, readMode } from '../../core/json-file.js'
import { maskSecret } from '../../core/mask.js'
import { countUnmanagedKeys } from '../../core/merge.js'
import { t } from '../../i18n/index.js'
import { MANAGED_SETTINGS_PATHS } from './manifest.js'
import { authPath, backupsDir, modelsFile, settingsFile } from './paths.js'
import { loadProviders, type ProviderList, type ProviderRecord } from './providers.js'
import { seedSettingsFromDisk } from './settings.js'

export interface StatusData {
  sections: StatusSection[]
  providers: ProviderList
}

function blankAsUnset(value: string): string {
  return value.length > 0 ? value : t('status.unset')
}

function settingsLines(data: JsonObject): StatusLine[] {
  const values = seedSettingsFromDisk(data)
  const show = (id: string): string => blankAsUnset(String(values[id] ?? ''))
  return [
    { label: t('pi.field.defaultProvider'), value: show('defaultProvider') },
    { label: t('pi.field.defaultModel'), value: show('defaultModel') },
    { label: t('pi.field.defaultThinkingLevel'), value: show('defaultThinkingLevel') },
  ]
}

async function settingsSection(ctx: Ctx): Promise<StatusSection> {
  const file = settingsFile(ctx.home)
  const lines: StatusLine[] = [{ label: t('status.path'), value: file.path }]
  try {
    const config = await readConfigFile(file)
    if (!config.exists) {
      lines.push({ label: t('status.present'), value: t('status.absent'), tone: 'warn' })
      return { title: t('status.globalTitle'), lines }
    }
    lines.push({ label: t('status.mode'), value: await readMode(file.path) })
    lines.push(...settingsLines(config.data))
    return {
      title: t('status.globalTitle'),
      lines,
      note: t('status.unmanagedNote', {
        count: countUnmanagedKeys(config.data, MANAGED_SETTINGS_PATHS),
      }),
    }
  } catch (err) {
    const detail = err instanceof JsonParseError ? String(err.params['position']) : ''
    lines.push({ label: t('status.error'), value: t('status.parseError', { detail }), tone: 'error' })
    return { title: t('status.globalTitle'), lines }
  }
}

function providerSection(record: ProviderRecord): StatusSection {
  const lines: StatusLine[] = [
    { label: t('field.baseUrl'), value: blankAsUnset(record.baseUrl) },
    { label: t('pi.field.api'), value: blankAsUnset(record.api) },
    { label: t('pi.field.apiKey'), value: blankAsUnset(maskSecret(record.apiKey)) },
    { label: t('pi.field.models'), value: blankAsUnset(record.models.join(', ')) },
  ]
  return {
    title: t('status.providerTitle', { name: record.id }),
    lines,
    note: record.problemKey !== undefined ? t(record.problemKey) : undefined,
  }
}

function providerSections(list: ProviderList): StatusSection[] {
  if (!list.exists) {
    return [
      {
        title: t('status.providersTitle'),
        lines: [{ label: t('status.path'), value: list.path, tone: 'warn' }],
        note: t('pi.status.noModelsFile'),
      },
    ]
  }
  if (!list.parsed) {
    return [
      {
        title: t('status.providersTitle'),
        lines: [
          {
            label: t('status.error'),
            value: t(list.problemKey ?? 'status.readError', { detail: list.problemDetail ?? '' }),
            tone: 'error',
          },
        ],
      },
    ]
  }
  if (list.records.length === 0) {
    return [
      { title: t('status.providersTitle'), lines: [], note: t('pi.status.noProviders') },
    ]
  }
  return list.records.map(providerSection)
}

/**
 * auth.json holds pi's real credentials -- API keys and OAuth tokens written
 * by /login. ccset never edits it, and Status says so instead of staying
 * silent about a file every provider switch depends on.
 */
async function authSection(ctx: Ctx): Promise<StatusSection | null> {
  const path = authPath(ctx.home)
  if (!(await fileExists(path))) return null
  return {
    title: t('pi.status.authTitle'),
    lines: [{ label: t('status.path'), value: path }],
    note: t('pi.status.authNote'),
  }
}

/** Reads everything, writes nothing. */
export async function buildStatus(ctx: Ctx): Promise<StatusData> {
  const [providers, settings, backups, auth] = await Promise.all([
    loadProviders(ctx),
    settingsSection(ctx),
    backupStatusSection(backupsDir(ctx.home)),
    authSection(ctx),
  ])
  const sections = [settings, ...providerSections(providers), backups]
  if (auth !== null) sections.push(auth)
  return { sections, providers }
}
