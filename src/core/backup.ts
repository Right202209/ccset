import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  BACKUP_INFIX,
  BACKUP_TEMP_PREFIX,
  FILE_MODE,
  MAX_BACKUPS,
  MAX_BACKUP_NAME_ATTEMPTS,
} from './constants.js'
import { isNotFound, wrapFsError } from './errors.js'
import { t } from '../i18n/index.js'
import { ensureDir, fileExists } from './json-file.js'
import type { StatusSection } from '../types.js'

/**
 * Backups live in a ccset-owned directory rather than one the agent prunes:
 * Claude Code prunes ~/.claude/backups by an unknown rule, and a backup scheme
 * that silently loses backups is worse than none. The directory is passed in
 * because it belongs to the agent, not to the core.
 *
 * The copy lands on a temp name and is renamed into place, for the same reason
 * writeJsonFileAtomic does it: fs.copyFile is not atomic, and a crash partway
 * through would otherwise leave a truncated file under a real backup name,
 * indistinguishable from a complete one. The backup is the only copy of the
 * original when a save goes wrong, so a silently truncated one is the failure
 * this whole directory exists to avoid.
 */
export async function backupFile(dir: string, filePath: string): Promise<string | null> {
  if (!(await fileExists(filePath))) return null
  await ensureDir(dir)
  const basename = path.basename(filePath)
  const destination = await uniqueBackupPath(dir, basename)
  const pending = path.join(dir, `${BACKUP_TEMP_PREFIX}${basename}.${process.pid}`)
  try {
    await fs.copyFile(filePath, pending)
    await fs.chmod(pending, FILE_MODE).catch(() => undefined)
    await fs.rename(pending, destination)
  } catch (err) {
    await fs.unlink(pending).catch(() => undefined)
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

/** A finished backup, or the partial copy left by a crash mid-backup. Both
 *  hold the credential that was in the file, so both are ccset's to clean up. */
function isCcsetBackup(name: string): boolean {
  return name.includes(BACKUP_INFIX) || name.startsWith(BACKUP_TEMP_PREFIX)
}

/** Counts the directory entries a predicate keeps: the finished backups and
 *  the partial copies are the same listing with different name rules. */
async function countEntries(dir: string, keep: (name: string) => boolean): Promise<number> {
  const entries = await listBackupEntries(dir, '')
  return entries.filter((entry) => keep(entry.name)).length
}

export async function countBackups(dir: string): Promise<number> {
  return countEntries(dir, (name) => name.includes(BACKUP_INFIX))
}

/** A partial copy holds the same credential a finished backup does, but no
 *  write ever lands on its name, so it only ever appears after a crash. */
export async function countPartialBackups(dir: string): Promise<number> {
  return countEntries(dir, (name) => name.startsWith(BACKUP_TEMP_PREFIX))
}

/**
 * The read-only backups section every agent's Status shows, so a partial copy
 * is surfaced the same way everywhere it can exist. It holds the credential it
 * was copying, which makes hiding it until Clear backups a reporting failure.
 */
export async function backupStatusSection(dir: string): Promise<StatusSection> {
  const [count, partials] = await Promise.all([countBackups(dir), countPartialBackups(dir)])
  const lines: StatusSection['lines'] = [
    { label: t('status.path'), value: dir },
    { label: t('status.count'), value: String(count) },
  ]
  if (partials > 0) {
    lines.push({ label: t('status.partials'), value: String(partials), tone: 'warn' })
  }
  return {
    title: t('status.backupsTitle'),
    lines,
    note: partials > 0 ? t('status.partialsNote', { count: partials }) : t('status.backupsNote'),
  }
}

/**
 * Rotating a token leaves the old one readable in a backup until this runs.
 * Only ccset-created backup files are removed -- including a partial copy from
 * an interrupted backup, which holds the same token -- and anything else in the
 * directory is left alone.
 */
export async function clearBackups(dir: string): Promise<number> {
  const entries = await listBackupEntries(dir, '')
  let removed = 0
  for (const entry of entries) {
    if (!isCcsetBackup(entry.name)) continue
    await fs.unlink(path.join(dir, entry.name)).catch(() => undefined)
    removed += 1
  }
  return removed
}
