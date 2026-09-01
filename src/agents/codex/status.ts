import type { Ctx, JsonObject, StatusLine, StatusSection } from '../../types.js'
import { countBackups } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { ConfigParseError } from '../../core/errors.js'
import { readMode } from '../../core/json-file.js'
import { maskSecret } from '../../core/mask.js'
import { countUnmanagedKeys, getPath } from '../../core/merge.js'
import { jsonToText } from '../../core/values.js'
import { t } from '../../i18n/index.js'
import { loadAuthState, type AuthState } from './auth.js'
import { AUTH_STORE_KEY, AUTH_STORE_KEYRING } from './constants.js'
import { codexConfigFile, seedGlobalFromDisk } from './global.js'
import { MANAGED_GLOBAL_PATHS } from './manifest.js'
import { loadProviders, type ProviderList, type ProviderRecord } from './providers.js'
import { backupsDir, codexHomeOverride } from './paths.js'

export interface StatusData {
  sections: StatusSection[]
  providers: ProviderList
  auth: AuthState
  keyringInUse: boolean
  homeOverride: string | null
}

function blankAsUnset(value: string): string {
  return value.length > 0 ? value : t('status.unset')
}

function globalLines(data: JsonObject): StatusLine[] {
  const values = seedGlobalFromDisk(data)
  const show = (id: string): string => blankAsUnset(String(values[id] ?? ''))
  return [
    { label: t('field.globalModel'), value: show('model') },
    { label: t('codex.field.modelProvider'), value: show('modelProvider') },
    { label: t('codex.field.reasoningEffort'), value: show('reasoningEffort') },
    { label: t('codex.field.approvalPolicy'), value: show('approvalPolicy') },
    { label: t('codex.field.sandboxMode'), value: show('sandboxMode') },
    { label: t('codex.field.verbosity'), value: show('verbosity') },
    { label: t('codex.field.contextWindow'), value: show('contextWindow') },
  ]
}

async function globalSection(ctx: Ctx): Promise<StatusSection> {
  const file = codexConfigFile(ctx.home)
  const lines: StatusLine[] = [{ label: t('status.path'), value: file.path }]
  try {
    const loaded = await readConfigFile(file)
    if (!loaded.exists) {
      lines.push({ label: t('status.present'), value: t('status.absent'), tone: 'warn' })
      return { title: t('status.globalTitle'), lines }
    }
    lines.push({ label: t('status.mode'), value: await readMode(file.path) })
    lines.push(...globalLines(loaded.data))
    return {
      title: t('status.globalTitle'),
      lines,
      note: t('status.unmanagedNote', {
        count: countUnmanagedKeys(loaded.data, MANAGED_GLOBAL_PATHS),
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
    { label: t('codex.field.wireApi'), value: blankAsUnset(record.wireApi) },
    {
      label: t('codex.field.requiresOpenaiAuth'),
      value: record.requiresOpenaiAuth ? t('status.yes') : t('status.no'),
      tone: record.requiresOpenaiAuth ? undefined : 'warn',
    },
  ]
  if (record.displayName.length > 0) {
    lines.unshift({ label: t('codex.field.displayName'), value: record.displayName })
  }
  return {
    title: t('status.providerTitle', { name: record.id }),
    lines,
    note: record.problemKey !== undefined ? t(record.problemKey) : undefined,
  }
}

function providerSections(list: ProviderList): StatusSection[] {
  if (!list.parsed) {
    const value = t(list.problemKey ?? 'status.readError', { detail: list.problemDetail ?? '' })
    return [
      {
        title: t('status.providersTitle'),
        lines: [{ label: t('status.error'), value, tone: 'error' }],
      },
    ]
  }
  if (list.records.length === 0) {
    return [{ title: t('status.providersTitle'), lines: [], note: t('codex.status.noProviders') }]
  }
  return list.records.map(providerSection)
}

/** The live credential, and every profile ccset can switch to. */
function authSection(auth: AuthState): StatusSection {
  const lines: StatusLine[] = [{ label: t('status.path'), value: auth.path }]
  if (!auth.exists) {
    lines.push({ label: t('status.present'), value: t('status.absent'), tone: 'warn' })
  } else {
    lines.push({ label: t('status.mode'), value: auth.mode })
    lines.push({ label: t('codex.status.authMode'), value: blankAsUnset(auth.authMode) })
    lines.push({ label: t('codex.field.apiKey'), value: blankAsUnset(maskSecret(auth.apiKey)) })
    lines.push({
      label: t('codex.status.activeProfile'),
      value: auth.activeName ?? t('codex.status.noActiveProfile'),
    })
  }
  return { title: t('codex.status.authTitle'), lines, note: t('codex.status.authNote') }
}

function profileSection(auth: AuthState): StatusSection {
  const lines: StatusLine[] = auth.profiles.map((profile) => ({
    label: profile.name,
    value: profile.readable ? blankAsUnset(maskSecret(profile.apiKey)) : t('status.unreadable'),
    tone: profile.readable ? undefined : ('error' as const),
  }))
  return {
    title: t('codex.status.profilesTitle'),
    lines,
    note: lines.length === 0 ? t('codex.status.noProfiles') : t('codex.status.profilesNote'),
  }
}

/**
 * A keyring-backed credential store means Codex never reads auth.json, so every
 * profile ccset can offer would be ignored. Saying so is the only honest thing
 * to do: switching would appear to work and change nothing.
 */
function keyringSection(): StatusSection {
  return {
    title: t('codex.status.keyringTitle'),
    lines: [{ label: t('codex.status.keyringLabel'), value: AUTH_STORE_KEYRING, tone: 'warn' }],
    note: t('codex.status.keyringNote'),
  }
}

/**
 * CODEX_HOME points Codex somewhere else, so the files ccset is about to write
 * are not the ones it reads. Reported rather than followed -- see the note on
 * codexHomeOverride for why ccset must not chase the variable itself.
 */
function homeOverrideSection(override: string): StatusSection {
  return {
    title: t('codex.status.homeOverrideTitle'),
    lines: [{ label: t('codex.status.homeOverrideLabel'), value: override, tone: 'warn' }],
    note: t('codex.status.homeOverrideNote'),
  }
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

async function readAuthStore(ctx: Ctx): Promise<boolean> {
  try {
    const loaded = await readConfigFile(codexConfigFile(ctx.home))
    return jsonToText(getPath(loaded.data, AUTH_STORE_KEY)) === AUTH_STORE_KEYRING
  } catch {
    return false
  }
}

/** Reads everything, writes nothing. */
export async function buildStatus(ctx: Ctx): Promise<StatusData> {
  const [providers, global, auth, backups, keyringInUse] = await Promise.all([
    loadProviders(ctx),
    globalSection(ctx),
    loadAuthState(ctx),
    backupSection(ctx),
    readAuthStore(ctx),
  ])
  const homeOverride = codexHomeOverride(ctx.home)
  const sections = [global, ...providerSections(providers), authSection(auth), profileSection(auth)]
  if (homeOverride !== null) sections.push(homeOverrideSection(homeOverride))
  if (keyringInUse) sections.push(keyringSection())
  sections.push(backups)
  return { sections, providers, auth, keyringInUse, homeOverride }
}
