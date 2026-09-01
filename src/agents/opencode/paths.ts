import path from 'node:path'
import { backupsDirFor } from '../../core/paths.js'

/**
 * opencode's file layout. Unlike Claude Code it keeps every provider inside
 * one document, so there is no per-provider file and no glob discovery: the
 * provider list comes from the keys of `provider` in this single file.
 *
 * XDG_CONFIG_HOME is honoured because opencode honours it; ccset resolves it
 * against the same home the rest of the run uses, so a scratch home stays a
 * scratch home even when the variable is set.
 */

export const OPENCODE_DIR_SEGMENTS = ['.config', 'opencode']
export const OPENCODE_CONFIG_FILE = 'opencode.json'
/**
 * opencode also loads a JSONC variant, and its schema sets `allowComments`.
 * ccset parses strict JSON and cannot round-trip a comment, so it never writes
 * this file -- it only reports that the file is there, because a write to
 * opencode.json may not be the file opencode ends up loading.
 */
export const OPENCODE_JSONC_FILE = 'opencode.jsonc'

export function opencodeDir(home: string): string {
  return path.join(home, ...OPENCODE_DIR_SEGMENTS)
}

export function opencodeConfigPath(home: string): string {
  return path.join(opencodeDir(home), OPENCODE_CONFIG_FILE)
}

export function opencodeJsoncPath(home: string): string {
  return path.join(opencodeDir(home), OPENCODE_JSONC_FILE)
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
