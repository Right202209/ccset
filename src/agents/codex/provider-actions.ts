import type {
  ActionResult,
  Ctx,
  FieldSpec,
  FormValues,
  ListItem,
  MessageTone,
  StatusLine,
} from '../../types.js'
import { readConfigFile } from '../../core/config-file.js'
import { providerListScreen, providerManageScreen } from '../../core/provider-actions.js'
import { runSave } from '../../core/save.js'
import { readIgnoredProviders, setProviderIgnored } from '../../core/settings.js'
import { t } from '../../i18n/index.js'
import { openActivate, openRestore } from './activate.js'
import {
  listAuthProfiles,
  loadAdoptedRouting,
  removeAuthProfile,
  type AdoptedRouting,
  type AuthProfile,
} from './auth.js'
import { codexConfigFile } from './global.js'
import { PROVIDER_FIELDS } from './manifest.js'
import {
  loadProviders,
  removeProvider,
  saveProvider,
  seedProvider,
  type ProviderList,
  type ProviderRecord,
} from './providers.js'

/**
 * The two provider Screens: the list, and one provider's own Screen where it is
 * edited, switched to, ignored or deleted. Ignoring is ccset's own note
 * (ADR 0019), keyed by the Agent id the ignore list is stored under.
 */

const AGENT_ID = 'codex'

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
 * Removing the sidecar leaves the provider table alone: the table is settings
 * the core user may still want, the sidecar is a credential they asked to be
 * rid of. Deleting the provider removes both, which is the other entry.
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

/** One provider's own screen: edit it, switch to it, ignore it, or delete it. */
async function openProvider(ctx: Ctx, id: string): Promise<ActionResult> {
  const [profiles, ignored] = await Promise.all([
    listAuthProfiles(ctx),
    readIgnoredProviders(ctx.home, AGENT_ID),
  ])
  const extra: ListItem[] = [
    {
      id: 'use',
      label: t('codex.action.use', { id }),
      detail: t('codex.action.useDetail'),
      run: async () => openActivate(ctx, id),
    },
  ]
  if (profiles.some((profile) => profile.name === id)) extra.push(removeProfileItem(ctx, id))
  return providerManageScreen({
    id,
    edit: {
      id: 'edit',
      label: t('action.providerEdit', { name: id }),
      detail: t('action.providerEditDetail'),
      run: async () => openProviderForm(ctx, id),
    },
    targetPath: codexConfigFile(ctx.home).path,
    remove: () => removeProvider(ctx, id),
    ignored: ignored.includes(id),
    setIgnored: (value) => setProviderIgnored(ctx.home, AGENT_ID, id, value),
    extra,
  })
}

function providerDetail(record: ProviderRecord): string {
  if (record.problemKey !== undefined) return t(record.problemKey)
  return record.baseUrl
}

/**
 * A sidecar whose name matches no provider table is a login ccset adopted (or
 * one copied by hand). The adopt screen calls it a switchable profile, so it
 * is listed here with the routing it restores to -- otherwise the promise has
 * no path anywhere in the app.
 */
function restoreDetail(
  profile: AuthProfile,
  routing: AdoptedRouting,
): { detail: string; tone: MessageTone | undefined } {
  if (!profile.readable) return { detail: t('status.unreadable'), tone: 'error' }
  const recorded = routing[profile.name]
  return {
    detail:
      typeof recorded === 'string' && recorded.length > 0
        ? t('codex.detail.adoptedRouting', { route: recorded })
        : t('codex.detail.adoptedUnset'),
    tone: undefined,
  }
}

/** A document ccset cannot read is reported rather than listed: there are no
 *  provider tables to offer until it parses. */
function unparsedMessage(list: ProviderList): ActionResult {
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

/** Saved logins whose name matches no table: a provider row they are not, so
 *  the ignore list has nothing to say about them. */
function adoptedEntries(
  ctx: Ctx,
  profiles: AuthProfile[],
  known: Set<string>,
  routing: AdoptedRouting,
): ListItem[] {
  return profiles
    .filter((profile) => !known.has(profile.name))
    .map((profile) => {
      const shown = restoreDetail(profile, routing)
      return {
        id: profile.name,
        label: profile.name,
        detail: shown.detail,
        tone: shown.tone,
        run: async () => openRestore(ctx, profile.name),
      }
    })
}

export async function openProviders(ctx: Ctx, showIgnored = false): Promise<ActionResult> {
  const [list, profiles, routing, ignored] = await Promise.all([
    loadProviders(ctx),
    listAuthProfiles(ctx),
    loadAdoptedRouting(ctx),
    readIgnoredProviders(ctx.home, AGENT_ID),
  ])
  if (!list.parsed) return unparsedMessage(list)
  const known = new Set(list.records.map((record) => record.id))
  return providerListScreen({
    title: t('action.providers'),
    empty: t('codex.status.noProviders'),
    leading: [
      {
        id: '__add__',
        label: t('action.providerAdd'),
        detail: t('codex.action.providerAddDetail'),
        run: async () => openProviderForm(ctx, ''),
      },
    ],
    entries: list.records.map((record) => ({
      id: record.id,
      label: record.id,
      detail: providerDetail(record),
      preview: providerPreview(record, profiles, list.path),
      tone: record.problemKey === undefined ? undefined : ('warn' as const),
      run: async () => openProvider(ctx, record.id),
    })),
    ignored,
    showIgnored,
    reopen: (next) => openProviders(ctx, next),
    trailing: adoptedEntries(ctx, profiles, known, routing),
  })
}

function providerPreview(record: ProviderRecord, profiles: AuthProfile[], path: string): StatusLine[] {
  const profile = profiles.find((item) => item.name === record.id)
  return [
    { label: t('status.path'), value: path },
    { label: t('field.baseUrl'), value: record.baseUrl || t('status.unset') },
    { label: t('codex.field.wireApi'), value: record.wireApi || t('status.unset') },
    { label: t('codex.field.apiKey'), value: t(profile?.apiKey ? 'status.yes' : 'status.no') },
  ]
}
