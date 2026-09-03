import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Codec, ConfigFile, JsonObject } from '../types.js'
import { DIR_MODE, FILE_MODE, MODE_UNKNOWN } from './constants.js'
import { CcsetError, EXIT_RUNTIME, JsonParseError, isNotFound, wrapFsError } from './errors.js'

export interface LoadedFile {
  path: string
  exists: boolean
  data: JsonObject
}

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function jsonFile(filePath: string): ConfigFile {
  return { path: filePath, codec: 'json' }
}

function serialize(codec: Codec, data: JsonObject): string {
  if (codec !== 'json') {
    throw new CcsetError('error.unsupportedCodec', EXIT_RUNTIME, { codec })
  }
  return `${JSON.stringify(data, null, 2)}\n`
}

/** Turns "... at position 42" into a human line/column, best effort. */
function describePosition(err: unknown, raw: string): string {
  const message = err instanceof Error ? err.message : ''
  const match = /position (\d+)/.exec(message)
  if (match?.[1] === undefined) return message.slice(0, 80)
  const offset = Number(match[1])
  const before = raw.slice(0, offset)
  const line = before.split('\n').length
  const column = offset - before.lastIndexOf('\n')
  return `line ${line}, column ${column}`
}

export function parseJsonObject(raw: string, filePath: string): JsonObject {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new JsonParseError(filePath, describePosition(err, raw))
  }
  if (!isPlainObject(parsed)) throw new JsonParseError(filePath, 'root is not an object')
  return parsed
}

/** A missing file is not an error: it is an empty configuration. */
export async function readJsonFile(filePath: string): Promise<LoadedFile> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch (err) {
    if (isNotFound(err)) return { path: filePath, exists: false, data: {} }
    throw wrapFsError(err, filePath, 'r')
  }
  return { path: filePath, exists: true, data: parseJsonObject(raw, filePath) }
}

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true, mode: DIR_MODE })
  } catch (err) {
    throw wrapFsError(err, dirPath, 'rwx')
  }
}

/**
 * chmod is advisory on win32 -- it can only toggle the read-only bit and leaves
 * NTFS ACLs untouched -- so a failure there must not abort a valid write. The
 * POSIX 0600 guarantee is stated as POSIX-only for exactly this reason.
 */
async function chmodBestEffort(filePath: string): Promise<void> {
  try {
    await fs.chmod(filePath, FILE_MODE)
  } catch {
    /* platform does not support it; documented in the README */
  }
}

async function removeQuietly(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    /* nothing to clean up */
  }
}

/**
 * Temp file in the same directory, chmod, then rename. rename() is atomic on
 * POSIX, so a crash mid-write leaves the target either wholly old or wholly new.
 *
 * Takes text rather than data because a format-preserving codec produces an
 * edited copy of the original document, not a re-serialisation of a parse
 * (ADR 0003); the atomicity and the 0600 are the same either way.
 */
export async function writeTextAtomic(filePath: string, contents: string): Promise<void> {
  const dir = path.dirname(filePath)
  await ensureDir(dir)
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`)
  try {
    await fs.writeFile(tempPath, contents, { mode: FILE_MODE })
    await chmodBestEffort(tempPath)
    await fs.rename(tempPath, filePath)
    await chmodBestEffort(filePath)
  } catch (err) {
    await removeQuietly(tempPath)
    throw wrapFsError(err, filePath, 'rw')
  }
}

export async function writeJsonFileAtomic(file: ConfigFile, data: JsonObject): Promise<void> {
  await writeTextAtomic(file.path, serialize(file.codec, data))
}

/** Octal mode string for display, or a placeholder when it cannot be read. */
export async function readMode(filePath: string): Promise<string> {
  try {
    const stats = await fs.stat(filePath)
    return `0${(stats.mode & 0o777).toString(8)}`
  } catch {
    return MODE_UNKNOWN
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
