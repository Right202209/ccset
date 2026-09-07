import type { ActionResult, Ctx, FieldSpec, FormValues, WriteReport } from '../../types.js'
import { makeKeyNameValidator } from '../../core/validate.js'
import { PartialCommitError, toCcsetError } from '../../core/errors.js'
import { readMode } from '../../core/json-file.js'
import type { TargetRecord } from '../../operations/types.js'
import { textOrUndefined } from '../../core/values.js'
import { t } from '../../i18n/index.js'
import {
  activateAuthProfile,
  loadAdoptedRouting,
  loadAuthState,
  saveAdoptedRouting,
  stageAuthProfile,
  type AuthState,
} from './auth.js'
import { currentModelProvider, restoreModelProvider, saveModelProvider } from './global.js'
import { adoptedRoutingPath, launchCommand } from './paths.js'
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

/**
 * A failed credential move puts the routing back the way it found it, so the
 * routing/credential pairing never splits: without this, a sidecar that
 * vanished while the confirmation was open would leave Codex pointed at the
 * new endpoint with the old key. A restore that itself fails is reported as
 * the partial commit it is, naming the routing that is still in place.
 */
async function undoRouting(
  ctx: Ctx,
  routing: WriteReport,
  previous: string,
  err: unknown,
): Promise<unknown> {
  try {
    await restoreModelProvider(ctx, previous)
  } catch {
    const committed: TargetRecord[] = [
      {
        path: routing.path,
        mode: await readMode(routing.path),
        backupPath: routing.backupPath,
        changed: true,
      },
    ]
    return new PartialCommitError(committed, toCcsetError(err))
  }
  return err
}

async function runActivate(ctx: Ctx, id: string, adoptAs: string | null): Promise<WriteReport> {
  // Stage the source before anything moves: a sidecar that will not parse, or
  // that vanished while the confirmation was open, fails here with the routing
  // still pointing where it was.
  await stageAuthProfile(ctx, id)
  const previous = await currentModelProvider(ctx)
  const routing = await saveModelProvider(ctx, id)
  let report
  try {
    report = await activateAuthProfile(ctx, id, adoptAs)
  } catch (err) {
    throw await undoRouting(ctx, routing, previous, err)
  }
  const notes = [
    t('codex.write.authSwitched', { path: report.authPath }),
    t('codex.write.routed', { id }),
  ]
  if (adoptAs !== null) {
    // The adoption promised a switchable profile; remembering the routing is
    // what makes switching back to it a restore rather than a guess.
    try {
      await saveAdoptedRouting(ctx, adoptAs, previous.length > 0 ? previous : null)
    } catch {
      notes.push(t('codex.write.routingNoteFailed', { path: adoptedRoutingPath(ctx.home) }))
    }
  }
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

function successOf(report: WriteReport, titleKey = 'codex.write.switched'): ActionResult {
  return {
    kind: 'message',
    title: t(titleKey),
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
  const profile = auth.profiles.find((candidate) => candidate.name === id)
  if (profile === undefined) {
    return messageScreen('codex.action.use', [t('codex.status.noProfileFor', { id })])
  }
  // A sidecar that does not parse would copy its invalid JSON over a working
  // auth.json; refusing costs nothing, overwriting breaks Codex's startup.
  if (!profile.readable) {
    return messageScreen('codex.action.use', [
      profile.path,
      t('codex.error.unreadableProfile', { path: profile.path }),
    ])
  }
  if (auth.exists && auth.activeName === null) return adoptForm(ctx, id, auth)
  return activateConfirm(ctx, id, auth)
}

/* ------------------------------------------------------- adopted profiles */

function routingFor(routing: Record<string, string | null>, name: string): string | undefined {
  const recorded = routing[name]
  return typeof recorded === 'string' && recorded.length > 0 ? recorded : undefined
}

/**
 * Restoring an adopted login is the switch in reverse: the credential goes
 * back into auth.json and routing goes back to the model_provider recorded at
 * adoption time -- or the key is removed, when the login was live under
 * Codex's default routing. Routing to a provider that does not exist would be
 * the exact break this exists to avoid.
 */
async function runRestore(
  ctx: Ctx,
  name: string,
  routeTo: string | undefined,
): Promise<WriteReport> {
  await stageAuthProfile(ctx, name)
  const previous = await currentModelProvider(ctx)
  const routing = await saveModelProvider(ctx, routeTo)
  let report
  try {
    report = await activateAuthProfile(ctx, name, null)
  } catch (err) {
    throw await undoRouting(ctx, routing, previous, err)
  }
  return {
    path: routing.path,
    mode: await readMode(report.authPath),
    backupPath: routing.backupPath,
    command: launchCommand(),
    activateKey: 'codex.write.activate',
    notes: [
      t('codex.write.authSwitched', { path: report.authPath }),
      routeTo === undefined
        ? t('codex.write.routedRemoved')
        : t('codex.write.routedBack', { id: routeTo }),
    ],
  }
}

/** The restore screen for a saved login that has no provider table of its own. */
export async function openRestore(ctx: Ctx, name: string): Promise<ActionResult> {
  const [auth, routing] = await Promise.all([loadAuthState(ctx), loadAdoptedRouting(ctx)])
  const profile = auth.profiles.find((candidate) => candidate.name === name)
  if (profile === undefined) {
    return messageScreen('codex.action.restore', [t('codex.status.noProfileFor', { id: name })])
  }
  if (!profile.readable) {
    return messageScreen('codex.action.restore', [
      profile.path,
      t('codex.error.unreadableProfile', { path: profile.path }),
    ])
  }
  const routeTo = routingFor(routing, name)
  return {
    kind: 'confirm',
    title: t('codex.action.restore', { name }),
    lines: [
      t('codex.confirm.switchAuth', { path: auth.path }),
      routeTo === undefined
        ? t('codex.confirm.restoreRoutingUnset')
        : t('codex.confirm.restoreRouting', { id: routeTo }),
    ],
    confirmLabel: t('codex.confirm.restore'),
    busyLabel: t('codex.busy.switching', { id: name }),
    confirm: async () => successOf(await runRestore(ctx, name, routeTo), 'codex.write.restored'),
  }
}
