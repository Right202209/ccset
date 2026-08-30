import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import {
  BACKUPS_DIR_SEGMENTS,
  CLAUDE_DIR_NAME,
  CLAUDE_STATE_FILE,
  GLOBAL_SETTINGS_FILE,
  SETTINGS_PREFIX,
  SETTINGS_SUFFIX,
} from './constants.js'
import { isNotFound, wrapFsError } from './errors.js'

/** CCSET_HOME exists so a test run can be pointed at a scratch directory. */
export function resolveHome(): string {
  const override = process.env.CCSET_HOME
  return override && override.length > 0 ? override : os.homedir()
}

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
  return path.join(claudeDir(home), ...BACKUPS_DIR_SEGMENTS)
}

/** The command that actually activates a settings file (PRD 9.1). */
export function activationCommand(settingsPath: string): string {
  return `claude --settings ${path.resolve(settingsPath)}`
}

export interface ProviderFileRef {
  name: string
  path: string
}

/**
 * The filesystem is the only registry (PRD 4.2.4): every settings.*.json other
 * than settings.json itself is a provider file, whoever created it.
 */
export async function listProviderFiles(home: string): Promise<ProviderFileRef[]> {
  const dir = claudeDir(home)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (err) {
    if (isNotFound(err)) return []
    throw wrapFsError(err, dir, 'r')
  }
  return entries
    .map((entry) => ({ name: providerNameFromFile(entry), path: path.join(dir, entry) }))
    .filter((ref): ref is ProviderFileRef => ref.name !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Returns the provider name, or null when the filename is not a provider file. */
function providerNameFromFile(fileName: string): string | null {
  if (fileName === GLOBAL_SETTINGS_FILE) return null
  if (!fileName.startsWith(SETTINGS_PREFIX)) return null
  if (!fileName.endsWith(SETTINGS_SUFFIX)) return null
  const name = fileName.slice(SETTINGS_PREFIX.length, fileName.length - SETTINGS_SUFFIX.length)
  return name.length > 0 ? name : null
}
