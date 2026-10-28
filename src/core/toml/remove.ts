import type { ManagedWrite } from '../merge.js'
import {
  convertInlineToDotted,
  findEntry,
  findInlineAncestor,
  inlinePathExists,
} from './edit.js'
import { scanToml } from './scan.js'
import { setTomlPath } from './edit.js'
import { dottedLineSpan, removeSpan, tableSectionSpan } from './table-span.js'

/**
 * The deletion half of the TOML editing contract. It is separate from edit.ts
 * only for size, not for policy: what a delete may touch -- one line, or a whole
 * table and everything under it, and never a comment ccset did not write -- is
 * the same rule either way (ADR 0003).
 */

/**
 * Removes the key's whole line, a trailing comment on it included -- that
 * comment describes the key that is going -- or, when the path names a table,
 * the table's whole section. An emptied table header is left behind when only a
 * key moved out of it: ccset did not write the header, so removing it is not its
 * call. A path on disk in none of those forms is left exactly as it is, so an
 * absent provider is a no-op rather than a rewrite.
 */
export function deleteTomlPath(text: string, path: string[]): string {
  let current = text
  for (;;) {
    const doc = scanToml(current)
    const entry = findEntry(doc, path)
    if (entry !== undefined) {
      return removeSpan(current, { start: entry.lineStart, end: entry.lineEnd })
    }
    const section = tableSectionSpan(doc, path)
    if (section !== null) {
      current = removeSpan(current, section)
      continue
    }
    const dotted = dottedLineSpan(doc, path)
    if (dotted !== null) {
      current = removeSpan(current, dotted)
      continue
    }
    const inline = findInlineAncestor(current, doc, path)
    if (inline === undefined || !inlinePathExists(current, inline, path)) return current
    const expanded = convertInlineToDotted(current, doc, inline)
    if (expanded === current) return current
    current = expanded
  }
}

/** The one write list both halves answer to, in the order the caller gave it. */
export function applyTomlWrites(text: string, writes: ManagedWrite[]): string {
  let current = text
  for (const write of writes) {
    current =
      write.value === undefined
        ? deleteTomlPath(current, write.path)
        : setTomlPath(current, write.path, write.value)
  }
  return current
}
