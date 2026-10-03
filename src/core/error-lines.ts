import { t } from '../i18n/index.js'
import { BackupCleanupError, PartialCommitError, type CcsetError } from './errors.js'

/** Keep recovery facts identical in human CLI output and TUI error Screens. */
export function errorLines(error: CcsetError): string[] {
  const lines = [t(error.messageKey, error.params)]
  if (error instanceof BackupCleanupError) {
    lines.push(...error.failures.map((failure) => t(failure.messageKey, failure.params)))
    lines.push(t('error.backupCleanupRetry'))
  }
  if (error instanceof PartialCommitError) {
    const changed = error.committed.filter((record) => record.changed)
    lines.push(t('cli.partialCommit', { paths: changed.map((record) => record.path).join(', ') }))
    for (const record of changed) {
      if (record.backupPath !== null) lines.push(t('write.backup', { path: record.backupPath }))
    }
    if (error.rollback !== undefined) {
      lines.push(t('error.rollbackFailed', { message: t(error.rollback.messageKey, error.rollback.params) }))
    }
  }
  return lines
}
