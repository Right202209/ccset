import type { Action, ActionResult, Ctx, FieldSpec, FormValues, ListItem } from '../../types.js'
import { clearBackups } from '../../core/backup.js'
import { readConfigFile } from '../../core/config-file.js'
import { runSave } from '../../core/save.js'
import { t } from '../../i18n/index.js'
import { openActivate } from './activate.js'
import { listAuthProfiles, removeAuthProfile } from './auth.js'
import { codexConfigFile, saveGlobal, seedGlobal, seedGlobalFromDisk } from './global.js'
import { GLOBAL_FIELDS, PROVIDER_FIELDS } from './manifest.js'
import { loadProviders, saveProvider, seedProvider, type ProviderRecord } from './providers.js'
import { backupsDir } from './paths.js'
import { buildStatus } from './status.js'

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

/* ------------------------------------------------------------ providers */

/** Renaming would leave the old table behind, so the id is fixed once written. */
function providerFields(isNew: boolean): FieldSpec[] {
  if (isNew) return PROVIDER_FIELDS
  return PROVIDER_FIELDS.map((field) => (field.id === 'id' ? { ...field, readOnly: true } : field))
}

function providerForm(ctx: Ctx, values: FormValues, isNew: boolean): ActionResult {
  const file = codexConfigFile(ctx.home)
  const busy = t('app.busyWriting', { path: file.path })
  return {
    kind: 'form',
    title: isNew
      ? t('action.providerAdd')
      : t('action.providerEdit', { name: String(values['id'] ?? '') }),
    fields: providerFields(isNew),
    values,
    baseline: { ...values },
    notes: [
      t('codex.note.configPath', { path: file.path }),
      t('codex.note.keyGoesToProfile'),
      t('codex.note.wireApi'),
    ],
    busyLabel: () => busy,
    submit: async (next: FormValues) =>
      runSave('write.providerSaved', (fresh) => saveProvider(ctx, next, fresh), busy),
  }
}

async function openProviderForm(ctx: Ctx, id: string): Promise<ActionResult> {
  const [loaded, profiles] = await Promise.all([
    readConfigFile(codexConfigFile(ctx.home)),
    listAuthProfiles(ctx),
  ])
  const saved = profiles.find((profile) => profile.name === id)
  return providerForm(ctx, seedProvider(loaded.data, id, saved?.apiKey ?? ''), id.length === 0)
}

/**
 * Removing the sidecar leaves the provider block alone: the block is settings
 * the user may still want, the sidecar is a credential they asked to be rid of.
 */
function removeProfileItem(ctx: Ctx, id: string): ListItem {
  return {
    id: 'remove-profile',
    label: t('codex.action.removeProfile'),
    detail: t('codex.action.removeProfileDetail'),
    run: async () => ({
      kind: 'confirm',
      title: t('codex.action.removeProfile'),
      lines: [t('codex.confirm.removeProfile', { id })],
      confirmLabel: t('codex.confirm.remove'),
      confirm: async () => ({
        kind: 'message',
        title: t('codex.action.removeProfile'),
        lines: [
          (await removeAuthProfile(ctx, id))
            ? t('codex.write.profileRemoved', { id })
            : t('codex.write.profileAbsent', { id }),
          t('status.backupsNote'),
        ],
        tone: 'success',
      }),
    }),
  }
}

/** One provider's own screen: edit it, switch to it, or drop its credential. */
async function openProvider(ctx: Ctx, id: string): Promise<ActionResult> {
  const profiles = await listAuthProfiles(ctx)
  const items: ListItem[] = [
    {
      id: 'edit',
      label: t('codex.action.edit'),
      detail: t('codex.action.editDetail'),
      run: async () => openProviderForm(ctx, id),
    },
    {
      id: 'use',
      label: t('codex.action.use', { id }),
      detail: t('codex.action.useDetail'),
      run: async () => openActivate(ctx, id),
    },
  ]
  if (profiles.some((profile) => profile.name === id)) items.push(removeProfileItem(ctx, id))
  return { kind: 'list', title: t('status.providerTitle', { name: id }), items }
}

function providerDetail(record: ProviderRecord): string {
  if (record.problemKey !== undefined) return t(record.problemKey)
  return record.baseUrl
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
      detail: t('codex.action.providerAddDetail'),
      run: async () => openProviderForm(ctx, ''),
    },
    ...list.records.map((record) => ({
      id: record.id,
      label: record.id,
      detail: providerDetail(record),
      tone: record.problemKey === undefined ? undefined : ('warn' as const),
      run: async () => openProvider(ctx, record.id),
    })),
  ]
  return {
    kind: 'list',
    title: t('action.providers'),
    empty: t('codex.status.noProviders'),
    items,
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
