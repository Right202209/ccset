import type { Ctx, JsonObject, StatusLine, StatusSection } from '../../types.js'
import { backupStatusSection } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { JsonParseError } from '../../core/errors.js'
import { fileExists, readMode } from '../../core/json-file.js'
import { maskSecret } from '../../core/mask.js'
import { countUnmanagedKeys } from '../../core/merge.js'
import { t } from '../../i18n/index.js'
import { seedGlobalFromDisk } from './global.js'
import { MANAGED_GLOBAL_PATHS } from './manifest.js'
import { loadProviders, type ProviderList, type ProviderRecord } from './providers.js'
import { backupsDir, opencodeConfigPath, opencodeTarget } from './paths.js'

export interface StatusData {
  sections: StatusSection[]
  providers: ProviderList
  /** A legacy opencode.json sits beside the managed .jsonc. */
  legacyJsonPresent: boolean
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
  const file = await opencodeTarget(ctx.home)
  const lines: StatusLine[] = [{ label: t('status.path'), value: file.path }]
  try {
    const config = await readConfigFile(file)
    if (!config.exists) {
      lines.push({ label: t('status.present'), value: t('status.absent'), tone: 'warn' })
      return { title: t('status.globalTitle'), lines }
    }
    lines.push({ label: t('status.mode'), value: await readMode(file.path) })
    lines.push(...globalLines(config.data))
    return {
      title: t('status.globalTitle'),
      lines,
      note: t('status.unmanagedNote', {
        count: countUnmanagedKeys(config.data, MANAGED_GLOBAL_PATHS),
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

/**
 * A legacy `opencode.json` beside the managed `.jsonc` is named for what it
 * is: still loaded by opencode, but not managed, so a key set in both files
 * takes the value of the file ccset writes. When no `.jsonc` exists the
 * `.json` is the managed file and needs no such note.
 */
async function legacyJsonSection(ctx: Ctx): Promise<StatusSection | null> {
  const target = await opencodeTarget(ctx.home)
  if (target.codec !== 'jsonc') return null
  const legacyPath = opencodeConfigPath(ctx.home)
  if (!(await fileExists(legacyPath))) return null
  return {
    title: t('opencode.status.legacyJsonTitle'),
    lines: [{ label: t('status.path'), value: legacyPath, tone: 'warn' }],
    note: t('opencode.status.legacyJsonNote'),
  }
}

/** Reads everything, writes nothing. */
export async function buildStatus(ctx: Ctx): Promise<StatusData> {
  const [providers, global, backups, legacy] = await Promise.all([
    loadProviders(ctx),
    globalSection(ctx),
    backupStatusSection(backupsDir(ctx.home)),
    legacyJsonSection(ctx),
  ])
  const sections = [global, ...providerSections(providers), backups]
  if (legacy !== null) sections.push(legacy)
  return { sections, providers, legacyJsonPresent: legacy !== null }
}
