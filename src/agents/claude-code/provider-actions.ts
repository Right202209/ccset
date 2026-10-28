import type { ActionResult, Ctx, FieldSpec, FormValues, StatusLine } from '../../types.js'
import { maskSecret } from '../../core/mask.js'
import { providerListScreen, providerManageScreen } from '../../core/provider-actions.js'
import { runSave } from '../../core/save.js'
import { readIgnoredProviders, setProviderIgnored } from '../../core/settings.js'
import { t } from '../../i18n/index.js'
import { PROVIDER_FIELDS } from './manifest.js'
import { providerSettingsPath } from './paths.js'
import {
  loadProviders,
  removeProvider,
  saveProvider,
  seedProvider,
  type ProviderRecord,
} from './providers.js'
import { probeEndpoint, probeHost, warnsPlaintextHttp } from './test-connection.js'

/**
 * The two provider Screens: the list, and one provider's own Screen where it is
 * edited, ignored or deleted. Ignoring is ccset's own note (ADR 0019), keyed by
 * the Agent id the ignore list is stored under.
 */

const AGENT_ID = 'claude-code'

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
    notes: [t('claudeCode.note.providerPath'), t('note.preserved')],
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

/** A file ccset cannot read is reported, never repaired: the provider still has
 *  to be deletable, and its file may be one nothing else can parse either. */
function unreadableMessage(record: ProviderRecord): ActionResult {
  return {
    kind: 'message',
    title: t('status.providerTitle', { name: record.name }),
    lines: [
      record.path,
      t(record.problemKey ?? 'status.readError', { detail: record.problemDetail ?? '' }),
      t('note.fixByHand'),
    ],
    tone: 'error',
  }
}

function providerDetail(record: ProviderRecord): string {
  if (!record.parsed) return t('status.unreadable')
  if (record.baseUrl.length === 0) return t('claudeCode.status.noBaseUrl')
  return record.baseUrl
}

function providerPreview(record: ProviderRecord): StatusLine[] {
  return [
    { label: t('status.path'), value: record.path },
    { label: t('field.baseUrl'), value: record.baseUrl || t('status.unset') },
    { label: t('field.providerModel'), value: record.model || t('status.unset') },
    { label: t('field.token'), value: t(record.token.length > 0 ? 'status.yes' : 'status.no') },
  ]
}

async function openProvider(ctx: Ctx, record: ProviderRecord): Promise<ActionResult> {
  const ignored = (await readIgnoredProviders(ctx.home, AGENT_ID)).includes(record.name)
  return providerManageScreen({
    id: record.name,
    edit: {
      id: 'edit',
      label: t('action.providerEdit', { name: record.name }),
      detail: t('action.providerEditDetail'),
      run: async () => (record.parsed ? providerForm(ctx, record) : unreadableMessage(record)),
    },
    targetPath: record.path,
    remove: () => removeProvider(ctx, record.name),
    ignored,
    setIgnored: (value) => setProviderIgnored(ctx.home, AGENT_ID, record.name, value),
  })
}

export async function openProviders(ctx: Ctx, showIgnored = false): Promise<ActionResult> {
  const [records, ignored] = await Promise.all([
    loadProviders(ctx),
    readIgnoredProviders(ctx.home, AGENT_ID),
  ])
  return providerListScreen({
    title: t('action.providers'),
    empty: t('claudeCode.status.noProviders'),
    leading: [
      {
        id: '__add__',
        label: t('action.providerAdd'),
        detail: t('claudeCode.action.providerAddDetail'),
        run: async () => providerForm(ctx, null),
      },
    ],
    entries: records.map((record) => ({
      id: record.name,
      label: record.name,
      detail: providerDetail(record),
      preview: providerPreview(record),
      tone: record.parsed ? undefined : ('error' as const),
      run: async () => openProvider(ctx, record),
    })),
    ignored,
    showIgnored,
    reopen: (next) => openProviders(ctx, next),
  })
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
      ...(warnsPlaintextHttp(record.baseUrl) ? [t('confirm.testPlaintext')] : []),
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

/**
 * An ignored provider is not a probe target: the core user asked ccset not to
 * offer it, and sending its credential to its host is the most offering thing
 * ccset does.
 */
export async function openTest(ctx: Ctx): Promise<ActionResult> {
  const [records, ignored] = await Promise.all([
    loadProviders(ctx),
    readIgnoredProviders(ctx.home, AGENT_ID),
  ])
  const usable = records.filter(
    (record) => record.parsed && record.baseUrl.length > 0 && !ignored.includes(record.name),
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
