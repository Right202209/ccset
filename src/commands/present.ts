import { t } from '../i18n/index.js'
import type { CcsetError, PartialCommitError } from '../core/errors.js'
import type { KeyedStatusSection, OperationResult } from '../operations/types.js'

/**
 * The human presenter: line-oriented, localized, no ANSI, no Ink. Every string
 * resolves through the catalog at this layer only -- the operation hands over
 * records and keyed sections, never sentences.
 */

function backupLine(target: { backupPath: string | null }): string {
  return target.backupPath === null
    ? t('write.noBackup')
    : t('write.backup', { path: target.backupPath })
}

function targetLines(result: OperationResult): string[] {
  return result.targets.flatMap((target) => [
    t('write.path', { path: target.path }),
    t('write.mode', { mode: target.mode }),
    backupLine(target),
  ])
}

function warningLines(warnings: { code: string; params?: Record<string, string> }[]): string[] {
  return warnings.map((warning) =>
    t('cli.warning', { message: t(warning.code, warning.params ?? {}) }),
  )
}

/** Lines for a committed (or dry-run, or no-op) mutation. */
export function humanMutation(result: OperationResult, titleKey: string | undefined): string[] {
  const lines = [
    ...(titleKey === undefined ? [] : [result.dryRun ? t('cli.dryRunTitle') : t(titleKey)]),
    ...targetLines(result),
    t('cli.changed', {
      changed: t(result.changed ? 'status.yes' : 'status.no'),
    }),
    ...warningLines(result.warnings),
  ]
  return lines
}

/** Lines for a status run, from the agent's own keyed rendering of its DTO. */
export function humanStatus(
  result: OperationResult,
  sections: KeyedStatusSection[],
): string[] {
  const lines = sections.flatMap((section) => [
    '',
    t(section.titleKey, section.titleParams ?? {}),
    ...section.lines.map((line) => {
      const value = line.value ?? (line.valueKey !== undefined ? t(line.valueKey) : '')
      return `  ${t(line.labelKey)}: ${value}`
    }),
    ...(section.noteKey !== undefined
      ? [`  ${t(section.noteKey, section.noteParams ?? {})}`]
      : []),
  ])
  return [...lines, ...warningLines(result.warnings), '']
}

/** Failure lines: the error itself, then any paths an earlier commit touched. */
export function humanError(err: CcsetError): string[] {
  const lines = [t(err.messageKey, err.params)]
  const partial = err as PartialCommitError
  if (partial.committed !== undefined && partial.committed.length > 0) {
    lines.push(
      t('cli.partialCommit', { paths: partial.committed.map((record) => record.path).join(', ') }),
    )
  }
  return lines
}
