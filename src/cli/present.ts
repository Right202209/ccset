import type { OperationResult } from '../core/operation.js'
import type { CcsetError, UsageProblem } from '../core/errors.js'
import { OperationError } from '../core/errors.js'
import { MODE_UNKNOWN } from '../core/constants.js'
import { t } from '../i18n/index.js'

// ── Human output ─────────────────────────────────────────────────────

/**
 * Line-oriented human output. No ANSI, no Ink, no i18n keys in the result.
 * Written to stdout; warnings and errors go to stderr.
 */
export function presentHuman(result: OperationResult): void {
  for (const target of result.targets) {
    const line = result.dryRun && target.changed
      ? t('output.wouldChange', { path: target.path })
      : target.changed
        ? t('output.changed', { path: target.path })
        : t('output.unchanged', { path: target.path })
    process.stdout.write(`${line}\n`)
    if (target.mode !== MODE_UNKNOWN) {
      process.stdout.write(`${t('write.mode', { mode: target.mode })}\n`)
    }
    if (target.backupPath !== null) {
      process.stdout.write(`${t('write.backup', { path: target.backupPath })}\n`)
    }
  }

  if (result.dryRun) {
    process.stdout.write(`${t('output.dryRun')}\n`)
  }

  for (const warning of result.warnings) {
    process.stderr.write(`${t(`warn.${warning.code}`, warning.params)}\n`)
  }
}

/** Translation of one structured problem — the only place problems render. */
function problemText(problem: UsageProblem): string {
  return t(problem.code, problem.params)
}

/**
 * Present a fatal error in human-readable form to stderr. A usage error lists
 * every problem it collected; anything else is a single translated line.
 */
export function presentErrorHuman(err: CcsetError): void {
  if (err instanceof OperationError && err.problems.length > 1) {
    for (const problem of err.problems) {
      process.stderr.write(`${problemText(problem)}\n`)
    }
    return
  }
  process.stderr.write(`${t(err.messageKey, err.params)}\n`)
}

// ── JSON output ──────────────────────────────────────────────────────

interface JsonEnvelope {
  schemaVersion: 1
  operation: string
  agentId: string
  changed: boolean
  dryRun: boolean
  targets: JsonTarget[]
  warnings: JsonWarning[]
  exitCode: number
}

interface JsonTarget {
  path: string
  changed: boolean
  mode: string
  backupPath: string | null
}

interface JsonWarning {
  code: string
  params?: Record<string, string>
}

/**
 * Single additive JSON envelope on stdout. Secret-free. Schema version 1.
 */
export function presentJson(result: OperationResult): void {
  const envelope: JsonEnvelope = {
    schemaVersion: 1,
    operation: result.operation,
    agentId: result.agentId,
    changed: result.changed,
    dryRun: result.dryRun,
    targets: result.targets.map((target) => ({
      path: target.path,
      changed: target.changed,
      mode: target.mode,
      backupPath: target.backupPath,
    })),
    warnings: result.warnings.map((warning) => ({
      code: warning.code,
      ...(warning.params !== undefined ? { params: warning.params } : {}),
    })),
    exitCode: result.exitCode,
  }
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`)
}

/** What the caller knew when the failure happened, so the envelope can name it. */
export interface ErrorContext {
  operation?: string
  agentId?: string
  dryRun?: boolean
}

interface JsonErrorBody {
  /** Stable machine code, independent of locale. */
  code: string
  message: string
  /** The primary reason as code + params, translatable through t(). */
  reason: { code: string, params: Record<string, string> }
  /** Every collected problem, for a usage error that found several. */
  problems: { code: string, params: Record<string, string> }[]
}

function errorBody(err: CcsetError): JsonErrorBody {
  const problems: UsageProblem[] = err instanceof OperationError
    ? err.problems
    : [{ code: err.messageKey, params: err.params }]
  const first = problems[0] ?? { code: err.messageKey, params: err.params }
  return {
    code: err instanceof OperationError ? err.code : err.messageKey,
    message: problemText(first),
    reason: { code: first.code, params: first.params ?? {} },
    problems: problems.map((problem) => ({
      code: problem.code,
      params: problem.params ?? {},
    })),
  }
}

/**
 * Present a fatal error as a JSON envelope to stdout, with the operation and
 * agent ids and the dry-run state known when it happened (null/false when the
 * failure came before they were).
 */
export function presentErrorJson(err: CcsetError, ctx: ErrorContext = {}): void {
  const envelope = {
    schemaVersion: 1 as const,
    operation: ctx.operation ?? null,
    agentId: ctx.agentId ?? null,
    changed: false,
    dryRun: ctx.dryRun ?? false,
    targets: [] as JsonTarget[],
    warnings: [] as JsonWarning[],
    error: errorBody(err),
    exitCode: err.exitCode,
  }
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`)
}
