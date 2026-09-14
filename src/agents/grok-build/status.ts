import type { Ctx, JsonObject, StatusLine, StatusSection } from '../../types.js'
import { backupStatusSection } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { ConfigParseError } from '../../core/errors.js'
import { fileExists, readMode } from '../../core/json-file.js'
import { maskSecret } from '../../core/mask.js'
import { countUnmanagedKeys } from '../../core/merge.js'
import { t } from '../../i18n/index.js'
import { MANAGED_GLOBAL_PATHS } from './manifest.js'
import { authPath, backupsDir, configFile } from './paths.js'
import { loadProviders, type ProviderList, type ProviderRecord } from './providers.js'
import { seedGlobalFromDisk } from './global.js'

export interface StatusData {
  sections: StatusSection[]
  providers: ProviderList
}

function blankAsUnset(value: string): string {
  return value.length > 0 ? value : t('status.unset')
}

/**
 * config.toml is both the global document and the providers' home, so the
 * global section is the file itself: path, mode, the one managed default, and
 * how much of the document ccset leaves alone.
 */
async function configSection(ctx: Ctx): Promise<StatusSection> {
  const file = configFile(ctx.home)
  const lines: StatusLine[] = [{ label: t('status.path'), value: file.path }]
  try {
    const config = await readConfigFile(file)
    if (!config.exists) {
      lines.push({ label: t('status.present'), value: t('status.absent'), tone: 'warn' })
      return { title: t('status.globalTitle'), lines }
    }
    lines.push({ label: t('status.mode'), value: await readMode(file.path) })
    const values = seedGlobalFromDisk(config.data)
    lines.push({
      label: t('field.globalModel'),
      value: blankAsUnset(String(values['defaultModel'] ?? '')),
    })
    return {
      title: t('status.globalTitle'),
      lines,
      note: t('status.unmanagedNote', {
        count: countUnmanagedKeys(config.data, MANAGED_GLOBAL_PATHS),
      }),
    }
  } catch (err) {
    const detail = err instanceof ConfigParseError ? String(err.params['position']) : ''
    lines.push({
      label: t('status.error'),
      value: t('status.parseErrorToml', { detail }),
      tone: 'error',
    })
    return { title: t('status.globalTitle'), lines }
  }
}

function providerSection(record: ProviderRecord): StatusSection {
  const lines: StatusLine[] = [
    { label: t('field.baseUrl'), value: blankAsUnset(record.baseUrl) },
    { label: t('grokBuild.field.modelId'), value: blankAsUnset(record.modelId) },
    { label: t('grokBuild.field.apiBackend'), value: blankAsUnset(record.apiBackend) },
    { label: t('grokBuild.field.apiKey'), value: blankAsUnset(maskSecret(record.apiKey)) },
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
        note: t('grokBuild.status.noConfigFile'),
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
      { title: t('status.providersTitle'), lines: [], note: t('grokBuild.status.noProviders') },
    ]
  }
  return list.records.map(providerSection)
}

/**
 * auth.json holds Grok's real credentials -- the session token `grok login`
 * writes. ccset never edits it, and Status says so instead of staying silent
 * about a file the credential resolution may fall back to.
 */
async function authSection(ctx: Ctx): Promise<StatusSection | null> {
  const path = authPath(ctx.home)
  if (!(await fileExists(path))) return null
  return {
    title: t('grokBuild.status.authTitle'),
    lines: [{ label: t('status.path'), value: path }],
    note: t('grokBuild.status.authNote'),
  }
}

/** Reads everything, writes nothing. */
export async function buildStatus(ctx: Ctx): Promise<StatusData> {
  const [providers, config, backups, auth] = await Promise.all([
    loadProviders(ctx),
    configSection(ctx),
    backupStatusSection(backupsDir(ctx.home)),
    authSection(ctx),
  ])
  const sections = [config, ...providerSections(providers), backups]
  if (auth !== null) sections.push(auth)
  return { sections, providers }
}
