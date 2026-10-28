import { isLocale, type Locale } from '../i18n/index.js'
import { SETTINGS_VERSION } from './constants.js'
import { isPlainObject, jsonFile, readJsonFile, writeJsonFileAtomic } from './json-file.js'
import { settingsFilePath } from './paths.js'
import type { JsonObject } from '../types.js'

/**
 * ccset's own settings document, `<home>/.ccset/settings.json` (ADR 0005). It
 * holds the versioned locale preference and the providers the core user asked
 * ccset to ignore; nothing else ccset writes is ccset's own.
 *
 * Anything the file could be besides a document ccset wrote -- missing,
 * malformed, non-object, the wrong schema version -- reads as empty, never as
 * an error. A broken two-line file must not break the tool, and the next
 * successful write replaces it wholesale. Both writers below re-read first and
 * carry every other key over, so choosing a language cannot drop the ignored
 * providers and ignoring one cannot drop the language.
 */

/** Provider ids the core user asked ccset to ignore, keyed by Agent id. */
export type IgnoredProviders = Record<string, string[]>

export interface SettingsDocument {
  locale: Locale | null
  ignoredProviders: IgnoredProviders
}

const EMPTY_SETTINGS: SettingsDocument = { locale: null, ignoredProviders: {} }

function localeOf(value: unknown): Locale | null {
  return typeof value === 'string' && isLocale(value) ? value : null
}

function stringsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
}

/** One Agent's ids that are not a list of names are dropped, not repaired. */
function ignoredOf(value: unknown): IgnoredProviders {
  if (!isPlainObject(value)) return {}
  const known: IgnoredProviders = {}
  for (const [agentId, ids] of Object.entries(value)) {
    const kept = stringsOf(ids)
    if (kept.length > 0) known[agentId] = kept
  }
  return known
}

export async function readSettings(home: string): Promise<SettingsDocument> {
  let loaded
  try {
    loaded = await readJsonFile(settingsFilePath(home))
  } catch {
    return EMPTY_SETTINGS // unreadable is unchosen, not an error
  }
  if (!loaded.exists) return EMPTY_SETTINGS
  if (loaded.data['version'] !== SETTINGS_VERSION) return EMPTY_SETTINGS
  return {
    locale: localeOf(loaded.data['locale']),
    ignoredProviders: ignoredOf(loaded.data['ignoredProviders']),
  }
}

/**
 * The saved locale, or null when no valid preference is on disk. The settings
 * document's other keys are not this function's business.
 */
export async function readSavedLocale(home: string): Promise<Locale | null> {
  return (await readSettings(home)).locale
}

/** The ids this Agent's provider list must not offer, in the order written. */
export async function readIgnoredProviders(home: string, agentId: string): Promise<string[]> {
  return (await readSettings(home)).ignoredProviders[agentId] ?? []
}

/** What the document holds: an empty collection is absent, never a written key. */
function documentOf(settings: SettingsDocument): JsonObject {
  const ignored = Object.fromEntries(
    Object.entries(settings.ignoredProviders).filter(([, ids]) => ids.length > 0),
  )
  return {
    version: SETTINGS_VERSION,
    ...(settings.locale === null ? {} : { locale: settings.locale }),
    ...(Object.keys(ignored).length === 0 ? {} : { ignoredProviders: ignored }),
  }
}

async function writeSettings(home: string, settings: SettingsDocument): Promise<void> {
  await writeJsonFileAtomic(jsonFile(settingsFilePath(home)), documentOf(settings))
}

/**
 * Persists the choice atomically. The caller owns the warning: a failure keeps
 * the choice for this session either way.
 */
export async function saveLocale(home: string, locale: Locale): Promise<void> {
  const current = await readSettings(home)
  await writeSettings(home, { ...current, locale })
}

/**
 * Records or clears the ignore. Ignoring never touches an Agent's configuration
 * (ADR 0019): it is ccset's own note that the provider should not be offered.
 * The last id removed takes its Agent's key with it, so a document that ignores
 * nothing is a document with no `ignoredProviders` key at all.
 */
export async function setProviderIgnored(
  home: string,
  agentId: string,
  id: string,
  ignored: boolean,
): Promise<void> {
  const current = await readSettings(home)
  const ids = new Set(current.ignoredProviders[agentId] ?? [])
  if (ignored) ids.add(id)
  else ids.delete(id)
  const sorted = [...ids].sort()
  const ignoredProviders: IgnoredProviders = { ...current.ignoredProviders }
  if (sorted.length === 0) delete ignoredProviders[agentId]
  else ignoredProviders[agentId] = sorted
  await writeSettings(home, { ...current, ignoredProviders })
}
