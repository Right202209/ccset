import { refuseHomeMismatch, refuseKeyring, profileRoute } from './preconditions.js'
import { configFile, readConfigFile, type LoadedConfig } from '../../core/config-file.js'
import { CcsetError, EXIT_USAGE, PartialCommitError, toCcsetError, ValidationError } from '../../core/errors.js'
import { fileExists, readMode } from '../../core/json-file.js'
import { getPath } from '../../core/merge.js'
import { jsonToText } from '../../core/values.js'
import { applyPlan, MODE_AFTER_WRITE, planTargets, type WriteTarget } from '../../operations/commit.js'
import type { OperationRequest, OperationResult, TargetRecord } from '../../operations/types.js'
import type { Ctx, ConfigFile } from '../../types.js'
import { makeKeyNameValidator } from '../../core/validate.js'
import { activateAuthProfile, adoptLiveAuth, planAdoptedRouting, loadAuthState, type AuthState } from './auth.js'
import { MODEL_PROVIDER_PATH } from './manifest.js'
import { authProfilePath, backupsDir, codexAuthPath, launchCommand } from './paths.js'
import { codexConfigFile, restoreModelProvider } from './global.js'

/**
 * Codex's provider use over the Non-interactive seam: routing first, then the
 * live credential, with the conflict the live bytes pose resolved explicitly.
 */

const USE_COMMAND_FIELDS = [
  { id: 'adoptCurrentAs', option: '--adopt-current-as', type: 'text' as const },
  { id: 'replaceCurrentAuth', option: '--replace-current-auth', type: 'flag' as const },
]

/**
 * The live credential is only "known" when its bytes are one of the saved
 * profiles. An unknown live credential may not be discarded silently: the
 * invocation has to adopt it as a new profile or own its replacement.
 */
function adoptChoiceOf(request: OperationRequest): { adoptAs: string | null; replaceCurrent: boolean } {
  const raw = request.patch['adoptCurrentAs']
  const adoptAs = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
  const replaceCurrent = request.patch['replaceCurrentAuth'] === true
  if (adoptAs !== null && replaceCurrent) {
    throw new CcsetError('codex.validate.adoptOrReplace', EXIT_USAGE)
  }
  return { adoptAs, replaceCurrent }
}

interface UsePreflight {
  /** The provider being switched to; decided at the preflight's front door. */
  id: string
  routeTo: string | undefined
  adoption: WriteTarget[]
  auth: AuthState
  file: ConfigFile
  configBase: LoadedConfig
  adoptAs: string | null
  conflicted: boolean
}

function refuseInvalidAdoptName(auth: AuthState, adoptAs: string): void {
  const problem = makeKeyNameValidator(auth.profiles.map((candidate) => candidate.name))(adoptAs)
  if (problem !== null) throw new ValidationError(problem, { name: adoptAs })
}

function previousRoute(base: LoadedConfig): string | null {
  return jsonToText(getPath(base.data, MODEL_PROVIDER_PATH)) || null
}

/** Everything that decides the shape of the switch, before any rename or copy. */
async function preflightProviderUse(
  ctx: Ctx,
  id: string,
  request: OperationRequest,
): Promise<UsePreflight> {
  // Pure request checks come first: a malformed invocation is a usage error
  // even when the disks that would answer it are unreadable.
  const { adoptAs, replaceCurrent } = adoptChoiceOf(request)
  const auth = await loadAuthState(ctx)
  const profile = auth.profiles.find((candidate) => candidate.name === id)
  if (profile === undefined) {
    throw new ValidationError('codex.status.noProfileFor', { id })
  }
  // A profile that does not parse is never activated wholesale (exit 4).
  await readConfigFile(configFile(profile.path, 'json'))
  const file = codexConfigFile(ctx.home)
  const configBase = await readConfigFile(file)
  refuseHomeMismatch(ctx)
  refuseKeyring(configBase.data)
  const routeTo = await profileRoute(ctx, id, configBase.data)
  const conflicted = auth.exists && auth.activeName === null
  if (conflicted && adoptAs === null && !replaceCurrent) {
    throw new ValidationError('codex.validate.conflictNeedsChoice', { path: auth.path })
  }
  // Adoption keeps the live bytes under a name before they are replaced. When
  // the live credential already is a saved profile, nothing is being replaced,
  // so there is nothing to adopt -- accepting the flag would only duplicate a
  // profile the user already has.
  if (adoptAs !== null && !conflicted) {
    throw new ValidationError('codex.validate.adoptNeedsConflict')
  }
  if (adoptAs !== null) refuseInvalidAdoptName(auth, adoptAs)
  const previous = previousRoute(configBase)
  const adoption = adoptAs === null ? [] : planTargets([await planAdoptedRouting(ctx, adoptAs, previous)])
  return { id, routeTo, adoption, auth, file, configBase, adoptAs, conflicted }
}

/** The record every committed-but-never-backed-up path in a switch shares:
 *  the adoption sidecar and the replaced auth.json. */
function changedRecord(path: string, mode: string, backupPath: string | null = null): TargetRecord {
  return { path, mode, backupPath, changed: true }
}

/**
 * Whether auth.json already holds the target profile's bytes after a failed
 * move. The replacement is atomic and last, so a failure normally leaves the
 * old credential and reverting routing is safe; a filesystem that is not
 * rename-atomic can still leave the new bytes in place, and reverting then
 * would pair the old endpoint with the new key. Only a positive match -- the
 * live file is now byte-identical to the profile -- suppresses the revert.
 */
async function credentialReplaced(ctx: Ctx, id: string): Promise<boolean> {
  try {
    return (await loadAuthState(ctx)).activeName === id
  } catch {
    return false
  }
}

/** A failed credential move: keep routing and the credential paired, and report
 *  every path that landed -- the auth.json itself when the move had committed
 *  before it threw, and the rollback failure when the restore did not take. */
async function throwAuthMoveFailure(
  ctx: Ctx,
  state: { pre: UsePreflight; committed: TargetRecord[] },
  err: unknown,
): Promise<never> {
  const { pre, committed } = state
  const failure = toCcsetError(err)
  const replaced = await credentialReplaced(ctx, pre.id)
  let routingRestored = false
  let rollback: CcsetError | undefined
  if (!replaced) {
    try {
      await restoreModelProvider(ctx, previousRoute(pre.configBase) ?? '')
      routingRestored = true
    } catch (rollbackErr) {
      rollback = toCcsetError(rollbackErr)
    }
  }
  let partial = committed.filter((record) => record.changed &&
    !(routingRestored && record.path === pre.file.path))
  if (replaced) {
    const authPath = codexAuthPath(ctx.home)
    partial = [...partial, changedRecord(authPath, await readMode(authPath))]
  }
  if (partial.length > 0 || rollback !== undefined) {
    throw new PartialCommitError(partial, failure, rollback)
  }
  throw failure
}

/** The live-auth half of a switch; a failure restores the original routing. */
async function authMoveRecords(
  ctx: Ctx,
  pre: UsePreflight,
  committed: TargetRecord[],
): Promise<TargetRecord[]> {
  const records: TargetRecord[] = []
  try {
    if (pre.adoptAs !== null) {
      const adopted = await adoptLiveAuth(ctx, pre.adoptAs)
      records.push(changedRecord(adopted, await readMode(adopted)))
      const saved = await applyPlan(pre.adoption, { dryRun: false, skipUnchanged: true })
      records.push(...saved.records)
    }
    const report = await activateAuthProfile(ctx, pre.id)
    records.push(changedRecord(report.authPath, await readMode(report.authPath), report.backupPath))
    return records
  } catch (err) {
    return throwAuthMoveFailure(ctx, { pre, committed: [...committed, ...records] }, err)
  }
}

/** The records a dry run plans for the credential move: the auth.json
 *  replacement, and the adoption sidecar a conflicted live auth is first
 *  copied to -- the same writes authMoveRecords commits for a real run. */
async function plannedAuthRecords(ctx: Ctx, pre: UsePreflight): Promise<TargetRecord[]> {
  const planned: TargetRecord[] = []
  if (pre.conflicted && pre.adoptAs !== null) {
    const adoptedPath = authProfilePath(ctx.home, pre.adoptAs)
    planned.push(
      changedRecord(adoptedPath, (await fileExists(adoptedPath)) ? await readMode(adoptedPath) : MODE_AFTER_WRITE),
    )
  }
  planned.push(...(await applyPlan(pre.adoption, { dryRun: true, skipUnchanged: true })).records)
  planned.push(
    changedRecord(
      codexAuthPath(ctx.home),
      pre.auth.exists ? await readMode(codexAuthPath(ctx.home)) : MODE_AFTER_WRITE,
    ),
  )
  return planned
}

export async function runProviderUse(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const id = request.providerId ?? ''
  const pre = await preflightProviderUse(ctx, id, request)
  const authChanged = !(pre.auth.exists && pre.auth.activeName === id)
  const outcome = await applyPlan(
    planTargets([
      {
        file: pre.file,
        base: pre.configBase,
        writes: [{ path: MODEL_PROVIDER_PATH, value: pre.routeTo }],
        backupsDir: backupsDir(ctx.home),
      },
    ]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  const targets: TargetRecord[] = [...outcome.records]
  if (authChanged) {
    if (request.dryRun) {
      // A dry run still plans the credential move it would make.
      targets.push(...(await plannedAuthRecords(ctx, pre)))
    } else {
      targets.push(...(await authMoveRecords(ctx, pre, outcome.records)))
    }
  }
  return {
    agent: 'codex',
    operation: 'provider.use',
    providerId: id,
    changed: outcome.changed || authChanged,
    dryRun: request.dryRun,
    targets,
    warnings: [],
    launchCommand: launchCommand(),
    launchKey: 'codex.write.activate',
  }
}

export { USE_COMMAND_FIELDS }
