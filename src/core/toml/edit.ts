import type { JsonValue } from '../../types.js'
import type { ManagedWrite } from '../merge.js'
import { formatTomlHeader, formatTomlLine, formatTomlValue } from './format.js'
import { scanToml, type TomlDoc, type TomlEntry } from './scan.js'

/**
 * Applies the manifest to a TOML document by editing its text, not by rebuilding
 * it. Setting a key replaces the span its value occupies; adding one inserts a
 * single line; deleting one removes a single line. Every comment, blank line and
 * key ordering outside those spans is copied through byte for byte, which is how
 * "unmanaged keys survive" holds for a format that carries all three (ADR 0003).
 *
 * Each write re-scans. Documents are a few kilobytes and the alternative --
 * tracking how every earlier edit shifted every later offset -- is the kind of
 * bookkeeping that silently corrupts a file when it is wrong.
 */

/**
 * Path segments are compared as one joined string, and the separator has to be
 * a character a TOML key cannot contain. A space will not do: `'lit key' = 2` is
 * a legal quoted key, so joining on one would make `['lit key']` and
 * `['lit', 'key']` compare equal and edit each other's line.
 */
const PATH_SEPARATOR = '\u0000'

function pathKey(path: string[]): string {
  return path.join(PATH_SEPARATOR)
}

/** Latest definition wins, matching how the reader resolves a repeated key. */
function findEntry(doc: TomlDoc, path: string[]): TomlEntry | undefined {
  const key = pathKey(path)
  let found: TomlEntry | undefined
  for (const entry of doc.entries) {
    if (entry.inArray) continue
    if (pathKey(entry.path) === key) found = entry
  }
  return found
}

function isPrefix(prefix: string[], path: string[]): boolean {
  if (prefix.length >= path.length) return false
  return prefix.every((segment, index) => path[index] === segment)
}

interface Anchor {
  /** Where the new line goes. */
  offset: number
  /** Key path relative to the table that offset sits in. */
  keys: string[]
}

/**
 * The deepest existing table the key belongs in. A bare key after a `[table]`
 * header belongs to that table, so a top-level key can never be appended to the
 * end of the file -- it goes above the first header instead.
 */
function anchorFor(doc: TomlDoc, text: string, path: string[]): Anchor | null {
  let best = -1
  doc.tables.forEach((table, index) => {
    if (table.isArray || !isPrefix(table.path, path)) return
    const current = doc.tables[best]
    if (current === undefined || table.path.length >= current.path.length) best = index
  })
  const table = doc.tables[best]
  if (table === undefined) {
    if (path.length > 1) return null
    return { offset: rootEnd(doc, text), keys: path }
  }
  return { offset: tableEnd(doc, best, table.bodyStart), keys: path.slice(table.path.length) }
}

function tableEnd(doc: TomlDoc, tableIndex: number, fallback: number): number {
  let end = fallback
  for (const entry of doc.entries) {
    if (entry.tableIndex === tableIndex && entry.lineEnd > end) end = entry.lineEnd
  }
  return end
}

function rootEnd(doc: TomlDoc, text: string): number {
  let end = -1
  for (const entry of doc.entries) {
    if (entry.tableIndex === -1 && entry.lineEnd > end) end = entry.lineEnd
  }
  if (end >= 0) return end
  return doc.tables[0]?.headerStart ?? text.length
}

function insertAt(text: string, offset: number, line: string): string {
  const needsBreak = offset > 0 && text.charAt(offset - 1) !== '\n'
  return `${text.slice(0, offset)}${needsBreak ? '\n' : ''}${line}${text.slice(offset)}`
}

/** Separator that leaves exactly one blank line before an appended table. */
function trailingGap(text: string): string {
  if (text.length === 0) return ''
  if (text.endsWith('\n\n')) return ''
  return text.endsWith('\n') ? '\n' : '\n\n'
}

function appendTable(text: string, path: string[], value: JsonValue): string {
  const leaf = path[path.length - 1]
  if (leaf === undefined) return text
  const block = `${formatTomlHeader(path.slice(0, -1))}${formatTomlLine([leaf], value)}`
  return `${text}${trailingGap(text)}${block}`
}

export function setTomlPath(text: string, path: string[], value: JsonValue): string {
  if (path.length === 0) return text
  const doc = scanToml(text)
  const entry = findEntry(doc, path)
  if (entry !== undefined) {
    const head = text.slice(0, entry.valueStart)
    return `${head}${formatTomlValue(value)}${text.slice(entry.valueEnd)}`
  }
  const anchor = anchorFor(doc, text, path)
  if (anchor === null) return appendTable(text, path, value)
  return insertAt(text, anchor.offset, formatTomlLine(anchor.keys, value))
}

/**
 * Removes the key's whole line, a trailing comment on it included -- that
 * comment describes the key that is going. An emptied table header is left
 * behind: ccset did not write it, so removing it is not its call.
 */
export function deleteTomlPath(text: string, path: string[]): string {
  const entry = findEntry(scanToml(text), path)
  if (entry === undefined) return text
  return `${text.slice(0, entry.lineStart)}${text.slice(entry.lineEnd)}`
}

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
