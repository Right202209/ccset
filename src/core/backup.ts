import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  BACKUP_INFIX,
  FILE_MODE,
  MAX_BACKUPS,
  MAX_BACKUP_NAME_ATTEMPTS,
} from './constants.js'
import { isNotFound, wrapFsError } from './errors.js'
import { ensureDir, fileExists } from './json-file.js'
import { backupsDir } from './paths.js'

/**
 * Backups live in a ccset-owned subdirectory rather than the shared
 * ~/.claude/backups: Claude Code prunes that directory by an unknown rule, and
 * a backup scheme that silently loses backups is worse than none.
 */
export async function backupFile(home: string, filePath: string): Promise<string | null> {
  if (!(await fileExists(filePath))) return null
  const dir = backupsDir(home)
  await ensureDir(dir)
  const basename = path.basename(filePath)
  const destination = await uniqueBackupPath(dir, basename)
  try {
    await fs.copyFile(filePath, destination)
    await fs.chmod(destination, FILE_MODE).catch(() => undefined)
  } catch (err) {
    throw wrapFsError(err, destination, 'rw')
  }
  await pruneBackups(dir, basename)
  return destination
}

/** Two writes inside the same millisecond must not overwrite each other. */
async function uniqueBackupPath(dir: string, basename: string): Promise<string> {
  const stamp = Date.now()
  const base = path.join(dir, `${basename}${BACKUP_INFIX}${stamp}`)
  if (!(await fileExists(base))) return base
  for (let attempt = 1; attempt < MAX_BACKUP_NAME_ATTEMPTS; attempt += 1) {
    const candidate = `${base}-${attempt}`
    if (!(await fileExists(candidate))) return candidate
  }
  return `${base}-${process.pid}`
}

interface BackupEntry {
  name: string
  order: number
}

/**
 * Pruning is per configuration file, so filling the quota with settings.json
 * writes cannot evict a provider file's only backup.
 */
export async function pruneBackups(dir: string, basename: string): Promise<void> {
  const entries = await listBackupEntries(dir, `${basename}${BACKUP_INFIX}`)
  const excess = entries.length - MAX_BACKUPS
  if (excess <= 0) return
  entries.sort((a, b) => a.order - b.order)
  for (const entry of entries.slice(0, excess)) {
    await fs.unlink(path.join(dir, entry.name)).catch(() => undefined)
  }
}

async function listBackupEntries(dir: string, prefix: string): Promise<BackupEntry[]> {
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch (err) {
    if (isNotFound(err)) return []
    throw wrapFsError(err, dir, 'r')
  }
  return names
    .filter((name) => name.startsWith(prefix))
    .map((name) => ({ name, order: backupOrder(name, prefix) }))
}

/** Sorts by the epoch stamp; the -N collision suffix breaks ties. */
function backupOrder(name: string, prefix: string): number {
  const suffix = name.slice(prefix.length)
  const stamp = Number.parseInt(suffix, 10)
  return Number.isNaN(stamp) ? 0 : stamp
}

export async function countBackups(home: string): Promise<number> {
  const entries = await listBackupEntries(backupsDir(home), '')
  return entries.filter((entry) => entry.name.includes(BACKUP_INFIX)).length
}

/**
 * Rotating a token leaves the old one readable in a backup until this runs.
 * Only ccset-created backup files are removed; anything else in the directory
 * is left alone.
 */
export async function clearBackups(home: string): Promise<number> {
  const dir = backupsDir(home)
  const entries = await listBackupEntries(dir, '')
  let removed = 0
  for (const entry of entries) {
    if (!entry.name.includes(BACKUP_INFIX)) continue
    await fs.unlink(path.join(dir, entry.name)).catch(() => undefined)
    removed += 1
  }
  return removed
}
