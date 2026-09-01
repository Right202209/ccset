import type { Ctx, JsonObject, StatusLine, StatusSection } from '../../types.js'
import { countBackups } from '../../core/backup.js'
import { JsonParseError } from '../../core/errors.js'
import { fileExists, readJsonFile, readMode } from '../../core/json-file.js'
import { maskSecret } from '../../core/mask.js'
import { countUnmanagedKeys } from '../../core/merge.js'
import { t } from '../../i18n/index.js'
import { seedGlobalFromDisk } from './global.js'
import { MANAGED_GLOBAL_PATHS } from './manifest.js'
import { loadProviders, type ProviderList, type ProviderRecord } from './providers.js'
import { backupsDir, opencodeConfigPath, opencodeJsoncPath } from './paths.js'

export interface StatusData {
  sections: StatusSection[]
  providers: ProviderList
  jsoncPresent: boolean
}

function blankAsUnset(value: string): string {
  return value.length > 0 ? value : t('status.unset')
}

function globalLines(data: JsonObject): StatusLine[] {
  const values = seedGlobalFromDisk(data)
  const show = (id: string): string => blankAsUnset(String(values[id] ?? ''))
  return [
    { label: t('field.globalModel'), value: show('model') },
    { label: t('opencode.field.smallModel'), value: show('smallModel') },
    { label: t('opencode.field.share'), value: show('share') },
    { label: t('opencode.field.autoupdate'), value: show('autoupdate') },
    { label: t('opencode.field.username'), value: show('username') },
    { label: t('opencode.field.disabledProviders'), value: show('disabledProviders') },
  ]
}

async function globalSection(ctx: Ctx): Promise<StatusSection> {
  const target = opencodeConfigPath(ctx.home)
  const lines: StatusLine[] = [{ label: t('status.path'), value: target }]
  try {
    const file = await readJsonFile(target)
    if (!file.exists) {
      lines.push({ label: t('status.present'), value: t('status.absent'), tone: 'warn' })
      return { title: t('status.globalTitle'), lines }
    }
    lines.push({ label: t('status.mode'), value: await readMode(target) })
    lines.push(...globalLines(file.data))
    return {
      title: t('status.globalTitle'),
      lines,
      note: t('status.unmanagedNote', {
        count: countUnmanagedKeys(file.data, MANAGED_GLOBAL_PATHS),
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
    { label: t('opencode.field.apiKey'), value: blankAsUnset(maskSecret(record.apiKey)) },
    { label: t('opencode.field.npm'), value: blankAsUnset(record.npm) },
    { label: t('opencode.field.models'), value: blankAsUnset(record.models.join(', ')) },
  ]
  if (record.displayName.length > 0) {
    lines.unshift({ label: t('opencode.field.displayName'), value: record.displayName })
  }
  return {
    title: t('status.providerTitle', { name: record.id }),
    lines,
    note: record.problemKey !== undefined ? t(record.problemKey) : undefined,
  }
}

function providerSections(list: ProviderList): StatusSection[] {
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
      { title: t('status.providersTitle'), lines: [], note: t('opencode.status.noProviders') },
    ]
  }
  return list.records.map(providerSection)
}

async function backupSection(ctx: Ctx): Promise<StatusSection> {
  const dir = backupsDir(ctx.home)
  return {
    title: t('status.backupsTitle'),
    lines: [
      { label: t('status.path'), value: dir },
      { label: t('status.count'), value: String(await countBackups(dir)) },
    ],
    note: t('status.backupsNote'),
  }
}

/**
 * opencode also loads a JSONC variant that ccset will not write, so a config
 * sitting beside the managed one is reported rather than ignored: a save that
 * lands in the file opencode does not read would otherwise look successful.
 */
function jsoncSection(ctx: Ctx): StatusSection {
  return {
    title: t('opencode.status.jsoncTitle'),
    lines: [{ label: t('status.path'), value: opencodeJsoncPath(ctx.home), tone: 'warn' }],
    note: t('opencode.status.jsoncNote'),
  }
}

/** Reads everything, writes nothing. */
export async function buildStatus(ctx: Ctx): Promise<StatusData> {
  const [providers, global, backups, jsoncPresent] = await Promise.all([
    loadProviders(ctx),
    globalSection(ctx),
    backupSection(ctx),
    fileExists(opencodeJsoncPath(ctx.home)),
  ])
  const sections = [global, ...providerSections(providers), backups]
  if (jsoncPresent) sections.push(jsoncSection(ctx))
  return { sections, providers, jsoncPresent }
}
