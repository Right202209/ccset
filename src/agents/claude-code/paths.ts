import path from 'node:path'
import { backupsDirFor, listNamedFiles, type NamedFileRef } from '../../core/paths.js'

/**
 * Claude Code's file layout, declared once. Everything here was in core/paths
 * until a second agent showed that none of it generalises: another agent has a
 * different directory, a different filename convention, and no equivalent of
 * ~/.claude.json at all.
 */

export const CLAUDE_DIR_NAME = '.claude'
export const CLAUDE_STATE_FILE = '.claude.json'
export const GLOBAL_SETTINGS_FILE = 'settings.json'
export const SETTINGS_PREFIX = 'settings.'
export const SETTINGS_SUFFIX = '.json'

/** Names that would collide with a file Claude Code uses conventionally. */
export const RESERVED_PROVIDER_NAMES = ['local', 'json']

export function claudeDir(home: string): string {
  return path.join(home, CLAUDE_DIR_NAME)
}

export function claudeStatePath(home: string): string {
  return path.join(home, CLAUDE_STATE_FILE)
}

export function globalSettingsPath(home: string): string {
  return path.join(claudeDir(home), GLOBAL_SETTINGS_FILE)
}

export function providerSettingsPath(home: string, name: string): string {
  return path.join(claudeDir(home), `${SETTINGS_PREFIX}${name}${SETTINGS_SUFFIX}`)
}

export function backupsDir(home: string): string {
  return backupsDirFor(claudeDir(home))
}

/** The command that actually activates a settings file (PRD 9.1). */
export function activationCommand(settingsPath: string): string {
  return `claude --settings ${path.resolve(settingsPath)}`
}

/** Returns the provider name, or null when the filename is not a provider file. */
function providerNameFromFile(fileName: string): string | null {
  if (fileName === GLOBAL_SETTINGS_FILE) return null
  if (!fileName.startsWith(SETTINGS_PREFIX)) return null
  if (!fileName.endsWith(SETTINGS_SUFFIX)) return null
  const name = fileName.slice(SETTINGS_PREFIX.length, fileName.length - SETTINGS_SUFFIX.length)
  return name.length > 0 ? name : null
}

/**
 * The filesystem is the only registry (PRD 4.2.4): every settings.*.json other
 * than settings.json itself is a provider file, whoever created it.
 */
export async function listProviderFiles(home: string): Promise<NamedFileRef[]> {
  return listNamedFiles(claudeDir(home), providerNameFromFile)
}
