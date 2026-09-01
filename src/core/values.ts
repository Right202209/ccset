import type { FieldValue, FormValues, JsonValue } from '../types.js'
import { isPlainObject } from './json-file.js'

/** Coercions between form values (strings and booleans) and JSON values. */

export function asText(value: FieldValue | undefined): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

export function asBool(value: FieldValue | undefined): boolean {
  return value === true
}

/** Blank means "omit the key entirely" -- never null, never "" (PRD F7). */
export function textOrUndefined(value: FieldValue | undefined): string | undefined {
  const text = asText(value).trim()
  return text.length > 0 ? text : undefined
}

export function intOrUndefined(value: FieldValue | undefined): number | undefined {
  const text = asText(value).trim()
  if (text.length === 0) return undefined
  const parsed = Number.parseInt(text, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

export function csvOrUndefined(value: FieldValue | undefined): string[] | undefined {
  const parts = asText(value)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  return parts.length > 0 ? parts : undefined
}

/** JSON -> form text. Arrays render as a comma-separated list. */
export function jsonToText(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.map((item) => jsonToText(item)).join(', ')
  if (isPlainObject(value)) return ''
  return String(value)
}

/** Shallow copy with defaults filled in only where the seed has no value. */
export function withDefaults(seed: FormValues, defaults: FormValues): FormValues {
  const merged: FormValues = { ...seed }
  for (const [key, fallback] of Object.entries(defaults)) {
    const current = merged[key]
    if (current === undefined || current === '') merged[key] = fallback
  }
  return merged
}
