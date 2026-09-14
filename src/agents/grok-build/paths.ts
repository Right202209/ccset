import os from 'node:os'
import path from 'node:path'
import type { ConfigFile } from '../../types.js'
import { backupsDirFor } from '../../core/paths.js'
import { AUTH_FILE_NAME, CONFIG_FILE_NAME, GROK_DIR_SEGMENTS, GROK_HOME_ENV } from './constants.js'

/**
 * Grok Build's file layout. Everything ccset manages lives in one TOML
 * document, config.toml; auth.json is the credential store Grok's own login
 * writes and ccset never edits.
 *
 * Grok resolves its directory from GROK_HOME when set. ccset honours that
 * override, but only when the run points at the real home: a scratch home
 * (CCSET_HOME, or every fixture) keeps its own .grok regardless of what the
 * surrounding shell exports, which is what keeps an inherited variable from
 * taking a run's writes out of the scratch directory.
 */

export function grokDir(home: string): string {
  if (path.resolve(home) !== path.resolve(os.homedir())) {
    return path.join(home, ...GROK_DIR_SEGMENTS)
  }
  const override = process.env[GROK_HOME_ENV]
  if (override !== undefined && override.trim().length > 0) return override
  return path.join(home, ...GROK_DIR_SEGMENTS)
}

export function configPath(home: string): string {
  return path.join(grokDir(home), CONFIG_FILE_NAME)
}

export function authPath(home: string): string {
  return path.join(grokDir(home), AUTH_FILE_NAME)
}

/**
 * config.toml is edited with the format-preserving TOML codec: Grok's own
 * examples carry comments, blank lines and ordered tables, and a
 * parse-and-re-emit codec would delete them on the first save.
 */
export function configFile(home: string): ConfigFile {
  return { path: configPath(home), codec: 'toml' }
}

export function backupsDir(home: string): string {
  return backupsDirFor(grokDir(home))
}

/**
 * There is nothing to activate: Grok reads config.toml on start, and /model or
 * -m overrides the saved default for one session. The command is what the user
 * runs next, not a flag ccset had to construct.
 */
export function launchCommand(): string {
  return 'grok'
}
