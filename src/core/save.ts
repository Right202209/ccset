import type { ActionResult, WriteReport } from '../types.js'
import { ConfigParseError } from './errors.js'
import { t } from '../i18n/index.js'

/** A write that can be retried against an empty base after a parse failure. */
export type SaveFn = (startFresh: boolean) => Promise<WriteReport>

export function successMessage(titleKey: string, report: WriteReport): ActionResult {
  const lines = [
    t('write.path', { path: report.path }),
    t('write.mode', { mode: report.mode }),
    report.backupPath === null
      ? t('write.noBackup')
      : t('write.backup', { path: report.backupPath }),
    ...(report.notes ?? []),
    '',
    t(report.activateKey ?? 'write.activate'),
    report.command,
  ]
  return { kind: 'message', title: t(titleKey), lines, tone: 'success' }
}

/**
 * A target that is already malformed cannot be merged into, and overwriting it
 * silently would discard keys the user cannot get back (PRD 4.4, exit code 4).
 * The choice is put to the user instead. The wording comes from the error, so
 * a TOML target is described as TOML rather than as JSON.
 */
function freshConfirm(
  titleKey: string,
  save: SaveFn,
  err: ConfigParseError,
  busyLabel: string,
): ActionResult {
  return {
    kind: 'confirm',
    title: t(err.titleKey),
    lines: [
      t(err.messageKey, {
        path: err.params['path'] ?? '',
        position: err.params['position'] ?? '',
      }),
      '',
      t('confirm.freshExplain'),
    ],
    confirmLabel: t('confirm.fresh'),
    busyLabel,
    confirm: async () => successMessage(titleKey, await save(true)),
  }
}

export async function runSave(
  titleKey: string,
  save: SaveFn,
  busyLabel: string,
): Promise<ActionResult> {
  try {
    return successMessage(titleKey, await save(false))
  } catch (err) {
    if (!(err instanceof ConfigParseError)) throw err
    return freshConfirm(titleKey, save, err, busyLabel)
  }
}
