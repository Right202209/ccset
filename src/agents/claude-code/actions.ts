import type {
  Action,
  ActionResult,
  Ctx,
  FieldSpec,
  FormValues,
  ListItem,
} from '../../types.js'
import { clearBackups } from '../../core/backup.js'
import { readJsonFile } from '../../core/json-file.js'
import { maskSecret } from '../../core/mask.js'
import { globalSettingsPath, providerSettingsPath } from '../../core/paths.js'
import { t } from '../../i18n/index.js'
import { seedGlobal, seedGlobalFromDisk, saveGlobal } from './global.js'
import { GLOBAL_FIELDS, PROVIDER_FIELDS } from './manifest.js'
import { loadProviders, saveProvider, seedProvider, type ProviderRecord } from './providers.js'
import { runSave } from './save.js'
import { buildStatus } from './status.js'
import { createStateIfMissing } from './state.js'
import { probeEndpoint, probeHost } from './test-connection.js'

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

/* ------------------------------------------------------------ providers */

/** Renaming would orphan the old file, so the name is fixed once written. */
function providerFields(isNew: boolean): FieldSpec[] {
  if (isNew) return PROVIDER_FIELDS
  return PROVIDER_FIELDS.map((field) =>
    field.id === 'name' ? { ...field, readOnly: true } : field,
  )
}

function providerForm(ctx: Ctx, record: ProviderRecord | null): ActionResult {
  const isNew = record === null
  const values = isNew ? seedProvider({}, '') : seedProvider(record.data, record.name)
  return {
    kind: 'form',
    title: isNew ? t('action.providerAdd') : t('action.providerEdit', { name: record.name }),
    fields: providerFields(isNew),
    values,
    baseline: { ...values },
    notes: [t('note.providerPath'), t('note.preserved')],
    busyLabel: (next) =>
      t('app.busyWriting', {
        path: providerSettingsPath(ctx.home, String(next['name'] ?? '').trim()),
      }),
    submit: async (next: FormValues) =>
      runSave(
        'write.providerSaved',
        (fresh) => saveProvider(ctx, next, fresh),
        t('app.busyWriting', {
          path: providerSettingsPath(ctx.home, String(next['name'] ?? '').trim()),
        }),
      ),
  }
}

function providerDetail(record: ProviderRecord): string {
  if (!record.parsed) return t('status.unreadable')
  if (record.baseUrl.length === 0) return t('status.noBaseUrl')
  return record.baseUrl
}

function providerItem(ctx: Ctx, record: ProviderRecord): ListItem {
  return {
    id: record.name,
    label: record.name,
    detail: providerDetail(record),
    tone: record.parsed ? undefined : 'error',
    run: async () =>
      record.parsed
        ? providerForm(ctx, record)
        : {
            kind: 'message',
            title: t('status.providerTitle', { name: record.name }),
            lines: [
              record.path,
              t(record.problemKey ?? 'status.readError', { detail: record.problemDetail ?? '' }),
              t('note.fixByHand'),
            ],
            tone: 'error',
          },
  }
}

async function openProviders(ctx: Ctx): Promise<ActionResult> {
  const records = await loadProviders(ctx)
  const items: ListItem[] = [
    {
      id: '__add__',
      label: t('action.providerAdd'),
      detail: t('action.providerAddDetail'),
      run: async () => providerForm(ctx, null),
    },
    ...records.map((record) => providerItem(ctx, record)),
  ]
  return { kind: 'list', title: t('action.providers'), empty: t('status.noProviders'), items }
}

/* --------------------------------------------------------------- status */

function createStateItem(ctx: Ctx): ListItem {
  return {
    id: 'create-state',
    label: t('action.createState'),
    detail: t('action.createStateDetail'),
    run: async () => {
      const result = await createStateIfMissing(ctx)
      return {
        kind: 'message',
        title: t('action.createState'),
        lines: [
          result.created ? t('write.stateCreated') : t('write.stateExists'),
          t('write.path', { path: result.path }),
          t('write.mode', { mode: result.mode }),
        ],
        tone: result.created ? 'success' : 'info',
      }
    },
  }
}

async function clearBackupsResult(ctx: Ctx): Promise<ActionResult> {
  const removed = await clearBackups(ctx.home)
  return {
    kind: 'message',
    title: t('action.clearBackups'),
    lines: [t('write.backupsCleared', { count: removed })],
    tone: 'success',
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
      confirm: () => clearBackupsResult(ctx),
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

/* ------------------------------------------------------ test connection */

function probeConfirm(record: ProviderRecord): ActionResult {
  return {
    kind: 'confirm',
    title: t('action.test'),
    lines: [
      t('confirm.testHost', { host: probeHost(record.baseUrl) }),
      t('confirm.testToken', { token: maskSecret(record.token) }),
      t('confirm.testWarning'),
    ],
    confirmLabel: t('confirm.send'),
    busyLabel: t('app.busyConnecting', { host: probeHost(record.baseUrl) }),
    confirm: async () => {
      const result = await probeEndpoint(record)
      return {
        kind: 'message',
        title: t('action.test'),
        lines: [
          t('probe.host', { host: result.host }),
          t('probe.status', { status: result.status === null ? '-' : String(result.status) }),
          t(result.key),
          t('probe.noBody'),
        ],
        tone: result.ok ? 'success' : 'error',
      }
    },
  }
}

async function openTest(ctx: Ctx): Promise<ActionResult> {
  const usable = (await loadProviders(ctx)).filter(
    (record) => record.parsed && record.baseUrl.length > 0,
  )
  if (usable.length === 0) {
    return {
      kind: 'message',
      title: t('action.test'),
      lines: [t('probe.noTargets')],
      tone: 'info',
    }
  }
  return {
    kind: 'list',
    title: t('action.test'),
    items: usable.map((record) => ({
      id: record.name,
      label: record.name,
      detail: record.baseUrl,
      run: async () => probeConfirm(record),
    })),
  }
}

export function claudeCodeActions(): Action[] {
  return [
    { id: 'global', labelKey: 'action.global', run: openGlobal },
    { id: 'providers', labelKey: 'action.providers', run: openProviders },
    { id: 'status', labelKey: 'action.status', run: openStatus },
    { id: 'test', labelKey: 'action.test', run: openTest },
  ]
}
