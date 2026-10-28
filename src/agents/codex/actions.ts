import type { Action, ActionResult, Ctx, FormValues, ListItem } from '../../types.js'
import { clearBackups } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { runSave } from '../../core/save.js'
import { t } from '../../i18n/index.js'
import { codexConfigFile, saveGlobal, seedGlobal, seedGlobalFromDisk } from './global.js'
import { GLOBAL_FIELDS } from './manifest.js'
import { backupsDir } from './paths.js'
import { openProviders } from './provider-actions.js'
import { buildStatus } from './status.js'

/** Codex's menu: config.toml's global keys, the provider Screens that live in
 *  provider-actions.ts, and Status. */

/* -------------------------------------------------------------- global */

async function openGlobal(ctx: Ctx): Promise<ActionResult> {
  const file = codexConfigFile(ctx.home)
  const loaded = await readConfigFile(file)
  const busy = t('app.busyWriting', { path: file.path })
  return {
    kind: 'form',
    title: t('action.global'),
    fields: GLOBAL_FIELDS,
    values: seedGlobal(loaded.data),
    baseline: seedGlobalFromDisk(loaded.data),
    notes: [t('codex.note.configPath', { path: file.path }), t('note.preserved')],
    busyLabel: () => busy,
    submit: async (values: FormValues) =>
      runSave('write.globalSaved', (fresh) => saveGlobal(ctx, values, fresh), busy),
  }
}

/* --------------------------------------------------------------- status */

function clearBackupsItem(ctx: Ctx): ListItem {
  return {
    id: 'clear-backups',
    label: t('action.clearBackups'),
    detail: t('action.clearBackupsDetail'),
    run: async () => ({
      kind: 'confirm',
      title: t('action.clearBackups'),
      lines: [t('confirm.clearBackups')],
      confirmLabel: t('confirm.clear'),
      confirm: async () => ({
        kind: 'message',
        title: t('action.clearBackups'),
        lines: [t('write.backupsCleared', { count: await clearBackups(backupsDir(ctx.home)) })],
        tone: 'success',
      }),
    }),
  }
}

async function openStatus(ctx: Ctx): Promise<ActionResult> {
  const data = await buildStatus(ctx)
  return {
    kind: 'status',
    title: t('action.status'),
    sections: data.sections,
    items: [clearBackupsItem(ctx)],
  }
}

export function codexActions(): Action[] {
  return [
    {
      id: 'global',
      labelKey: 'action.global',
      detailKey: 'codex.action.globalDetail',
      run: openGlobal,
    },
    {
      id: 'providers',
      labelKey: 'action.providers',
      detailKey: 'codex.action.providersDetail',
      run: openProviders,
    },
    { id: 'status', labelKey: 'action.status', run: openStatus },
  ]
}
