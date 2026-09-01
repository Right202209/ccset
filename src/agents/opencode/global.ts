import type { Ctx, FormValues, JsonObject, WriteReport } from '../../types.js'
import { backupFile } from '../../core/backup.js'
import { jsonFile, readJsonFile, readMode, writeJsonFileAtomic } from '../../core/json-file.js'
import { applyManagedWrites, getPath, type ManagedWrite } from '../../core/merge.js'
import { csvOrUndefined, jsonToText, textOrUndefined, withDefaults } from '../../core/values.js'
import { GLOBAL_DEFAULTS, GLOBAL_FIELDS } from './manifest.js'
import { backupsDir, launchCommand, opencodeConfigPath } from './paths.js'

/** Values exactly as they exist on disk; blank where the key is absent. */
export function seedGlobalFromDisk(data: JsonObject): FormValues {
  const seed: FormValues = {}
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    seed[field.id] = jsonToText(getPath(data, field.path))
  }
  return seed
}

/** opencode has no template defaults, so this is disk plus nothing. */
export function seedGlobal(data: JsonObject): FormValues {
  return withDefaults(seedGlobalFromDisk(data), GLOBAL_DEFAULTS)
}

/**
 * `autoupdate` is `true | false | "notify"` in the schema, so the two boolean
 * choices have to leave the form's string domain and become real JSON booleans.
 * Writing the string "false" would read as truthy to opencode.
 */
function autoupdateValue(raw: string | undefined): boolean | string | undefined {
  if (raw === undefined) return undefined
  if (raw === 'true') return true
  if (raw === 'false') return false
  return raw
}

function fieldWrite(fieldId: string, path: string[], values: FormValues): ManagedWrite {
  const raw = textOrUndefined(values[fieldId])
  if (fieldId === 'autoupdate') return { path, value: autoupdateValue(raw) }
  if (fieldId === 'disabledProviders') return { path, value: csvOrUndefined(values[fieldId]) }
  return { path, value: raw }
}

export function emitGlobal(values: FormValues): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    writes.push(fieldWrite(field.id, field.path, values))
  }
  return writes
}

/**
 * Re-reads the target immediately before writing, for the reason saveGlobal
 * gives in the Claude Code module: opencode rewrites this file itself while
 * ccset is open, and a parse from launch time would discard whatever it wrote.
 *
 * `startFresh` is the user's confirmed answer to a file that no longer parses;
 * the backup is taken either way, so the unreadable original survives.
 */
export async function saveGlobal(
  ctx: Ctx,
  values: FormValues,
  startFresh = false,
): Promise<WriteReport> {
  const target = opencodeConfigPath(ctx.home)
  const base = startFresh ? {} : (await readJsonFile(target)).data
  const backupPath = await backupFile(backupsDir(ctx.home), target)
  await writeJsonFileAtomic(jsonFile(target), applyManagedWrites(base, emitGlobal(values)))
  return {
    path: target,
    mode: await readMode(target),
    backupPath,
    command: launchCommand(),
    activateKey: 'opencode.write.activate',
  }
}
