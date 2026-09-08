import type { JsonValue } from '../../types.js'
import type { ManagedWrite } from '../merge.js'
import { formatTomlHeader, formatTomlKeyPath, formatTomlLine, formatTomlValue } from './format.js'
import { scanKeyPath, scanToml, scanValue, skipSpace, type TomlDoc, type TomlEntry } from './scan.js'

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
 *
 * One representation hazard needs resolving before an insert: the table a key
 * belongs to may already exist in a form a new line cannot legally join. A key
 * defined as an inline table cannot be extended by assignments, and a table
 * spelled with dotted keys cannot be redeclared with a `[header]` -- both edits
 * would produce a document Codex rejects while ccset reported success. The
 * insert therefore converts an inline table to dotted keys in place, or joins
 * the sibling dotted lines, before adding anything.
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

/* ------------------------------------------------- existing representations */

/** The deepest entry on the target's ancestor chain written as an inline table. */
function findInlineAncestor(text: string, doc: TomlDoc, path: string[]): TomlEntry | undefined {
  let best: TomlEntry | undefined
  for (const entry of doc.entries) {
    if (entry.inArray || !isPrefix(entry.path, path)) continue
    if (text.charAt(entry.valueStart) !== '{') continue
    if (best === undefined || entry.path.length > best.path.length) best = entry
  }
  return best
}

interface InlinePair {
  keys: string[]
  raw: string
}

/**
 * Walks the pairs inside one inline table's braces. The document passed the
 * strict check, so the walk consuming cleanly is the expected case; null means
 * "leave this line alone" rather than a rewrite on a guess.
 */
function inlinePairs(text: string, entry: TomlEntry): InlinePair[] | null {
  const pairs: InlinePair[] = []
  let i = skipSpace(text, entry.valueStart + 1)
  for (;;) {
    if (i >= entry.valueEnd || text.charAt(i) === '') return null
    if (text.charAt(i) === '}') return pairs
    const key = scanKeyPath(text, i)
    if (key === null) return null
    const equals = skipSpace(text, key.end)
    if (text.charAt(equals) !== '=') return null
    const valueStart = skipSpace(text, equals + 1)
    const valueEnd = scanValue(text, valueStart)
    if (valueEnd <= valueStart) return null
    pairs.push({ keys: key.path, raw: text.slice(valueStart, valueEnd) })
    i = skipSpace(text, valueEnd)
    if (text.charAt(i) === ',') {
      i = skipSpace(text, i + 1)
      continue
    }
    if (text.charAt(i) === '}') return pairs
    return null
  }
}

/**
 * `router = { name = "x" }` becomes `router.name = "x"` on the same line: the
 * pair values are copied verbatim, and a trailing comment rides on the last
 * emitted line. The dotted key is spelled relative to the table context the
 * inline assignment sits in -- a full path inside `[model_providers]` would
 * read as `model_providers.model_providers.router`. An empty inline table has
 * nothing to spell out, so the assignment is dropped and the insert recreates
 * the table in header form.
 */
function convertInlineToDotted(text: string, doc: TomlDoc, entry: TomlEntry): string {
  const pairs = inlinePairs(text, entry)
  if (pairs === null || pairs.length === 0) {
    return `${text.slice(0, entry.lineStart)}${text.slice(entry.lineEnd)}`
  }
  const context = entry.tableIndex >= 0 ? (doc.tables[entry.tableIndex]?.path ?? []) : []
  const prefix = entry.path.slice(context.length)
  const lines = pairs.map(
    (pair) => `${formatTomlKeyPath([...prefix, ...pair.keys])} = ${pair.raw}`,
  )
  const tail = text.slice(entry.valueEnd, entry.lineEnd)
  const hash = tail.indexOf('#')
  if (hash >= 0) {
    const last = lines[lines.length - 1]
    if (last !== undefined) lines[lines.length - 1] = `${last}${tail.slice(0, hash)}${tail.slice(hash).trimEnd()}`
  }
  const separator = text.charAt(entry.lineEnd - 1) === '\n' ? '\n' : ''
  return `${text.slice(0, entry.lineStart)}${lines.join('\n')}${separator}${text.slice(entry.lineEnd)}`
}

/**
 * The parent is defined through dotted keys -- a header carrying it would have
 * been found by anchorFor -- so the new key joins them as another dotted line
 * rather than a `[header]` that would redeclare the table. Only entries whose
 * own table context sits inside the target's ancestor chain qualify: a dotted
 * key that merely lives deeper in the document is somebody else's line.
 */
function findDottedAnchor(doc: TomlDoc, path: string[]): Anchor | null {
  const parent = path.slice(0, -1)
  if (parent.length === 0) return null
  let best: TomlEntry | undefined
  for (const entry of doc.entries) {
    if (entry.inArray || !isPrefix(parent, entry.path)) continue
    const context = entry.tableIndex >= 0 ? (doc.tables[entry.tableIndex]?.path ?? []) : []
    if (!isPrefix(context, parent) && context.length !== 0) continue
    if (best === undefined || entry.lineEnd > best.lineEnd) best = entry
  }
  if (best === undefined) return null
  const context = best.tableIndex >= 0 ? (doc.tables[best.tableIndex]?.path ?? []) : []
  return { offset: best.lineEnd, keys: path.slice(context.length) }
}

export function setTomlPath(text: string, path: string[], value: JsonValue): string {
  if (path.length === 0) return text
  let current = text
  for (;;) {
    const doc = scanToml(current)
    const inline = findInlineAncestor(current, doc, path)
    if (inline !== undefined) {
      current = convertInlineToDotted(current, doc, inline)
      continue
    }
    const entry = findEntry(doc, path)
    if (entry !== undefined) {
      const head = current.slice(0, entry.valueStart)
      return `${head}${formatTomlValue(value)}${current.slice(entry.valueEnd)}`
    }
    const anchor = anchorFor(doc, current, path)
    if (anchor !== null) return insertAt(current, anchor.offset, formatTomlLine(anchor.keys, value))
    const dotted = findDottedAnchor(doc, path)
    if (dotted !== null) return insertAt(current, dotted.offset, formatTomlLine(dotted.keys, value))
    return appendTable(current, path, value)
  }
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
