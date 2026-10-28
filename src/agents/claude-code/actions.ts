import type { Action, ActionResult, Ctx, FormValues, ListItem } from '../../types.js'
import { clearBackups } from '../../core/backup.js'
import { readJsonFile } from '../../core/json-file.js'
import { runSave } from '../../core/save.js'
import { t } from '../../i18n/index.js'
import { seedGlobal, seedGlobalFromDisk, saveGlobal } from './global.js'
import { GLOBAL_FIELDS } from './manifest.js'
import { backupsDir, globalSettingsPath } from './paths.js'
import { openProviders, openTest } from './provider-actions.js'
import { buildStatus } from './status.js'
import { createStateIfMissing } from './state.js'

/**
 * Claude Code's menu: its global settings file, the provider Screens that live
 * in provider-actions.ts, Status, and the opt-in probe.
 */

/* -------------------------------------------------------------- global */

async function openGlobal(ctx: Ctx): Promise<ActionResult> {
  const file = await readJsonFile(globalSettingsPath(ctx.home))
  return {
    kind: 'form',
    title: t('action.global'),
    fields: GLOBAL_FIELDS,
    values: seedGlobal(file.data),
    baseline: seedGlobalFromDisk(file.data),
    notes: [t('note.globalPath', { path: globalSettingsPath(ctx.home) }), t('note.preserved')],
    busyLabel: () => t('app.busyWriting', { path: globalSettingsPath(ctx.home) }),
    submit: async (values: FormValues) =>
      runSave(
        'write.globalSaved',
        (fresh) => saveGlobal(ctx, values, fresh),
        t('app.busyWriting', { path: globalSettingsPath(ctx.home) }),
      ),
  }
}

/* --------------------------------------------------------------- status */

function createStateItem(ctx: Ctx): ListItem {
  return {
    id: 'create-state',
    label: t('claudeCode.action.createState'),
    detail: t('claudeCode.action.createStateDetail'),
    run: async () => {
      const result = await createStateIfMissing(ctx)
      return {
        kind: 'message',
        title: t('claudeCode.action.createState'),
        lines: [
          result.created ? t('claudeCode.write.stateCreated') : t('claudeCode.write.stateExists'),
          t('write.path', { path: result.path }),
          t('write.mode', { mode: result.mode }),
        ],
        tone: result.created ? 'success' : 'info',
      }
    },
  }
}

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

function statusItems(ctx: Ctx, stateExists: boolean): ListItem[] {
  const items: ListItem[] = []
  if (!stateExists) items.push(createStateItem(ctx))
  items.push(clearBackupsItem(ctx))
  return items
}

async function openStatus(ctx: Ctx): Promise<ActionResult> {
  const data = await buildStatus(ctx)
  return {
    kind: 'status',
    title: t('action.status'),
    sections: data.sections,
    items: statusItems(ctx, data.state.exists),
  }
}

export function claudeCodeActions(): Action[] {
  return [
    {
      id: 'global',
      labelKey: 'action.global',
      detailKey: 'claudeCode.action.globalDetail',
      run: openGlobal,
    },
    {
      id: 'providers',
      labelKey: 'action.providers',
      detailKey: 'claudeCode.action.providersDetail',
      run: openProviders,
    },
    { id: 'status', labelKey: 'action.status', run: openStatus },
    { id: 'test', labelKey: 'action.test', run: openTest },
  ]
}
