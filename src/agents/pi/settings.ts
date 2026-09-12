import type { Ctx, FormValues, JsonObject, WriteReport } from '../../types.js'
import { getPath, type ManagedWrite } from '../../core/merge.js'
import { commitOne, readPatchBase } from '../../operations/commit.js'
import { jsonToText, textOrUndefined, withDefaults } from '../../core/values.js'
import { GLOBAL_DEFAULTS, GLOBAL_FIELDS } from './manifest.js'
import { withActivation } from './result.js'
import { backupsDir, settingsFile } from './paths.js'

/** Values exactly as they exist on disk; blank where the key is absent. */
export function seedSettingsFromDisk(data: JsonObject): FormValues {
  const seed: FormValues = {}
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    seed[field.id] = jsonToText(getPath(data, field.path))
  }
  return seed
}

/** pi has no template defaults for startup selection: this is disk plus nothing. */
export function seedSettings(data: JsonObject): FormValues {
  return withDefaults(seedSettingsFromDisk(data), GLOBAL_DEFAULTS)
}

/**
 * Every managed settings field is a string or absent: a blank form field means
 * the key is removed, and pi falls back to its own resolution for whatever a
 * removed key used to decide.
 */
function fieldWrite(fieldId: string, path: string[], values: FormValues): ManagedWrite {
  return { path, value: textOrUndefined(values[fieldId]) }
}

export function emitSettings(values: FormValues): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    writes.push(fieldWrite(field.id, field.path, values))
  }
  return writes
}

/**
 * Re-reads the target immediately before writing: pi rewrites settings.json
 * itself (/model, /settings) while ccset is open, and a parse from launch time
 * would discard whatever it wrote.
 *
 * `startFresh` is the user's confirmed answer to a file that no longer parses;
 * the backup is taken either way, so the unreadable original survives.
 */
export async function saveSettings(
  ctx: Ctx,
  values: FormValues,
  startFresh = false,
): Promise<WriteReport> {
  const file = settingsFile(ctx.home)
  const report = await commitOne({
    file,
    base: await readPatchBase(file, startFresh),
    writes: emitSettings(values),
    backupsDir: backupsDir(ctx.home),
  })
  return withActivation(report)
}
