import os from 'node:os'
import path from 'node:path'
import type { ConfigFile } from '../../types.js'
import { backupsDirFor } from '../../core/paths.js'
import { fileExists } from '../../core/json-file.js'

/**
 * opencode's file layout. Unlike Claude Code it keeps every provider inside
 * one document, so there is no per-provider file and no glob discovery: the
 * provider list comes from the keys of `provider` in this single file.
 *
 * opencode honours XDG_CONFIG_HOME, and so does ccset -- but only when the run
 * is pointed at the real home. A scratch home (CCSET_HOME, or every fixture)
 * keeps its own `.config/opencode` regardless of what the surrounding shell
 * exports, which is what keeps an inherited variable from taking a run's
 * writes out of the scratch directory.
 */

export const OPENCODE_DIR_SEGMENTS = ['.config', 'opencode']
export const OPENCODE_CONFIG_FILE = 'opencode.json'
/**
 * opencode loads both files and merges them per key with the `.jsonc` merged
 * last, so on a conflicting key the `.jsonc` wins -- and opencode itself seeds
 * a `.jsonc` on fresh installs. That makes the `.jsonc` the file opencode
 * prefers, and the one ccset manages when it exists.
 */
export const OPENCODE_JSONC_FILE = 'opencode.jsonc'

export function opencodeDir(home: string): string {
  if (path.resolve(home) !== path.resolve(os.homedir())) {
    return path.join(home, ...OPENCODE_DIR_SEGMENTS)
  }
  const xdg = process.env['XDG_CONFIG_HOME']
  if (xdg !== undefined && xdg.trim().length > 0) return path.join(xdg, 'opencode')
  return path.join(home, ...OPENCODE_DIR_SEGMENTS)
}

export function opencodeConfigPath(home: string): string {
  return path.join(opencodeDir(home), OPENCODE_CONFIG_FILE)
}

export function opencodeJsoncPath(home: string): string {
  return path.join(opencodeDir(home), OPENCODE_JSONC_FILE)
}

/**
 * The managed target: the one file every opencode read and write goes through.
 * When a `.jsonc` exists it is the target -- writing the `.json` beside it
 * would lose every conflicting key to a file ccset does not manage. When only
 * the `.json` exists, nothing changes. ccset never creates a `.jsonc`, never
 * rewrites a legacy `.json`, and ignores `config.json` entirely, as always.
 */
export async function opencodeTarget(home: string): Promise<ConfigFile> {
  const jsonc = opencodeJsoncPath(home)
  if (await fileExists(jsonc)) return { path: jsonc, codec: 'jsonc' }
  return { path: opencodeConfigPath(home), codec: 'json' }
}

export function backupsDir(home: string): string {
  return backupsDirFor(opencodeDir(home))
}

/**
 * There is nothing to activate: opencode reads this path on every start. The
 * command is what the user runs next, not a flag ccset had to construct.
 */
export function launchCommand(): string {
  return 'opencode'
}
