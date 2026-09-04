import { configFile, readConfigFile, type LoadedConfig } from '../../core/config-file.js'
import { FILE_MODE } from '../../core/constants.js'
import {
  CcsetError,
  EXIT_RUNTIME,
  EXIT_USAGE,
  PartialCommitError,
  toCcsetError,
  ValidationError,
} from '../../core/errors.js'
import { isPlainObject, readMode } from '../../core/json-file.js'
import { getPath, type ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type {
  CommandDeclaration,
  CommandFieldSpec,
  Finding,
  OperationRequest,
  OperationResult,
  TargetRecord,
} from '../../operations/types.js'
import type { Ctx, JsonObject } from '../../types.js'
import { makeKeyNameValidator, validateBaseUrl, validateOptionalPositiveInt } from '../../core/validate.js'
import { activateAuthProfile, keyringInUseIn, authProfileWrites, loadAuthState } from './auth.js'
import {
  APPROVAL_NEVER,
  APPROVAL_ON_REQUEST,
  AUTH_API_KEY,
  REQUIRES_OPENAI_AUTH,
  SANDBOX_DANGER_FULL_ACCESS,
  SANDBOX_READ_ONLY,
  SANDBOX_WORKSPACE_WRITE,
  VERBOSITY_HIGH,
  VERBOSITY_LOW,
  VERBOSITY_MEDIUM,
  WIRE_API_RESPONSES,
} from './constants.js'
import { codexConfigFile } from './global.js'
import {
  GLOBAL_FIELDS,
  INTEGER_FIELD_IDS,
  MODEL_PROVIDER_PATH,
  PROVIDER_KEYS,
  providerKeyPath,
  providerPath,
  validateProviderId,
} from './manifest.js'
import { authProfilePath, backupsDir, codexAuthPath, codexConfigPath, codexHomeOverride } from './paths.js'
import {
  codexStatusFindings,
  presentCodexStatus,
  readCodexStatus,
  type CodexStatusDto,
} from './status-dto.js'

/**
 * Codex's Non-interactive declarations. The one config document is edited by
 * the format-preserving TOML codec, so every patch lands inside the spans it
 * names and every comment, blank line and unmanaged key around it survives.
 */

const GLOBAL_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'model', option: '--model', type: 'text', unsettable: true },
  { id: 'modelProvider', option: '--model-provider', type: 'text', unsettable: true },
  { id: 'reasoningEffort', option: '--reasoning-effort', type: 'text', unsettable: true },
  {
    id: 'approvalPolicy',
    option: '--approval-policy',
    type: 'choice',
    choices: [APPROVAL_ON_REQUEST, APPROVAL_NEVER],
    unsettable: true,
  },
  {
    id: 'sandboxMode',
    option: '--sandbox-mode',
    type: 'choice',
    choices: [SANDBOX_READ_ONLY, SANDBOX_WORKSPACE_WRITE, SANDBOX_DANGER_FULL_ACCESS],
    unsettable: true,
  },
  {
    id: 'verbosity',
    option: '--verbosity',
    type: 'choice',
    choices: [VERBOSITY_LOW, VERBOSITY_MEDIUM, VERBOSITY_HIGH],
    unsettable: true,
  },
  {
    id: 'contextWindow',
    option: '--context-window',
    type: 'int',
    validate: validateOptionalPositiveInt,
    unsettable: true,
  },
]

function managedPathOf(fieldId: string): string[] | undefined {
  return GLOBAL_FIELDS.find((field) => field.id === fieldId)?.path
}

/**
 * `model_context_window` is a TOML integer; writing "200000" would hand Codex
 * a string where its schema wants a number. Everything else here is a string.
 */
function globalPatchWrites(request: OperationRequest): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of GLOBAL_COMMAND_FIELDS) {
    const path = managedPathOf(field.id)
    if (path === undefined) continue
    if (request.unsets.includes(field.id)) {
      writes.push({ path, value: undefined })
      continue
    }
    const value = request.patch[field.id]
    if (value === undefined) continue
    writes.push({
      path,
      value: INTEGER_FIELD_IDS.has(field.id) ? Number(value) : String(value),
    })
  }
  return writes
}

async function runGlobalSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const file = codexConfigFile(ctx.home)
  const base = await readPatchBase(file, request.replaceInvalid)
  const outcome = await applyPlan(
    planTargets([{ file, base, writes: globalPatchWrites(request), backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return {
    agent: 'codex',
    operation: 'global.set',
    changed: outcome.changed,
    dryRun: request.dryRun,
    targets: outcome.records,
    warnings: [],
  }
}

/** Status reads everything through the raw DTO and never writes. */
async function runStatus(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const data = await readCodexStatus(ctx)
  const { warnings, errors } = codexStatusFindings(data)
  return {
    agent: 'codex',
    operation: 'status',
    changed: false,
    dryRun: request.dryRun,
    targets: [],
    warnings,
    errors,
    data: data as unknown as Record<string, unknown>,
  }
}

/* ---------------------------------------------------------- provider set */

const PROVIDER_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'displayName', option: '--display-name', type: 'text', unsettable: true },
  { id: 'baseUrl', option: '--base-url', type: 'text', validate: validateBaseUrl },
  {
    id: 'requestMaxRetries',
    option: '--request-max-retries',
    type: 'int',
    validate: validateOptionalPositiveInt,
    unsettable: true,
  },
  {
    id: 'streamMaxRetries',
    option: '--stream-max-retries',
    type: 'int',
    validate: validateOptionalPositiveInt,
    unsettable: true,
  },
  {
    id: 'streamIdleTimeoutMs',
    option: '--stream-idle-timeout-ms',
    type: 'int',
    validate: validateOptionalPositiveInt,
    unsettable: true,
  },
]

function providerFieldPath(fieldId: string, id: string): string[] | undefined {
  const byId: Record<string, string[]> = {
    displayName: providerKeyPath(id, PROVIDER_KEYS.name),
    baseUrl: providerKeyPath(id, PROVIDER_KEYS.baseUrl),
    requestMaxRetries: providerKeyPath(id, PROVIDER_KEYS.requestMaxRetries),
    streamMaxRetries: providerKeyPath(id, PROVIDER_KEYS.streamMaxRetries),
    streamIdleTimeoutMs: providerKeyPath(id, PROVIDER_KEYS.streamIdleTimeoutMs),
  }
  return byId[fieldId]
}

/**
 * The patch maps onto managed keys; the two invariants ride along on every
 * save, exactly as the TUI's emitProvider does -- `wire_api` has one legal
 * value as of Codex v0.152.0, and `requires_openai_auth` is what makes Codex
 * consult the saved credential for this provider at all.
 */
function providerPatchWrites(request: OperationRequest, id: string): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of PROVIDER_COMMAND_FIELDS) {
    const path = providerFieldPath(field.id, id)
    if (path === undefined) continue
    if (request.unsets.includes(field.id)) {
      writes.push({ path, value: undefined })
      continue
    }
    const value = request.patch[field.id]
    if (value !== undefined) {
      writes.push({
        path,
        value: INTEGER_FIELD_IDS.has(field.id) ? Number(value) : String(value),
      })
    }
  }
  writes.push({ path: providerKeyPath(id, PROVIDER_KEYS.wireApi), value: WIRE_API_RESPONSES })
  writes.push({
    path: providerKeyPath(id, PROVIDER_KEYS.requiresOpenaiAuth),
    value: REQUIRES_OPENAI_AUTH,
  })
  return writes
}

/** The secret never rides in config.toml; it lives in the profile sidecar. */
function profileHasKey(data: JsonObject): boolean {
  const key = getPath(data, [AUTH_API_KEY])
  return typeof key === 'string' && key.length > 0
}

/**
 * Findings that change what a saved profile is worth, computed before any
 * write: a keyring store means Codex will not read the sidecar, and a
 * CODEX_HOME elsewhere means the files ccset writes are not the ones it reads.
 */
function providerPreflightWarnings(base: JsonObject, home: string): Finding[] {
  const warnings: Finding[] = []
  if (keyringInUseIn(base)) warnings.push({ code: 'codex.warning.keyringStore' })
  const override = codexHomeOverride(home)
  if (override !== null) {
    warnings.push({ code: 'codex.warning.homeOverride', params: { path: override } })
  }
  return warnings
}

async function runProviderSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const id = request.providerId ?? ''
  const file = codexConfigFile(ctx.home)
  const base = await readPatchBase(file, request.replaceInvalid)
  const block = getPath(base.data, providerPath(id))
  if (!(base.exists && isPlainObject(block))) {
    if (typeof request.patch['baseUrl'] !== 'string') {
      throw new ValidationError('codex.validate.providerBaseUrlRequired', { name: id })
    }
  }
  const authFile = configFile(authProfilePath(ctx.home, id), 'json')
  // Refuses (exit 4) when the sidecar does not parse: it may carry an adopted
  // ChatGPT profile's tokens block, so it is never replaced wholesale.
  const authBase = await readConfigFile(authFile)
  if (request.secret === undefined && !(authBase.exists && profileHasKey(authBase.data))) {
    throw new ValidationError('codex.validate.providerTokenRequired', { name: id })
  }
  const warnings = providerPreflightWarnings(base.data, ctx.home)
  const targets = [
    {
      file,
      base,
      writes: providerPatchWrites(request, id),
      backupsDir: backupsDir(ctx.home),
    },
  ]
  if (request.secret !== undefined) {
    targets.push({
      file: authFile,
      base: authBase,
      writes: authProfileWrites(request.secret),
      backupsDir: backupsDir(ctx.home),
    })
  }
  const outcome = await applyPlan(planTargets(targets), {
    dryRun: request.dryRun,
    skipUnchanged: true,
  })
  const records = [...outcome.records]
  if (request.secret === undefined) {
    // The profile is reported, not rewritten: with no secret supplied the
    // operation has nothing to say about its bytes, and a JSON re-render
    // would only churn the file.
    records.push({
      path: authFile.path,
      mode: await readMode(authFile.path),
      backupPath: null,
      changed: false,
    })
  }
  return {
    agent: 'codex',
    operation: 'provider.set',
    providerId: id,
    changed: outcome.changed,
    dryRun: request.dryRun,
    targets: records,
    warnings,
  }
}

/* --------------------------------------------------------- provider use */

const USE_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'adoptCurrentAs', option: '--adopt-current-as', type: 'text' },
  { id: 'replaceCurrentAuth', option: '--replace-current-auth', type: 'flag' },
]

function modeAfterWrite(): string {
  return `0${FILE_MODE.toString(8)}`
}

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

async function runProviderUse(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const id = request.providerId ?? ''
  // Preflight, in order, before any rename or copy: the profile must exist and
  // parse, the document must be readable, and an environment that would make
  // the switch a no-op is refused rather than papered over with a warning.
  const auth = await loadAuthState(ctx)
  const profile = auth.profiles.find((candidate) => candidate.name === id)
  if (profile === undefined) {
    throw new ValidationError('codex.status.noProfileFor', { id })
  }
  // A profile that does not parse is never activated wholesale (exit 4).
  await readConfigFile(configFile(profile.path, 'json'))
  const file = codexConfigFile(ctx.home)
  const configBase: LoadedConfig = await readConfigFile(file)
  if (keyringInUseIn(configBase.data)) {
    throw new CcsetError('codex.error.keyringUnsupported', EXIT_RUNTIME)
  }
  const override = codexHomeOverride(ctx.home)
  if (override !== null) {
    throw new CcsetError('codex.error.homeOverrideUnsupported', EXIT_RUNTIME, { path: override })
  }
  const { adoptAs, replaceCurrent } = adoptChoiceOf(request)
  const conflicted = auth.exists && auth.activeName === null
  if (conflicted && adoptAs === null && !replaceCurrent) {
    throw new ValidationError('codex.validate.conflictNeedsChoice', { path: auth.path })
  }
  if (adoptAs !== null) {
    const problem = makeKeyNameValidator(auth.profiles.map((candidate) => candidate.name))(adoptAs)
    if (problem !== null) throw new ValidationError(problem, { name: adoptAs })
  }
  const authChanged = !(auth.exists && auth.activeName === id)
  const outcome = await applyPlan(
    planTargets([
      {
        file,
        base: configBase,
        writes: [{ path: MODEL_PROVIDER_PATH, value: id }],
        backupsDir: backupsDir(ctx.home),
      },
    ]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  const targets: TargetRecord[] = [...outcome.records]
  if (authChanged) {
    const authPath = codexAuthPath(ctx.home)
    if (request.dryRun) {
      targets.push({
        path: authPath,
        mode: auth.exists ? await readMode(authPath) : modeAfterWrite(),
        backupPath: null,
        changed: true,
      })
    } else {
      let report
      try {
        report = await activateAuthProfile(ctx, id, conflicted && adoptAs !== null ? adoptAs : null)
      } catch (err) {
        // Routing already landed; the envelope has to say so.
        throw new PartialCommitError(outcome.records, toCcsetError(err))
      }
      if (report.adoptedPath !== null) {
        targets.push({
          path: report.adoptedPath,
          mode: await readMode(report.adoptedPath),
          backupPath: null,
          changed: true,
        })
      }
      targets.push({
        path: report.authPath,
        mode: await readMode(report.authPath),
        backupPath: report.backupPath,
        changed: true,
      })
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
  }
}

export const codexCommands: CommandDeclaration[] = [
  {
    id: 'global.set',
    fields: GLOBAL_COMMAND_FIELDS,
    patchRequired: true,
    replaceable: true,
    presentation: { successTitleKey: () => 'write.globalSaved' },
    run: runGlobalSet,
  },
  {
    id: 'provider.set',
    argument: 'providerId',
    fields: PROVIDER_COMMAND_FIELDS,
    takesSecret: true,
    replaceable: true,
    patchRequired: true,
    validateArgument: validateProviderId,
    presentation: { successTitleKey: () => 'codex.write.providerSaved' },
    run: runProviderSet,
  },
  {
    id: 'provider.use',
    argument: 'providerId',
    fields: USE_COMMAND_FIELDS,
    validateArgument: validateProviderId,
    presentation: { successTitleKey: () => 'codex.write.switched' },
    run: runProviderUse,
  },
  {
    id: 'status',
    fields: [],
    presentation: {
      successTitleKey: () => 'action.status',
      presentStatus: (data) => presentCodexStatus(data as unknown as CodexStatusDto),
    },
    run: runStatus,
  },
]
