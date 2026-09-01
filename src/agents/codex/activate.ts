import type { ActionResult, Ctx, FieldSpec, FormValues, WriteReport } from '../../types.js'
import { makeKeyNameValidator } from '../../core/validate.js'
import { readMode } from '../../core/json-file.js'
import { textOrUndefined } from '../../core/values.js'
import { t } from '../../i18n/index.js'
import { activateAuthProfile, loadAuthState, type AuthState } from './auth.js'
import { saveModelProvider } from './global.js'
import { launchCommand } from './paths.js'
import { loadProviders } from './providers.js'

/**
 * Switching provider is two moves, and both have to happen: the credential in
 * `auth.json` is replaced with the provider's saved profile, and
 * `model_provider` in config.toml is pointed at it. Doing only the first leaves
 * Codex routing to the old endpoint with the new key.
 */

const NAME_CHARSET = /[^A-Za-z0-9_-]+/g
const FALLBACK_ADOPT_NAME = 'previous'

/** A profile name suggested for whatever is in auth.json now. */
function suggestAdoptName(auth: AuthState): string {
  const base = auth.authMode.replace(NAME_CHARSET, '-') || FALLBACK_ADOPT_NAME
  const taken = new Set(auth.profiles.map((profile) => profile.name))
  if (!taken.has(base)) return base
  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * Blank is allowed and means "do not keep it" -- the backup is taken either
 * way. Reusing a name would overwrite a credential the user still has, which is
 * the one outcome this screen exists to prevent.
 */
function adoptField(auth: AuthState): FieldSpec {
  const reserved = makeKeyNameValidator(auth.profiles.map((profile) => profile.name))
  return {
    id: 'adoptName',
    labelKey: 'codex.field.adoptName',
    helpKey: 'codex.help.adoptName',
    type: 'text',
    validate: (value: string) => (value.trim().length === 0 ? null : reserved(value)),
  }
}

async function runActivate(ctx: Ctx, id: string, adoptAs: string | null): Promise<WriteReport> {
  // config.toml first: if it fails, nothing has moved and nothing is half done.
  const routing = await saveModelProvider(ctx, id)
  const report = await activateAuthProfile(ctx, id, adoptAs)
  const notes = [
    t('codex.write.authSwitched', { path: report.authPath }),
    t('codex.write.routed', { id }),
  ]
  if (report.adoptedPath !== null) {
    notes.push(t('codex.write.adopted', { path: report.adoptedPath }))
  }
  if (report.backupPath !== null) {
    notes.push(t('codex.write.authBackup', { path: report.backupPath }))
  }
  return {
    path: routing.path,
    mode: await readMode(report.authPath),
    backupPath: routing.backupPath,
    command: launchCommand(),
    activateKey: 'codex.write.activate',
    notes,
  }
}

function messageScreen(titleKey: string, lines: string[]): ActionResult {
  return { kind: 'message', title: t(titleKey), lines, tone: 'error' }
}

/** The plain case: nothing would be lost, so one confirmation is enough. */
function activateConfirm(ctx: Ctx, id: string, auth: AuthState): ActionResult {
  const busy = t('codex.busy.switching', { id })
  return {
    kind: 'confirm',
    title: t('codex.action.use', { id }),
    lines: [
      t('codex.confirm.switchAuth', { path: auth.path }),
      t('codex.confirm.switchRouting', { id }),
    ],
    confirmLabel: t('codex.confirm.switch'),
    busyLabel: busy,
    confirm: async () => successOf(await runActivate(ctx, id, null)),
  }
}

/**
 * auth.json holds something that is not one of the saved profiles -- a ChatGPT
 * login, or a key edited by hand. It is offered a name before being replaced,
 * because a backup the user has to find by hand is not the same as a profile
 * they can switch back to.
 */
function adoptForm(ctx: Ctx, id: string, auth: AuthState): ActionResult {
  const busy = t('codex.busy.switching', { id })
  return {
    kind: 'form',
    title: t('codex.action.use', { id }),
    fields: [adoptField(auth)],
    values: { adoptName: suggestAdoptName(auth) },
    baseline: { adoptName: '' },
    notes: [
      t('codex.note.adoptFound', { mode: auth.authMode || t('status.unset') }),
      t('codex.note.adoptSkip'),
      t('codex.confirm.switchRouting', { id }),
    ],
    busyLabel: () => busy,
    submit: async (values: FormValues) =>
      successOf(await runActivate(ctx, id, textOrUndefined(values['adoptName']) ?? null)),
  }
}

function successOf(report: WriteReport): ActionResult {
  return {
    kind: 'message',
    title: t('codex.write.switched'),
    lines: [
      t('write.path', { path: report.path }),
      t('write.mode', { mode: report.mode }),
      ...(report.notes ?? []),
      '',
      t(report.activateKey ?? 'write.activate'),
      report.command,
    ],
    tone: 'success',
  }
}

export async function openActivate(ctx: Ctx, id: string): Promise<ActionResult> {
  const [auth, providers] = await Promise.all([loadAuthState(ctx), loadProviders(ctx)])
  if (!providers.parsed) {
    return messageScreen('codex.action.use', [
      providers.path,
      t(providers.problemKey ?? 'status.readError', { detail: providers.problemDetail ?? '' }),
      t('note.fixByHand'),
    ])
  }
  if (!auth.profiles.some((profile) => profile.name === id)) {
    return messageScreen('codex.action.use', [t('codex.status.noProfileFor', { id })])
  }
  if (auth.exists && auth.activeName === null) return adoptForm(ctx, id, auth)
  return activateConfirm(ctx, id, auth)
}
