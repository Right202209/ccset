import type { Ctx, FormValues, JsonObject, WriteReport } from '../../types.js'
import { getPath, type ManagedWrite } from '../../core/merge.js'
import { commitOne, readPatchBase } from '../../operations/commit.js'
import { jsonToText, textOrUndefined, withDefaults } from '../../core/values.js'
import { GLOBAL_DEFAULTS, GLOBAL_FIELDS } from './manifest.js'
import { withActivation } from './result.js'
import { backupsDir, configFile } from './paths.js'

/** Values exactly as they exist on disk; blank where the key is absent. */
export function seedGlobalFromDisk(data: JsonObject): FormValues {
  const seed: FormValues = {}
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    seed[field.id] = jsonToText(getPath(data, field.path))
  }
  return seed
}

/** Grok has no template default worth proposing: this is disk plus nothing. */
export function seedGlobal(data: JsonObject): FormValues {
  return withDefaults(seedGlobalFromDisk(data), GLOBAL_DEFAULTS)
}

/**
 * The one managed global field is a string or absent: a blank form field means
 * the key is removed, and Grok falls back to its own resolution for whatever a
 * removed key used to decide.
 */
export function emitGlobal(values: FormValues): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    writes.push({ path: field.path, value: textOrUndefined(values[field.id]) })
  }
  return writes
}

/**
 * Re-reads the target immediately before writing: Grok rewrites config.toml
 * itself (/settings) while ccset is open, and a parse from launch time would
 * discard whatever it wrote.
 *
 * `startFresh` is the user's confirmed answer to a file that no longer parses;
 * the backup is taken either way, so the unreadable original survives.
 */
export async function saveGlobal(
  ctx: Ctx,
  values: FormValues,
  startFresh = false,
): Promise<WriteReport> {
  const file = configFile(ctx.home)
  const report = await commitOne({
    file,
    base: await readPatchBase(file, startFresh),
    writes: emitGlobal(values),
    backupsDir: backupsDir(ctx.home),
  })
  return withActivation(report)
}
