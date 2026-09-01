import {
  ALLOWED_URL_PROTOCOLS,
  CLEANUP_DAYS_MAX,
  PROVIDER_NAME_PATTERN,
} from './constants.js'

/** Every validator returns an i18n key describing the problem, or null. */
export type Validator = (value: string) => string | null

const PATH_SEPARATORS = ['/', '\\']

/**
 * A provider name that becomes a filename is validated as one. The character
 * class already excludes separators; they are checked explicitly so the user
 * gets the reason rather than a generic "invalid characters".
 *
 * Which names are *reserved* is the agent's business -- `local` and `json`
 * collide with a file Claude Code uses, and mean nothing to another agent -- so
 * the list is supplied rather than baked in.
 */
export function makeFileNameValidator(reserved: string[] = []): Validator {
  const blocked = reserved.map((name) => name.toLowerCase())
  return (value: string): string | null => {
    const name = value.trim()
    if (name.length === 0) return 'validate.nameEmpty'
    if (PATH_SEPARATORS.some((sep) => name.includes(sep))) return 'validate.namePathSeparator'
    if (name === '.' || name === '..') return 'validate.namePathSeparator'
    if (!PROVIDER_NAME_PATTERN.test(name)) return 'validate.nameCharset'
    if (blocked.includes(name.toLowerCase())) return 'validate.nameReserved'
    return null
  }
}

/**
 * A name that becomes a JSON key rather than a filename. It still has to be
 * non-empty and reserved-free, but path separators are irrelevant and the
 * charset is the agent's to widen.
 */
export function makeKeyNameValidator(reserved: string[] = []): Validator {
  const blocked = reserved.map((name) => name.toLowerCase())
  return (value: string): string | null => {
    const name = value.trim()
    if (name.length === 0) return 'validate.nameEmpty'
    if (!PROVIDER_NAME_PATTERN.test(name)) return 'validate.nameCharset'
    if (blocked.includes(name.toLowerCase())) return 'validate.nameReserved'
    return null
  }
}

/** http(s) only: a file:// or javascript: URL must never reach fetch. */
export function validateBaseUrl(value: string): string | null {
  const raw = value.trim()
  if (raw.length === 0) return 'validate.urlEmpty'
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return 'validate.urlMalformed'
  }
  if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol)) return 'validate.urlProtocol'
  if (parsed.hostname.length === 0) return 'validate.urlHost'
  return null
}

export function validateOptionalUrl(value: string): string | null {
  return value.trim().length === 0 ? null : validateBaseUrl(value)
}

export function validateOptionalPositiveInt(value: string): string | null {
  const raw = value.trim()
  if (raw.length === 0) return null
  if (!/^\d+$/.test(raw)) return 'validate.notInteger'
  const parsed = Number(raw)
  if (parsed <= 0) return 'validate.notPositive'
  if (parsed > CLEANUP_DAYS_MAX) return 'validate.tooLarge'
  return null
}

/** Rejects nothing; present so free-text fields can share the FieldSpec shape. */
export function validateFreeText(): string | null {
  return null
}

export function validateRequiredText(value: string): string | null {
  return value.trim().length === 0 ? 'validate.required' : null
}

/** Joins the base URL and a path without producing a double slash. */
export function joinUrl(baseUrl: string, suffix: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}${suffix}`
}
