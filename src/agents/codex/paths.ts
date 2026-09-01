import path from 'node:path'
import { backupsDirFor } from '../../core/paths.js'

/**
 * Codex CLI's file layout. Two files matter and they are different in kind:
 * `config.toml` is the settings document, and `auth.json` is the live
 * credential Codex reads at start and rewrites on login.
 *
 * `auth.<name>.json` is ccset's own convention, not Codex's. Codex opens
 * `auth.json` by exact name and never scans the directory, so a sidecar beside
 * it is inert until ccset copies it into place.
 */

export const CODEX_DIR_SEGMENTS = ['.codex']
export const CODEX_CONFIG_FILE = 'config.toml'
export const CODEX_AUTH_FILE = 'auth.json'

const AUTH_PREFIX = 'auth.'
const AUTH_SUFFIX = '.json'

export function codexDir(home: string): string {
  return path.join(home, ...CODEX_DIR_SEGMENTS)
}

export function codexConfigPath(home: string): string {
  return path.join(codexDir(home), CODEX_CONFIG_FILE)
}

/** The credential Codex actually reads. ccset replaces it, never edits it. */
export function codexAuthPath(home: string): string {
  return path.join(codexDir(home), CODEX_AUTH_FILE)
}

export function authProfilePath(home: string, name: string): string {
  return path.join(codexDir(home), `${AUTH_PREFIX}${name}${AUTH_SUFFIX}`)
}

/**
 * The naming rule for discovery. `auth.json` itself is deliberately excluded:
 * it is the live file, not a saved profile, and listing it as one would offer
 * the user a "switch" that copies the file over itself.
 */
export function authProfileName(fileName: string): string | null {
  if (fileName === CODEX_AUTH_FILE) return null
  if (!fileName.startsWith(AUTH_PREFIX) || !fileName.endsWith(AUTH_SUFFIX)) return null
  const name = fileName.slice(AUTH_PREFIX.length, fileName.length - AUTH_SUFFIX.length)
  return name.length === 0 ? null : name
}

export function backupsDir(home: string): string {
  return backupsDirFor(codexDir(home))
}

/**
 * Codex resolves its directory from `CODEX_HOME`, and ccset resolves it from
 * the home the run was given, so the two can disagree. A save would then land
 * in a file Codex never reads, which is reported rather than silently written
 * -- the same treatment opencode's `.jsonc` gets.
 *
 * ccset deliberately does not follow the variable. Every fixture and every
 * scratch run points ccset at a temporary home, and a `CODEX_HOME` inherited
 * from the surrounding shell would take writes straight back out of it.
 */
export function codexHomeOverride(home: string): string | null {
  const override = process.env['CODEX_HOME']
  if (override === undefined || override.length === 0) return null
  return path.resolve(override) === path.resolve(codexDir(home)) ? null : override
}

/** Codex reads both files on start; there is no flag ccset has to construct. */
export function launchCommand(): string {
  return 'codex'
}
