import { MASK_CHAR, MASK_MIDDLE_WIDTH, MASK_VISIBLE_CHARS } from './constants.js'

const MIDDLE = MASK_CHAR.repeat(MASK_MIDDLE_WIDTH)

/**
 * First 4 and last 4 characters, with a fixed-width middle so the mask never
 * encodes the true length (PRD 4.2.4). Short secrets are masked entirely --
 * showing 4+4 of a 9-character token would reveal almost all of it.
 */
export function maskSecret(secret: string): string {
  if (secret.length === 0) return ''
  if (secret.length <= MASK_VISIBLE_CHARS * 2) return MIDDLE
  const head = secret.slice(0, MASK_VISIBLE_CHARS)
  const tail = secret.slice(secret.length - MASK_VISIBLE_CHARS)
  return `${head}${MIDDLE}${tail}`
}

/** Display form for any field value; secrets go through maskSecret first. */
export function displayValue(value: string, isSecret: boolean): string {
  if (value.length === 0) return ''
  return isSecret ? maskSecret(value) : value
}
