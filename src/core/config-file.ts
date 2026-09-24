import { promises as fs } from 'node:fs'
import type { ConfigFile, JsonObject } from '../types.js'
import {
  CcsetError,
  ConfigParseError,
  EXIT_RUNTIME,
  JsonParseError,
  TomlParseError,
  isNotFound,
  wrapFsError,
} from './errors.js'
import { findJsoncProblem, applyJsoncWrites, readJsoncObject } from './jsonc/index.js'
import { parseJsonObject } from './json-file.js'
import { applyManagedWrites, type ManagedWrite } from './merge.js'
import { applyTomlWrites, findTomlProblem, readTomlObject } from './toml/index.js'

/**
 * The codec seam. An agent module names a format and hands over `ManagedWrite`s;
 * everything below this line -- how a document is read, and how a managed key is
 * set or removed without disturbing anything else -- belongs to the codec.
 *
 * The `raw` field is why this exists separately from json-file.ts. A JSON write
 * can be rebuilt from parsed data, but a format-preserving TOML or JSONC write
 * edits the original text, so the base a save merges into has to carry the text
 * as well as the object.
 */

export interface LoadedConfig {
  path: string
  exists: boolean
  /** Parsed form, for seeding a form and for Status. */
  data: JsonObject
  /** Original document, for a codec that edits rather than re-serialises. */
  raw: string
}

export function configFile(path: string, codec: ConfigFile['codec']): ConfigFile {
  return { path, codec }
}

/** A base with nothing in it: the confirmed answer to a malformed target. */
export function emptyConfig(path: string): LoadedConfig {
  return { path, exists: false, data: {}, raw: '' }
}

function parse(file: ConfigFile, raw: string): JsonObject {
  if (file.codec === 'json') return parseJsonObject(raw, file.path)
  if (file.codec === 'jsonc') {
    const problem = findJsoncProblem(raw)
    if (problem !== null) throw new JsonParseError(file.path, problem)
    return readJsoncObject(raw)
  }
  const problem = findTomlProblem(raw)
  if (problem !== null) throw new TomlParseError(file.path, problem)
  return readTomlObject(raw)
}

/** A missing file is not an error: it is an empty configuration. */
export async function readConfigFile(file: ConfigFile): Promise<LoadedConfig> {
  let raw: string
  try {
    raw = await fs.readFile(file.path, 'utf8')
  } catch (err) {
    if (isNotFound(err)) return emptyConfig(file.path)
    throw wrapFsError(err, file.path, 'r')
  }
  return { path: file.path, exists: true, data: parse(file, raw), raw }
}

function render(file: ConfigFile, base: LoadedConfig, writes: ManagedWrite[]): string {
  if (file.codec === 'toml') return applyTomlWrites(base.raw, writes)
  if (file.codec === 'jsonc') return applyJsoncWrites(base.raw, writes)
  if (file.codec === 'json') {
    return `${JSON.stringify(applyManagedWrites(base.data, writes), null, 2)}\n`
  }
  throw new CcsetError('error.unsupportedCodec', EXIT_RUNTIME, { codec: file.codec })
}

function validateRendered(file: ConfigFile, rendered: string): void {
  try {
    parse(file, rendered)
  } catch (err) {
    if (!(err instanceof ConfigParseError)) throw err
    throw new CcsetError('error.renderedConfigInvalid', EXIT_RUNTIME, {
      format: file.codec,
      path: file.path,
      position: err.params['position'] ?? 'unknown position',
    })
  }
}

/**
 * The plan half of a save: the exact bytes the writes would put on disk,
 * without touching anything. The operation layer compares this against the
 * disk text to detect a no-op; the apply half commits it after a backup.
 */
export function renderConfigFile(
  file: ConfigFile,
  base: LoadedConfig,
  writes: ManagedWrite[],
): string {
  const rendered = render(file, base, writes)
  validateRendered(file, rendered)
  return rendered
}
