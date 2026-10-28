import type { ActionResult, ListItem, MessageTone, StatusLine } from '../types.js'
import { t } from '../i18n/index.js'
import type { RemovalReport } from './remove.js'

/**
 * The provider-management Screens every Agent shares: the list that keeps the
 * ignored providers out of the way, and one provider's own Screen -- edit it,
 * ignore it, or delete it.
 *
 * They live here rather than in each Agent module for the reason the shared
 * catalog holds their wording: the verbs and their sentences are ccset's, not
 * an Agent's. What an Agent owns is its edit entry, the path its provider lives
 * at, and the removal itself.
 */

/** One provider row. The Agent supplies the words; this module supplies the gate. */
export interface ProviderListEntry {
  id: string
  label: string
  detail?: string
  preview?: StatusLine[]
  tone?: MessageTone
  run: () => Promise<ActionResult>
}

export interface ProviderListInput {
  title: string
  empty: string
  /** Rows above the providers: the "Add" entry. */
  leading?: ListItem[]
  /** Rows below them: entries that are not providers at all, such as a Codex credential with no table. */
  trailing?: ListItem[]
  entries: ProviderListEntry[]
  /** The ids the core user asked ccset to ignore. */
  ignored: string[]
  showIgnored: boolean
  /** Re-reads the list with the other visibility; the toggle row's own action. */
  reopen: (showIgnored: boolean) => Promise<ActionResult>
}

/** "ignored" is appended to the detail, so a revealed row says why it was hidden. */
function markedDetail(detail: string | undefined, ignored: boolean): string | undefined {
  if (!ignored) return detail
  const parts = [detail, t('provider.ignored')].filter((part) => part !== undefined && part.length > 0)
  return parts.join(' · ')
}

function ignoredToggleItem(input: ProviderListInput): ListItem {
  const { ignored, showIgnored, reopen } = input
  return {
    id: '__ignored__',
    label: showIgnored
      ? t('action.hideIgnored')
      : t('action.showIgnored', { count: String(ignored.length) }),
    detail: t(showIgnored ? 'action.hideIgnoredDetail' : 'action.showIgnoredDetail'),
    run: async () => reopen(!showIgnored),
  }
}

/**
 * The provider list. An ignored provider is not offered at all unless the
 * toggle row is used, so ignoring means what it says -- and the toggle row is
 * the way back, which is why the list never hides every trace of one.
 */
export function providerListScreen(input: ProviderListInput): ActionResult {
  const ignored = new Set(input.ignored)
  const hidden = input.showIgnored ? new Set<string>() : ignored
  const items: ListItem[] = [
    ...(input.leading ?? []),
    ...input.entries
      .filter((entry) => !hidden.has(entry.id))
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        detail: markedDetail(entry.detail, ignored.has(entry.id)),
        preview: entry.preview,
        tone: entry.tone,
        run: entry.run,
      })),
  ]
  if (input.ignored.length > 0) items.push(ignoredToggleItem(input))
  items.push(...(input.trailing ?? []))
  return { kind: 'list', title: input.title, empty: input.empty, items }
}

/**
 * The message a removal ends on. Only the paths that changed are named -- a
 * removal of something already gone is not a write, and claiming a backup for
 * it would be a lie -- and the backups note stays on every one of them, because
 * deleting a provider does not delete the credentials in its backups.
 */
export function removedMessage(title: string, report: RemovalReport): ActionResult {
  const changed = report.targets.filter((target) => target.changed)
  const lines =
    changed.length === 0
      ? [t('write.nothingRemoved')]
      : changed.flatMap((target) => [
          t('write.path', { path: target.path }),
          target.backupPath === null
            ? t('write.noBackup')
            : t('write.backup', { path: target.backupPath }),
        ])
  return { kind: 'message', title, lines: [...lines, '', t('status.backupsNote')], tone: 'success' }
}

export interface ProviderManageInput {
  id: string
  /** The Agent's own edit entry, which leads to its provider form. */
  edit: ListItem
  /** Where the provider's configuration lives; the delete confirm names it. */
  targetPath: string
  remove: () => Promise<RemovalReport>
  ignored: boolean
  setIgnored: (ignored: boolean) => Promise<void>
  /** Entries only this Agent offers: Codex's switch and saved-credential rows. */
  extra?: ListItem[]
}

function deleteItem(input: ProviderManageInput): ListItem {
  return {
    id: 'delete',
    label: t('action.providerDelete'),
    detail: t('action.providerDeleteDetail'),
    run: async () => ({
      kind: 'confirm',
      title: t('action.providerDelete'),
      lines: [t('confirm.deleteProvider', { name: input.id, path: input.targetPath })],
      confirmLabel: t('confirm.delete'),
      busyLabel: t('app.busyDeleting', { path: input.targetPath }),
      confirm: async () => removedMessage(t('write.providerDeleted'), await input.remove()),
    }),
  }
}

/**
 * Ignoring is a ccset-side note, but it is still a write, so it is guarded by a
 * confirm like every other one -- which is also what keeps opening a Screen free
 * of effects. Its outcome is an ordinary message, and the Screen it was opened
 * from re-reads underneath: Esc then shows the opposite verb rather than the one
 * just used.
 */
function ignoreItem(input: ProviderManageInput): ListItem {
  const { ignored } = input
  return {
    id: ignored ? 'unignore' : 'ignore',
    label: t(ignored ? 'action.providerUnignore' : 'action.providerIgnore'),
    detail: t(ignored ? 'action.providerUnignoreDetail' : 'action.providerIgnoreDetail'),
    run: async () => ({
      kind: 'confirm',
      title: t(ignored ? 'action.providerUnignore' : 'action.providerIgnore'),
      lines: [t(ignored ? 'confirm.providerUnignore' : 'confirm.providerIgnore', { name: input.id })],
      confirmLabel: t(ignored ? 'action.providerUnignore' : 'action.providerIgnore'),
      confirm: async () => {
        await input.setIgnored(!ignored)
        return {
          kind: 'message',
          title: t('action.providers'),
          lines: [t(ignored ? 'write.providerUnignored' : 'write.providerIgnored', { name: input.id })],
          tone: 'success',
        }
      },
    }),
  }
}

/** Delete sits last: the cursor starts on row 1, and the confirm guards the rest. */
export function providerManageScreen(input: ProviderManageInput): ActionResult {
  return {
    kind: 'list',
    title: t('status.providerTitle', { name: input.id }),
    items: [input.edit, ...(input.extra ?? []), ignoreItem(input), deleteItem(input)],
  }
}
