import type { ActionResult, WriteReport } from '../../types.js'
import { JsonParseError } from '../../core/errors.js'
import { t } from '../../i18n/index.js'

/** A write that can be retried against an empty base after a parse failure. */
export type SaveFn = (startFresh: boolean) => Promise<WriteReport>

export function successMessage(titleKey: string, report: WriteReport): ActionResult {
  const lines = [
    t('write.path', { path: report.path }),
    t('write.mode', { mode: report.mode }),
    report.backupPath === null
      ? t('write.noBackup')
      : t('write.backup', { path: report.backupPath }),
    '',
    t('write.activate'),
    report.command,
  ]
  return { kind: 'message', title: t(titleKey), lines, tone: 'success' }
}

/**
 * A target that is already malformed JSON cannot be merged into, and
 * overwriting it silently would discard keys the user cannot get back
 * (PRD 4.4, exit code 4). The choice is put to the user instead.
 */
function freshConfirm(titleKey: string, save: SaveFn, err: JsonParseError): ActionResult {
  return {
    kind: 'confirm',
    title: t('confirm.freshTitle'),
    lines: [
      t('error.invalidJson', {
        path: err.params['path'] ?? '',
        position: err.params['position'] ?? '',
      }),
      '',
      t('confirm.freshExplain'),
    ],
    confirmLabel: t('confirm.fresh'),
    confirm: async () => successMessage(titleKey, await save(true)),
  }
}

export async function runSave(titleKey: string, save: SaveFn): Promise<ActionResult> {
  try {
    return successMessage(titleKey, await save(false))
  } catch (err) {
    if (!(err instanceof JsonParseError)) throw err
    return freshConfirm(titleKey, save, err)
  }
}
