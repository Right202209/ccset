import { isLocale } from '../i18n/index.js'
import { SETTINGS_VERSION } from './constants.js'
import type { LoadedFile } from './json-file.js'
import { jsonFile, readJsonFile, writeJsonFileAtomic } from './json-file.js'
import { settingsFilePath } from './paths.js'

/**
 * The locale preference in `<home>/.ccset/settings.json` (ADR 0004) -- ccset's
 * first owned settings file; until now everything it wrote belonged to an agent
 * or was a backup. It is written through the same atomic machinery as agent
 * configs: temp file, rename, 0600, into a 0700 directory.
 *
 * Anything the file could be besides a carried locale -- missing, malformed,
 * non-object, the wrong schema version, a missing or unknown tag -- reads as
 * *unchosen*, never as an error. A broken two-line file must not break the
 * tool, and the next successful choice replaces it wholesale.
 */

/** The saved locale, or null when no valid preference is on disk. */
export async function readSavedLocale(home: string): Promise<string | null> {
  let loaded: LoadedFile
  try {
    loaded = await readJsonFile(settingsFilePath(home))
  } catch {
    return null // unchosen, not an error: the next choice replaces the file
  }
  if (!loaded.exists) return null
  if (loaded.data['version'] !== SETTINGS_VERSION) return null
  const locale = loaded.data['locale']
  if (typeof locale !== 'string' || !isLocale(locale)) return null
  return locale
}

/**
 * Persists the choice atomically, replacing whatever the file held. The caller
 * owns the warning: a failure keeps the choice for this session either way.
 */
export async function saveLocale(home: string, locale: string): Promise<void> {
  await writeJsonFileAtomic(jsonFile(settingsFilePath(home)), {
    version: SETTINGS_VERSION,
    locale,
  })
}
