import { promises as fs } from 'node:fs'
import type { ConfigFile } from '../types.js'
import { backupFile } from './backup.js'
import { readConfigFile } from './config-file.js'
import { CcsetError, EXIT_RUNTIME, isNotFound, wrapFsError } from './errors.js'
import { fileExists, readMode } from './json-file.js'
import type { ManagedWrite } from './merge.js'
import type { TargetRecord } from './target.js'
import { applyPlan, planTargets } from '../operations/commit.js'

/**
 * Deletion, through the same primitives every write uses. A removal is still a
 * Managed patch -- the manifest defines "not present in the proposed config" as
 * delete -- so a block removed from a shared document goes through the codec
 * and leaves the sibling keys, comments and formatting around it alone, and the
 * backup that makes the deletion recoverable is taken first, never after.
 */

/** What a removal did: one record per path, in the order it touched them. */
export interface RemovalReport {
  changed: boolean
  targets: TargetRecord[]
}

function soleRecord(records: TargetRecord[]): TargetRecord {
  const record = records[0]
  if (record === undefined) {
    throw new CcsetError('error.unexpected', EXIT_RUNTIME, { detail: 'no target was planned' })
  }
  return record
}

/**
 * Removes one managed path from a config document. A path that is not there is
 * a no-op rather than a write: `skipUnchanged` compares the rendered bytes with
 * the disk, so nothing is backed up and nothing is rewritten.
 */
export async function removeConfigPath(
  file: ConfigFile,
  path: string[],
  backupsDir: string,
): Promise<TargetRecord> {
  const writes: ManagedWrite[] = [{ path, value: undefined }]
  const base = await readConfigFile(file)
  const outcome = await applyPlan(planTargets([{ file, base, writes, backupsDir }]), {
    dryRun: false,
    skipUnchanged: true,
  })
  return soleRecord(outcome.records)
}

/**
 * Removes a whole file, backing it up first. The backup is what makes the
 * deletion recoverable, so it is taken before the unlink and never skipped; a
 * target that is already gone is a no-op. The mode is read before the file
 * disappears, because afterwards there is nothing left to read it from.
 */
export async function removeFile(backupsDir: string, target: string): Promise<TargetRecord> {
  if (!(await fileExists(target))) {
    return { path: target, mode: '?', backupPath: null, changed: false }
  }
  const mode = await readMode(target)
  const backupPath = await backupFile(backupsDir, target)
  try {
    await fs.unlink(target)
  } catch (err) {
    if (!isNotFound(err)) throw wrapFsError(err, target, 'rw')
  }
  return { path: target, mode, backupPath, changed: true }
}
