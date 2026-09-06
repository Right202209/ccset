import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { BACKUPS_DIR_SEGMENTS, SETTINGS_DIR_SEGMENTS, SETTINGS_FILE_NAME } from './constants.js'
import { isNotFound, wrapFsError } from './errors.js'

/** CCSET_HOME exists so a test run can be pointed at a scratch directory. */
export function resolveHome(): string {
  const override = process.env.CCSET_HOME
  return override && override.length > 0 ? override : os.homedir()
}

/**
 * Backups live in a ccset-owned subdirectory of the directory they came from,
 * never in a directory the agent itself prunes. Each agent passes its own
 * config root, so one agent's rotation can never evict another's backups.
 */
export function backupsDirFor(configDir: string): string {
  return path.join(configDir, ...BACKUPS_DIR_SEGMENTS)
}

/**
 * ccset's first owned settings file (ADR 0005): under the home this run was
 * given, the way every other path is, so a fixture run cannot touch a real
 * preference and an agent directory is never involved.
 */
export function settingsFilePath(home: string): string {
  return path.join(home, ...SETTINGS_DIR_SEGMENTS, SETTINGS_FILE_NAME)
}

/** One discovered configuration file and the name ccset shows for it. */
export interface NamedFileRef {
  name: string
  path: string
}

/**
 * Lists a directory and keeps the entries a naming rule claims. The rule is the
 * agent's: ccset has no opinion about what a config file is called. A missing
 * directory is not an error -- it is an agent that has not been configured yet.
 */
export async function listNamedFiles(
  dir: string,
  nameOf: (fileName: string) => string | null,
): Promise<NamedFileRef[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (err) {
    if (isNotFound(err)) return []
    throw wrapFsError(err, dir, 'r')
  }
  return entries
    .map((entry) => ({ name: nameOf(entry), path: path.join(dir, entry) }))
    .filter((ref): ref is NamedFileRef => ref.name !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}
