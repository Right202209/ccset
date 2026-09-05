import { parse } from 'jsonc-parser'
import type { JsonObject } from '../../types.js'
import { isPlainObject } from '../json-file.js'

/**
 * Reads a JSONC document into the same `JsonObject` every other codec hands
 * back, so an agent module and Status never learn which format they came from.
 * A duplicate key reads as the last one, exactly as JSON.parse would -- which
 * is also the one an edit has to replace.
 *
 * The caller has run the strict pass first (ADR 0004); this trusts the document.
 */
export function readJsoncObject(text: string): JsonObject {
  const value: unknown = parse(text, [], { allowTrailingComma: true })
  return isPlainObject(value) ? value : {}
}
