import type {
  Action,
  ActionResult,
  Ctx,
  FieldSpec,
  FormValues,
  ListItem,
} from '../../types.js'
import { clearBackups } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { runSave } from '../../core/save.js'
import { t } from '../../i18n/index.js'
import { seedSettings, seedSettingsFromDisk, saveSettings } from './settings.js'
import { GLOBAL_FIELDS, PROVIDER_FIELDS } from './manifest.js'
import { loadProviders, saveProvider, seedProvider, type ProviderRecord } from './providers.js'
import { backupsDir, modelsFile, settingsFile } from './paths.js'
import { buildStatus } from './status.js'

/* -------------------------------------------------------------- settings */

async function openGlobal(ctx: Ctx): Promise<ActionResult> {
  const file = settingsFile(ctx.home)
  const config = await readConfigFile(file)
  const busy = t('app.busyWriting', { path: file.path })
  return {
    kind: 'form',
    title: t('action.global'),
    fields: GLOBAL_FIELDS,
    values: seedSettings(config.data),
    baseline: seedSettingsFromDisk(config.data),
    notes: [t('pi.note.settingsPath', { path: file.path }), t('note.preserved')],
    busyLabel: () => busy,
    submit: async (values: FormValues) =>
      runSave('write.globalSaved', (fresh) => saveSettings(ctx, values, fresh), busy),
  }
}

/* ------------------------------------------------------------- providers */

/** Renaming would leave the old block behind, so the id is fixed once written. */
function providerFields(isNew: boolean): FieldSpec[] {
  if (isNew) return PROVIDER_FIELDS
  return PROVIDER_FIELDS.map((field) => (field.id === 'id' ? { ...field, readOnly: true } : field))
}

interface ProviderFormInput {
  ctx: Ctx
  values: FormValues
  isNew: boolean
  targetPath: string
}

function providerForm(input: ProviderFormInput): ActionResult {
  const { ctx, values, isNew, targetPath } = input
  const busy = t('app.busyWriting', { path: targetPath })
  return {
    kind: 'form',
    title: isNew
      ? t('action.providerAdd')
      : t('action.providerEdit', { name: String(values['id'] ?? '') }),
    fields: providerFields(isNew),
    values,
    baseline: { ...values },
    notes: [t('pi.note.modelsPath', { path: targetPath }), t('pi.note.modelsMerge')],
    busyLabel: () => busy,
    submit: async (next: FormValues) =>
      runSave('pi.write.providerSaved', (fresh) => saveProvider(ctx, next, fresh), busy),
  }
}

async function openProviderForm(ctx: Ctx, id: string): Promise<ActionResult> {
  const file = modelsFile(ctx.home)
  const config = await readConfigFile(file)
  return providerForm({
    ctx,
    values: seedProvider(config.data, id),
    isNew: id.length === 0,
    targetPath: file.path,
  })
}

function providerDetail(record: ProviderRecord): string {
  if (record.baseUrl.length === 0) return t('pi.status.noBaseUrl')
  return [record.baseUrl, record.models.length > 0 ? record.models.join(', ') : null]
    .filter((part): part is string => part !== null)
    .join(' · ')
}

async function openProviders(ctx: Ctx): Promise<ActionResult> {
  const list = await loadProviders(ctx)
  if (!list.parsed) {
    return {
      kind: 'message',
      title: t('action.providers'),
      lines: [
        list.path,
        t(list.problemKey ?? 'status.readError', { detail: list.problemDetail ?? '' }),
        t('note.fixByHand'),
      ],
      tone: 'error',
    }
  }
  const items: ListItem[] = [
    {
      id: '__add__',
      label: t('action.providerAdd'),
      detail: t('pi.action.providerAddDetail'),
      run: async () => openProviderForm(ctx, ''),
    },
    ...list.records.map((record) => ({
      id: record.id,
      label: record.id,
      detail: providerDetail(record),
      tone: record.problemKey === undefined ? undefined : ('warn' as const),
      run: async () => openProviderForm(ctx, record.id),
    })),
  ]
  return {
    kind: 'list',
    title: t('action.providers'),
    empty: t('pi.status.noProviders'),
    items,
  }
}

/* ---------------------------------------------------------------- status */

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

export function piActions(): Action[] {
  return [
    {
      id: 'global',
      labelKey: 'action.global',
      detailKey: 'pi.action.globalDetail',
      run: openGlobal,
    },
    {
      id: 'providers',
      labelKey: 'action.providers',
      detailKey: 'pi.action.providersDetail',
      run: openProviders,
    },
    { id: 'status', labelKey: 'action.status', run: openStatus },
  ]
}
