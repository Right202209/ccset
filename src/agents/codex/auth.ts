import { promises as fs } from 'node:fs'
import type { Ctx, JsonObject } from '../../types.js'
import { backupFile } from '../../core/backup.js'
import { configFile, readConfigFile } from '../../core/config-file.js'
import { copyFileAtomic } from '../../core/copy.js'
import { ConfigParseError, isNotFound, wrapFsError } from '../../core/errors.js'
import { readMode } from '../../core/json-file.js'
import { getPath, type ManagedWrite } from '../../core/merge.js'
import { commitOne } from '../../operations/commit.js'
import { listNamedFiles } from '../../core/paths.js'
import { jsonToText } from '../../core/values.js'
import { AUTH_API_KEY, AUTH_MODE_API_KEY, AUTH_MODE_KEY, AUTH_STORE_KEY, AUTH_STORE_KEYRING } from './constants.js'
import { authProfileName, authProfilePath, backupsDir, codexAuthPath, codexDir } from './paths.js'

/**
 * Codex keeps the credential in `auth.json`, not in config.toml, and reads it
 * by exact name. ccset therefore stores one saved credential per provider in an
 * `auth.<name>.json` sidecar and copies the chosen one into place.
 *
 * ccset never read-modify-writes `auth.json`. Codex owns that file and rewrites
 * it on login and on token refresh, so editing it would race a live writer --
 * the same reason `~/.claude.json` is create-only for the Claude Code module.
 * Activation is a whole-file replace, taken after a backup, on an explicit
 * request. The sidecars, by contrast, are ccset's own files and are merged into.
 */

export interface AuthProfile {
  name: string
  path: string
  apiKey: string
  authMode: string
  /** False when the sidecar exists but is not readable JSON. */
  readable: boolean
}

/**
 * Codex keeps its credential in the OS keyring when this config.toml key says
 * `keyring` -- in which case it never reads auth.json, and every profile ccset
 * can offer would be ignored. Status reports it; provider use refuses.
 */
export function keyringInUseIn(data: JsonObject): boolean {
  return jsonToText(getPath(data, AUTH_STORE_KEY)) === AUTH_STORE_KEYRING
}

export interface AuthState {
  path: string
  exists: boolean
  mode: string
  apiKey: string
  authMode: string
  readable: boolean
  /** Name of the profile the live file is byte-identical to, if any. */
  activeName: string | null
  profiles: AuthProfile[]
}

function keyOf(data: JsonObject): string {
  return jsonToText(getPath(data, [AUTH_API_KEY]))
}

function modeOf(data: JsonObject): string {
  return jsonToText(getPath(data, [AUTH_MODE_KEY]))
}

async function readTextOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch (err) {
    if (isNotFound(err)) return null
    throw wrapFsError(err, filePath, 'r')
  }
}

/** A profile that will not parse is reported, never thrown: Status must render. */
async function describeProfile(name: string, filePath: string): Promise<AuthProfile> {
  try {
    const file = await readConfigFile(configFile(filePath, 'json'))
    return {
      name,
      path: filePath,
      apiKey: keyOf(file.data),
      authMode: modeOf(file.data),
      readable: true,
    }
  } catch (err) {
    if (!(err instanceof ConfigParseError)) throw err
    return { name, path: filePath, apiKey: '', authMode: '', readable: false }
  }
}

export async function listAuthProfiles(ctx: Ctx): Promise<AuthProfile[]> {
  const refs = await listNamedFiles(codexDir(ctx.home), authProfileName)
  return Promise.all(refs.map((ref) => describeProfile(ref.name, ref.path)))
}

/**
 * Which profile is live is decided by comparing bytes, not by trusting a marker
 * ccset wrote. A credential the user changed by hand, or one Codex refreshed,
 * then reads as "no profile active" rather than as the stale name.
 */
function matchName(
  liveRaw: string | null,
  raws: (string | null)[],
  profiles: AuthProfile[],
): string | null {
  if (liveRaw === null) return null
  const index = raws.findIndex((raw) => raw === liveRaw)
  return profiles[index]?.name ?? null
}

export async function loadAuthState(ctx: Ctx): Promise<AuthState> {
  const target = codexAuthPath(ctx.home)
  const profiles = await listAuthProfiles(ctx)
  const [liveRaw, ...rest] = await Promise.all([
    readTextOrNull(target),
    ...profiles.map((profile) => readTextOrNull(profile.path)),
  ])
  const live = await describeProfile('', target)
  return {
    path: target,
    exists: liveRaw !== null,
    mode: liveRaw === null ? '' : await readMode(target),
    apiKey: live.apiKey,
    authMode: live.authMode,
    readable: live.readable,
    activeName: matchName(liveRaw ?? null, rest, profiles),
    profiles,
  }
}

/**
 * The keys ccset manages in one profile sidecar: `auth_mode` says a key is
 * there, and the key itself. Everything else already in the sidecar -- an
 * adopted ChatGPT profile's `tokens` block -- is unmanaged and survives.
 */
export function authProfileWrites(apiKey: string): ManagedWrite[] {
  return [
    { path: [AUTH_MODE_KEY], value: AUTH_MODE_API_KEY },
    { path: [AUTH_API_KEY], value: apiKey },
  ]
}

/**
 * Writes the key into the provider's sidecar, preserving anything else already
 * in it -- an adopted ChatGPT profile keeps its `tokens` block, and `auth_mode`
 * is what decides which of the two Codex uses.
 */
export async function saveAuthProfile(ctx: Ctx, name: string, apiKey: string): Promise<string> {
  const target = authProfilePath(ctx.home, name)
  const file = configFile(target, 'json')
  await commitOne({
    file,
    base: await readConfigFile(file),
    writes: authProfileWrites(apiKey),
    backupsDir: backupsDir(ctx.home),
  })
  return target
}

/**
 * Saves the live auth.json as a named profile before something replaces it.
 * A byte copy, because the file may hold an OAuth token block ccset does not
 * model and must not reshape.
 */
export async function adoptLiveAuth(ctx: Ctx, name: string): Promise<string> {
  const target = authProfilePath(ctx.home, name)
  await copyFileAtomic(codexAuthPath(ctx.home), target)
  return target
}

export interface ActivationReport {
  authPath: string
  backupPath: string | null
  adoptedPath: string | null
}

/**
 * Replaces auth.json with the named profile. The backup is taken first and
 * unconditionally, so the credential being replaced survives even when the user
 * declined to adopt it as a profile.
 */
export async function activateAuthProfile(
  ctx: Ctx,
  name: string,
  adoptAs: string | null = null,
): Promise<ActivationReport> {
  const target = codexAuthPath(ctx.home)
  const adoptedPath = adoptAs === null ? null : await adoptLiveAuth(ctx, adoptAs)
  const backupPath = await backupFile(backupsDir(ctx.home), target)
  await copyFileAtomic(authProfilePath(ctx.home, name), target)
  return { authPath: target, backupPath, adoptedPath }
}

/**
 * Removes a saved credential. Backups can still hold it, which is why Status
 * says so and Clear ccset backups exists.
 */
export async function removeAuthProfile(ctx: Ctx, name: string): Promise<boolean> {
  try {
    await fs.unlink(authProfilePath(ctx.home, name))
    return true
  } catch (err) {
    if (isNotFound(err)) return false
    throw wrapFsError(err, authProfilePath(ctx.home, name), 'rw')
  }
}
