import type { Ctx, FormValues, JsonObject, WriteReport } from '../../types.js'
import { jsonFile } from '../../core/json-file.js'
import { getPath, getStringAt, type ManagedWrite } from '../../core/merge.js'
import { commitOne, readPatchBase } from '../../operations/commit.js'
import { activationCommand, backupsDir, globalSettingsPath } from './paths.js'
import {
  ENV_HTTPS_PROXY,
  ENV_HTTP_PROXY,
  GLOBAL_DEFAULTS,
  GLOBAL_FIELDS,
} from './manifest.js'
import {
  asBool,
  intOrUndefined,
  jsonToText,
  textOrUndefined,
  withDefaults,
} from '../../core/values.js'

/** Values exactly as they exist on disk; blank where the key is absent. */
export function seedGlobalFromDisk(data: JsonObject): FormValues {
  const httpsProxy = getStringAt(data, ENV_HTTPS_PROXY)
  const httpProxy = getStringAt(data, ENV_HTTP_PROXY)
  const seed: FormValues = {
    proxyEnabled: httpsProxy !== undefined || httpProxy !== undefined,
    proxyUrl: httpsProxy ?? httpProxy ?? '',
  }
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    seed[field.id] = jsonToText(getPath(data, field.path))
  }
  return seed
}

/** Proposed values: disk first, template defaults only to fill the gaps. */
export function seedGlobal(data: JsonObject): FormValues {
  return withDefaults(seedGlobalFromDisk(data), GLOBAL_DEFAULTS)
}

/**
 * The proxy is two keys behind one toggle: turning it off deletes both, which
 * is the whole reason the manifest carries deletes.
 */
function proxyWrites(values: FormValues): ManagedWrite[] {
  const url = textOrUndefined(values['proxyUrl'])
  const value = asBool(values['proxyEnabled']) ? url : undefined
  return [
    { path: ENV_HTTPS_PROXY, value },
    { path: ENV_HTTP_PROXY, value },
  ]
}

function fieldWrite(fieldId: string, path: string[], values: FormValues): ManagedWrite {
  if (fieldId === 'cleanupPeriodDays') {
    return { path, value: intOrUndefined(values[fieldId]) }
  }
  return { path, value: textOrUndefined(values[fieldId]) }
}

export function emitGlobal(values: FormValues): ManagedWrite[] {
  const writes = proxyWrites(values)
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    writes.push(fieldWrite(field.id, field.path, values))
  }
  return writes
}

/**
 * Re-reads the target immediately before writing: Claude Code persists /model,
 * /config and effort changes into settings.json while ccset is open, and the
 * parse from launch time would silently discard them.
 *
 * `startFresh` is the user's answer to a file that is already malformed JSON:
 * the read is skipped and the managed keys are written over an empty object.
 * It is never taken without an explicit confirmation, and the backup is taken
 * either way, so the unreadable original survives.
 *
 * The write itself is the shared plan/apply core, the same one a
 * Non-interactive command runs; only the value mapping and the presentation
 * are the TUI Adapter's own.
 */
export async function saveGlobal(
  ctx: Ctx,
  values: FormValues,
  startFresh = false,
): Promise<WriteReport> {
  const target = globalSettingsPath(ctx.home)
  const file = jsonFile(target)
  const report = await commitOne({
    file,
    base: await readPatchBase(file, startFresh),
    writes: emitGlobal(values),
    backupsDir: backupsDir(ctx.home),
  })
  return { ...report, command: activationCommand(target) }
}
