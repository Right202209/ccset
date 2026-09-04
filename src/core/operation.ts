import type { ConfigFile, JsonObject, JsonValue } from '../types.js'
import { ConfigParseError, EXIT_OK, wrapFsError } from './errors.js'
import { applyManagedWrites, type ManagedWrite } from './merge.js'
import { backupFile } from './backup.js'
import { emptyConfig, readConfigFile, writeConfigFile, type LoadedConfig } from './config-file.js'
import { readMode } from './json-file.js'

// ── Types ────────────────────────────────────────────────────────────

/** Operations the seam implements; widened as further commands land. */
export type OperationId = 'global.set'

/**
 * A normalized request. Values are keyed by field id and already converted to
 * their JSON shape by the agent's command declaration; removal is explicit via
 * `unset`, never an empty value. No `ManagedWrite`, no translated text, and no
 * form object crosses the seam in either direction.
 */
export interface OperationRequest {
  operation: OperationId
  agentId: string
  values: Record<string, JsonValue>
  unset: Set<string>
  dryRun: boolean
  replaceInvalid: boolean
}

/**
 * The agent-supplied parameters the pipeline drives: where the target lives,
 * where its backups go, and how normalized values become the managed writes
 * the merge applies. The conversion keeps `ManagedWrite[]` inside the agent
 * and the core-merge internals; it never appears in a request or a result.
 */
export interface OperationDescriptor {
  target: ConfigFile
  backupDir: string
  toWrites: (values: Record<string, JsonValue>, unset: Set<string>) => ManagedWrite[]
}

export interface TargetResult {
  path: string
  changed: boolean
  mode: string
  backupPath: string | null
}

export interface OperationWarning {
  code: string
  params?: Record<string, string>
}

export interface OperationResult {
  operation: OperationId
  agentId: string
  changed: boolean
  dryRun: boolean
  targets: TargetResult[]
  warnings: OperationWarning[]
  exitCode: number
}

// ── Pipeline ─────────────────────────────────────────────────────────

/** Serialise a JSON object for comparison; order-sensitive but deterministic. */
function renderJson(data: JsonObject): string {
  return `${JSON.stringify(data, null, 2)}\n`
}

/** Compare the base a read produced with the overlay to detect a no-op. */
function isNoop(base: LoadedConfig, merged: JsonObject): boolean {
  return renderJson(base.data) === renderJson(merged)
}

/** The target record for a plan that stopped before any write: real mode, no backup. */
async function plannedTarget(path: string, changed: boolean): Promise<TargetResult> {
  return { path, changed, mode: await readMode(path), backupPath: null }
}

/** The one place an OperationResult is assembled, so every path reports alike. */
function buildResult(
  req: OperationRequest,
  changed: boolean,
  targets: TargetResult[],
  warnings: OperationWarning[],
): OperationResult {
  return {
    operation: req.operation,
    agentId: req.agentId,
    changed,
    dryRun: req.dryRun,
    targets,
    warnings,
    exitCode: EXIT_OK,
  }
}

/**
 * Read the target. A malformed target is refused unless recovery was
 * requested, in which case the read is replaced by an empty base and the plan
 * carries the warning the presenter renders.
 */
async function readBase(
  op: OperationDescriptor,
  req: OperationRequest,
  warnings: OperationWarning[],
): Promise<LoadedConfig> {
  try {
    return await readConfigFile(op.target)
  } catch (err) {
    if (err instanceof ConfigParseError && req.replaceInvalid) {
      warnings.push({ code: 'replacedInvalid', params: { path: op.target.path } })
      return emptyConfig(op.target.path)
    }
    throw err
  }
}

/**
 * The deep operation seam. Accepts a normalized request plus the agent's
 * descriptor and returns a machine-readable result or a typed error. Hides
 * read → overlay → validate → plan → apply, codec details, backups, and
 * atomic writes behind one entry point.
 */
export async function runOperation(
  req: OperationRequest,
  op: OperationDescriptor,
): Promise<OperationResult> {
  const path = op.target.path
  const warnings: OperationWarning[] = []

  // 1. Read.
  const base = await readBase(op, req, warnings)

  // 2. Overlay — the agent converts normalized values, the core merges them.
  const writes = op.toWrites(req.values, req.unset)
  const merged = applyManagedWrites(base.data, writes)

  // 3. Plan — idempotency is decided before anything touches the disk.
  const changed = !isNoop(base, merged)

  // 4. A dry run has done every read and check; it stops before backup/write.
  //    The mode is a read-only stat, so reporting it breaks nothing.
  if (req.dryRun) {
    return buildResult(req, changed, [await plannedTarget(path, changed)], warnings)
  }

  // 5. No-op — no backup, no write, nothing rotated.
  if (!changed) {
    return buildResult(req, false, [await plannedTarget(path, false)], warnings)
  }

  // 6. Backup, then the atomic write.
  const backupPath = await backupFile(op.backupDir, path)
  try {
    await writeConfigFile(op.target, base, writes)
  } catch (err) {
    throw wrapFsError(err, path, 'rw')
  }

  return buildResult(req, true, [
    { path, changed: true, mode: await readMode(path), backupPath },
  ], warnings)
}
