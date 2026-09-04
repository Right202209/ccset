import { configFile, readConfigFile, type LoadedConfig } from '../../core/config-file.js'
import { CcsetError, EXIT_RUNTIME, EXIT_USAGE, PartialCommitError, toCcsetError, ValidationError } from '../../core/errors.js'
import { fileExists, readMode } from '../../core/json-file.js'
import { applyPlan, MODE_AFTER_WRITE, planTargets } from '../../operations/commit.js'
import type { OperationRequest, OperationResult, TargetRecord } from '../../operations/types.js'
import type { Ctx, ConfigFile } from '../../types.js'
import { makeKeyNameValidator } from '../../core/validate.js'
import { activateAuthProfile, keyringInUseIn, loadAuthState, type AuthState } from './auth.js'
import { MODEL_PROVIDER_PATH } from './manifest.js'
import { authProfilePath, backupsDir, codexAuthPath, codexHomeOverride, launchCommand } from './paths.js'
import { codexConfigFile } from './global.js'

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
  auth: AuthState
  file: ConfigFile
  configBase: LoadedConfig
  adoptAs: string | null
  replaceCurrent: boolean
  conflicted: boolean
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
  if (keyringInUseIn(configBase.data)) {
    throw new CcsetError('codex.error.keyringUnsupported', EXIT_RUNTIME)
  }
  const override = codexHomeOverride(ctx.home)
  if (override !== null) {
    throw new CcsetError('codex.error.homeOverrideUnsupported', EXIT_RUNTIME, { path: override })
  }
  const conflicted = auth.exists && auth.activeName === null
  if (conflicted && adoptAs === null && !replaceCurrent) {
    throw new ValidationError('codex.validate.conflictNeedsChoice', { path: auth.path })
  }
  if (adoptAs !== null) {
    const problem = makeKeyNameValidator(auth.profiles.map((candidate) => candidate.name))(adoptAs)
    if (problem !== null) throw new ValidationError(problem, { name: adoptAs })
  }
  return { auth, file, configBase, adoptAs, replaceCurrent, conflicted }
}

/** Adoption commits the new profile before the live copy; if the copy fails,
 * the partial report must still name the profile the adoption already wrote. */
async function withAdoptedProfile(
  ctx: Ctx,
  pre: UsePreflight,
  committed: TargetRecord[],
): Promise<TargetRecord[]> {
  if (pre.conflicted && pre.adoptAs !== null) {
    const adoptedPath = authProfilePath(ctx.home, pre.adoptAs)
    if (await fileExists(adoptedPath)) {
      return [
        ...committed,
        { path: adoptedPath, mode: await readMode(adoptedPath), backupPath: null, changed: true },
      ]
    }
  }
  return committed
}

/** The live-auth half of a switch: planned in a dry run, committed after routing. */
async function authMoveRecords(
  ctx: Ctx,
  id: string,
  pre: UsePreflight,
  dryRun: boolean,
  committed: TargetRecord[],
): Promise<TargetRecord[]> {
  const authPath = codexAuthPath(ctx.home)
  if (dryRun) {
    return [
      {
        path: authPath,
        mode: pre.auth.exists ? await readMode(authPath) : MODE_AFTER_WRITE,
        backupPath: null,
        changed: true,
      },
    ]
  }
  let report
  try {
    report = await activateAuthProfile(ctx, id, pre.conflicted && pre.adoptAs !== null ? pre.adoptAs : null)
  } catch (err) {
    // Routing already landed; the envelope has to say so.
    throw new PartialCommitError(await withAdoptedProfile(ctx, pre, committed), toCcsetError(err))
  }
  const records: TargetRecord[] = []
  if (report.adoptedPath !== null) {
    records.push({
      path: report.adoptedPath,
      mode: await readMode(report.adoptedPath),
      backupPath: null,
      changed: true,
    })
  }
  records.push({
    path: report.authPath,
    mode: await readMode(report.authPath),
    backupPath: report.backupPath,
    changed: true,
  })
  return records
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
        writes: [{ path: MODEL_PROVIDER_PATH, value: id }],
        backupsDir: backupsDir(ctx.home),
      },
    ]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  const targets: TargetRecord[] = [...outcome.records]
  if (authChanged) {
    targets.push(...(await authMoveRecords(ctx, id, pre, request.dryRun, outcome.records)))
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
