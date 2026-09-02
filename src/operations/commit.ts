import { backupFile } from '../core/backup.js'
import {
  emptyConfig,
  readConfigFile,
  renderConfigFile,
  type LoadedConfig,
} from '../core/config-file.js'
import { FILE_MODE } from '../core/constants.js'
import { CcsetError, ConfigParseError, EXIT_RUNTIME, PartialCommitError, toCcsetError } from '../core/errors.js'
import { readMode, writeTextAtomic } from '../core/json-file.js'
import type { ManagedWrite } from '../core/merge.js'
import type { ConfigFile, WriteReport } from '../types.js'
import type { TargetRecord } from './types.js'

/**
 * The plan/apply core every save shares, TUI form and Non-interactive command
 * alike. `planTargets` renders the exact bytes a write list would put on disk
 * and detects a no-op; `applyPlan` commits them in order, each after its own
 * backup, atomically at 0600. There is no cross-file transaction: a failure
 * after the first commit is reported as partial, naming what already landed.
 */

export interface PlanInput {
  file: ConfigFile
  /** The base read from disk, or an empty base for a confirmed replacement. */
  base: LoadedConfig
  writes: ManagedWrite[]
  backupsDir: string
}

export interface WriteTarget {
  file: ConfigFile
  backupsDir: string
  /** The exact bytes the operation intends on disk. */
  rendered: string
  exists: boolean
  /** False: the plan changes nothing, so a command must not write or back up. */
  changed: boolean
}

export interface ApplyOptions {
  /** Reads and planning without backups or writes; records report intent. */
  dryRun: boolean
  /**
   * Commands skip a target whose bytes would not change. The TUI save keeps
   * its write-every-time behavior -- its fixture pins the backup that makes.
   */
  skipUnchanged: boolean
}

export interface ApplyOutcome {
  changed: boolean
  records: TargetRecord[]
}

const EMPTY_JSON_DOCUMENT = '{}\n'
/** What writeTextAtomic would leave on a POSIX disk; chmod is best-effort on win32. */
const MODE_AFTER_WRITE = `0${FILE_MODE.toString(8)}`

function isEmptyDocument(codec: ConfigFile['codec'], rendered: string): boolean {
  return codec === 'toml' ? rendered.length === 0 : rendered === EMPTY_JSON_DOCUMENT
}

/**
 * A target that does not exist and would receive an empty document is left
 * absent: configuring nothing is not a reason to create an empty file.
 */
function isNoOp(base: LoadedConfig, codec: ConfigFile['codec'], rendered: string): boolean {
  if (!base.exists) return isEmptyDocument(codec, rendered)
  return rendered === base.raw
}

/**
 * Reads a patch target, honoring the confirmed replacement policy. A file
 * that exists but does not parse is refused -- ccset never silently discards
 * data it could not parse -- unless the caller passed --replace-invalid for a
 * target it can reconstruct, in which case the merge starts from an empty
 * base and the unreadable original survives in the backup.
 */
export async function readPatchBase(file: ConfigFile, allowReplace: boolean): Promise<LoadedConfig> {
  try {
    return await readConfigFile(file)
  } catch (err) {
    if (allowReplace && err instanceof ConfigParseError) return emptyConfig(file.path)
    throw err
  }
}

export function planTargets(inputs: PlanInput[]): WriteTarget[] {
  return inputs.map((input) => {
    const rendered = renderConfigFile(input.file, input.base, input.writes)
    return {
      file: input.file,
      backupsDir: input.backupsDir,
      rendered,
      exists: input.base.exists,
      changed: !isNoOp(input.base, input.file.codec, rendered),
    }
  })
}

async function recordWithoutWrite(target: WriteTarget, effective: boolean): Promise<TargetRecord> {
  return {
    path: target.file.path,
    mode: effective ? MODE_AFTER_WRITE : await readMode(target.file.path),
    backupPath: null,
    changed: effective,
  }
}

/** Nothing had landed yet, so the failure is simply the failure. */
function commitFailure(committed: TargetRecord[], err: unknown): CcsetError {
  const cause = toCcsetError(err)
  return committed.length === 0 ? cause : new PartialCommitError(committed, cause)
}

export async function applyPlan(targets: WriteTarget[], options: ApplyOptions): Promise<ApplyOutcome> {
  const records: TargetRecord[] = []
  let changed = false
  for (const target of targets) {
    const effective = target.changed || !options.skipUnchanged
    if (options.dryRun || !effective) {
      records.push(await recordWithoutWrite(target, effective))
      changed = changed || effective
      continue
    }
    try {
      const backupPath = await backupFile(target.backupsDir, target.file.path)
      await writeTextAtomic(target.file.path, target.rendered)
      records.push({
        path: target.file.path,
        mode: await readMode(target.file.path),
        backupPath,
        changed: true,
      })
      changed = true
    } catch (err) {
      throw commitFailure(records, err)
    }
  }
  return { changed, records }
}

/**
 * The one-target commit the TUI save paths go through: plan, apply, and shape
 * the record as the report a success Screen renders. The command layer uses
 * planTargets/applyPlan directly so every target's record survives.
 */
export async function commitOne(
  input: PlanInput,
  options: ApplyOptions = { dryRun: false, skipUnchanged: false },
): Promise<Pick<WriteReport, 'path' | 'mode' | 'backupPath'>> {
  const record = (await applyPlan(planTargets([input]), options)).records[0]
  if (record === undefined) {
    throw new CcsetError('error.unexpected', EXIT_RUNTIME, { detail: 'no target was planned' })
  }
  return { path: record.path, mode: record.mode, backupPath: record.backupPath }
}
