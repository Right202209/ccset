import { configFile, readConfigFile, type LoadedConfig } from '../../core/config-file.js'
import { ValidationError } from '../../core/errors.js'
import { isPlainObject, readMode } from '../../core/json-file.js'
import { getPath, type ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type { Finding, OperationRequest, OperationResult } from '../../operations/types.js'
import type { Ctx, ConfigFile, JsonObject } from '../../types.js'
import { validateBaseUrl, validateOptionalPositiveInt } from '../../core/validate.js'
import { keyringInUseIn, authProfileWrites } from './auth.js'
import {
  AUTH_API_KEY,
  REQUIRES_OPENAI_AUTH,
  WIRE_API_RESPONSES,
} from './constants.js'
import { INTEGER_FIELD_IDS, PROVIDER_KEYS, providerKeyPath, providerPath } from './manifest.js'
import { authProfilePath, backupsDir, codexAuthPath, codexHomeOverride, launchCommand } from './paths.js'
import { codexConfigFile } from './global.js'

/**
 * Codex's provider operations over the Non-interactive seam. The provider
 * table lives in the one config document and the credential lives in the
 * per-provider auth sidecar, so both provider commands are two-target
 * operations with the settings document committed first.
 */

const PROVIDER_COMMAND_FIELDS = [
  { id: 'displayName', option: '--display-name', type: 'text' as const, unsettable: true },
  { id: 'baseUrl', option: '--base-url', type: 'text' as const, validate: validateBaseUrl },
  {
    id: 'requestMaxRetries',
    option: '--request-max-retries',
    type: 'int' as const,
    validate: validateOptionalPositiveInt,
    unsettable: true,
  },
  {
    id: 'streamMaxRetries',
    option: '--stream-max-retries',
    type: 'int' as const,
    validate: validateOptionalPositiveInt,
    unsettable: true,
  },
  {
    id: 'streamIdleTimeoutMs',
    option: '--stream-idle-timeout-ms',
    type: 'int' as const,
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

interface ProviderSetPreflight {
  id: string
  file: ConfigFile
  base: LoadedConfig
  authFile: ConfigFile
  authBase: LoadedConfig
  warnings: Finding[]
}

/** Reads and validates both targets before anything is planned or written. */
async function preflightProviderSet(
  ctx: Ctx,
  request: OperationRequest,
): Promise<ProviderSetPreflight> {
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
  return { id, file, base, authFile, authBase, warnings: providerPreflightWarnings(base.data, ctx.home) }
}

export async function runProviderSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const pre = await preflightProviderSet(ctx, request)
  const targets = [
    {
      file: pre.file,
      base: pre.base,
      writes: providerPatchWrites(request, pre.id),
      backupsDir: backupsDir(ctx.home),
    },
  ]
  if (request.secret !== undefined) {
    targets.push({
      file: pre.authFile,
      base: pre.authBase,
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
      path: pre.authFile.path,
      mode: await readMode(pre.authFile.path),
      backupPath: null,
      changed: false,
    })
  }
  return {
    agent: 'codex',
    operation: 'provider.set',
    providerId: pre.id,
    changed: outcome.changed,
    dryRun: request.dryRun,
    targets: records,
    warnings: pre.warnings,
    launchCommand: launchCommand(),
    launchKey: 'codex.write.activate',
  }
}
export { PROVIDER_COMMAND_FIELDS }
