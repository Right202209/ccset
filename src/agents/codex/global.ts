import type { Ctx, FormValues, JsonObject, JsonValue, WriteReport } from '../../types.js'
import { backupFile } from '../../core/backup.js'
import { configFile, emptyConfig, readConfigFile, writeConfigFile } from '../../core/config-file.js'
import { readMode } from '../../core/json-file.js'
import { getPath, type ManagedWrite } from '../../core/merge.js'
import { intOrUndefined, jsonToText, textOrUndefined, withDefaults } from '../../core/values.js'
import {
  GLOBAL_DEFAULTS,
  GLOBAL_FIELDS,
  INTEGER_FIELD_IDS,
  MODEL_PROVIDER_PATH,
} from './manifest.js'
import { backupsDir, codexConfigPath, launchCommand } from './paths.js'

/** The one config document, edited in place so comments and order survive. */
export function codexConfigFile(home: string) {
  return configFile(codexConfigPath(home), 'toml')
}

/** Values exactly as they exist on disk; blank where the key is absent. */
export function seedGlobalFromDisk(data: JsonObject): FormValues {
  const seed: FormValues = {}
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    seed[field.id] = jsonToText(getPath(data, field.path))
  }
  return seed
}

/** Codex has no template default worth proposing, so this is disk plus nothing. */
export function seedGlobal(data: JsonObject): FormValues {
  return withDefaults(seedGlobalFromDisk(data), GLOBAL_DEFAULTS)
}

/**
 * `model_context_window` is a TOML integer. The form's domain is strings, and
 * writing "200000" would give Codex a string where it expects a number.
 */
function fieldValue(fieldId: string, values: FormValues): JsonValue | undefined {
  if (INTEGER_FIELD_IDS.has(fieldId)) return intOrUndefined(values[fieldId])
  return textOrUndefined(values[fieldId])
}

export function emitGlobal(values: FormValues): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of GLOBAL_FIELDS) {
    if (field.path === undefined) continue
    writes.push({ path: field.path, value: fieldValue(field.id, values) })
  }
  return writes
}

async function applyGlobal(
  ctx: Ctx,
  writes: ManagedWrite[],
  startFresh: boolean,
): Promise<WriteReport> {
  const file = codexConfigFile(ctx.home)
  const base = startFresh ? emptyConfig(file.path) : await readConfigFile(file)
  const backupPath = await backupFile(backupsDir(ctx.home), file.path)
  await writeConfigFile(file, base, writes)
  return {
    path: file.path,
    mode: await readMode(file.path),
    backupPath,
    command: launchCommand(),
    activateKey: 'codex.write.activate',
  }
}

/**
 * Re-reads the target immediately before writing: Codex rewrites config.toml
 * itself -- it patches project trust and the OSS provider preference -- and a
 * parse from launch time would discard whatever it wrote in between.
 *
 * `startFresh` is the user's confirmed answer to a file that no longer parses;
 * the backup is taken either way, so the unreadable original survives.
 */
export async function saveGlobal(
  ctx: Ctx,
  values: FormValues,
  startFresh = false,
): Promise<WriteReport> {
  return applyGlobal(ctx, emitGlobal(values), startFresh)
}

/** Points Codex's routing at a provider, leaving every other key alone. */
export async function saveModelProvider(
  ctx: Ctx,
  id: string,
  startFresh = false,
): Promise<WriteReport> {
  return applyGlobal(ctx, [{ path: MODEL_PROVIDER_PATH, value: id }], startFresh)
}
