import type { JsonValue } from '../../types.js'
import { isPlainObject } from '../json-file.js'
import { CcsetError, EXIT_RUNTIME } from '../errors.js'
import { encodeTomlString } from './strings.js'

/**
 * Values ccset writes, rendered as TOML. Only the forms a manifest can produce
 * are handled -- string, number, boolean, and lists and tables of those. A
 * `null` is refused rather than guessed at, because the manifest's word for
 * "no value" is `undefined`, which the writer turns into a deletion; a `null`
 * arriving here means a bug upstream, and inventing a spelling for it would
 * hide that.
 */

const BARE_KEY = /^[A-Za-z0-9_-]+$/

export function formatTomlKey(key: string): string {
  return BARE_KEY.test(key) ? key : encodeTomlString(key)
}

/** Dotted key for a path relative to whichever table the line will sit in. */
export function formatTomlKeyPath(keys: string[]): string {
  return keys.map(formatTomlKey).join('.')
}

export function formatTomlValue(value: JsonValue): string {
  if (typeof value === 'string') return encodeTomlString(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return formatNumber(value)
  if (Array.isArray(value)) return `[${value.map(formatTomlValue).join(', ')}]`
  if (isPlainObject(value)) return formatInlineTable(value)
  throw new CcsetError('error.unwritableValue', EXIT_RUNTIME, { type: 'null' })
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new CcsetError('error.unwritableValue', EXIT_RUNTIME, { type: 'number' })
  }
  return String(value)
}

function formatInlineTable(value: Record<string, JsonValue>): string {
  const parts = Object.entries(value).map(
    ([key, item]) => `${formatTomlKey(key)} = ${formatTomlValue(item)}`,
  )
  return parts.length === 0 ? '{}' : `{ ${parts.join(', ')} }`
}

/** A whole `key = value` line, newline included. */
export function formatTomlLine(keys: string[], value: JsonValue): string {
  return `${formatTomlKeyPath(keys)} = ${formatTomlValue(value)}\n`
}

/** A `[a.b]` header line, newline included. */
export function formatTomlHeader(path: string[]): string {
  return `[${formatTomlKeyPath(path)}]\n`
}
