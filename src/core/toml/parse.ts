import type { JsonObject, JsonValue } from '../../types.js'
import { isPlainObject } from '../json-file.js'
import { decodeTomlString } from './strings.js'
import { endOfLine, scanKeyPath, scanToml, scanValue, skipSpace, type TomlTable } from './scan.js'

/**
 * Reads a scanned document into the same `JsonObject` every other codec hands
 * back, so an agent module and Status never learn which format they came from.
 *
 * Forms JSON has no equivalent of -- offset date-times, `inf`, `nan` -- are kept
 * as their source text. ccset manages none of them; keeping the text means they
 * still count as preserved keys and still display, and the writer never touches
 * them, so nothing is lost by not modelling them.
 */

const RADIX_PREFIXES: Record<string, number> = { x: 16, o: 8, b: 2 }

function skipTrivia(text: string, index: number): number {
  let i = index
  for (;;) {
    const char = text.charAt(i)
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      i += 1
      continue
    }
    if (char === '#') {
      i = endOfLine(text, i)
      continue
    }
    return i
  }
}

function setIn(target: JsonObject, keys: string[], value: JsonValue): void {
  const [head, ...rest] = keys
  if (head === undefined) return
  if (rest.length === 0) {
    target[head] = value
    return
  }
  const child = target[head]
  const container: JsonObject = isPlainObject(child) ? child : {}
  target[head] = container
  setIn(container, rest, value)
}

/* ---------------------------------------------------------------- values */

function parseNumber(raw: string): JsonValue {
  const cleaned = raw.replace(/_/g, '')
  const radix = RADIX_PREFIXES[cleaned.charAt(1)]
  if (cleaned.startsWith('0') && radix !== undefined) {
    const parsed = Number.parseInt(cleaned.slice(2), radix)
    return Number.isNaN(parsed) ? raw : parsed
  }
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : raw
}

function parseArray(raw: string): JsonValue[] {
  const items: JsonValue[] = []
  let i = 1
  while (i < raw.length) {
    i = skipTrivia(raw, i)
    const char = raw.charAt(i)
    if (char === ']' || char === '') break
    if (char === ',') {
      i += 1
      continue
    }
    const end = scanValue(raw, i)
    if (end <= i) break
    items.push(parseTomlValue(raw.slice(i, end)))
    i = end
  }
  return items
}

function parseInlineTable(raw: string): JsonObject {
  const table: JsonObject = {}
  let i = 1
  while (i < raw.length) {
    i = skipTrivia(raw, i)
    const char = raw.charAt(i)
    if (char === '}' || char === '') break
    if (char === ',') {
      i += 1
      continue
    }
    const key = scanKeyPath(raw, i)
    if (key === null || raw.charAt(key.end) !== '=') break
    const start = skipSpace(raw, key.end + 1)
    const end = scanValue(raw, start)
    setIn(table, key.path, parseTomlValue(raw.slice(start, end)))
    i = end > start ? end : start + 1
  }
  return table
}

/** One value's source text to its JSON equivalent. */
export function parseTomlValue(raw: string): JsonValue {
  const text = raw.trim()
  const head = text.charAt(0)
  if (head === '"' || head === "'") return decodeTomlString(text)
  if (head === '[') return parseArray(text)
  if (head === '{') return parseInlineTable(text)
  if (text === 'true') return true
  if (text === 'false') return false
  if (/^[+-]?[0-9]/.test(text) && !/[:T]/.test(text) && !/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return parseNumber(text)
  }
  return text
}

/* -------------------------------------------------------------- document */

/** Ensures the object a table's keys belong in, creating containers as needed. */
function containerFor(root: JsonObject, table: TomlTable): JsonObject {
  const parentKeys = table.path.slice(0, -1)
  let node = root
  for (const key of parentKeys) {
    const child = node[key]
    const next: JsonObject = isPlainObject(child) ? child : {}
    node[key] = next
    node = next
  }
  const leaf = table.path[table.path.length - 1]
  if (leaf === undefined) return node
  if (!table.isArray) {
    const existing = node[leaf]
    const created: JsonObject = isPlainObject(existing) ? existing : {}
    node[leaf] = created
    return created
  }
  const existing = node[leaf]
  const list: JsonValue[] = Array.isArray(existing) ? existing : []
  node[leaf] = list
  const created: JsonObject = {}
  list.push(created)
  return created
}

/** Whole document to an object. Never throws: the caller validates instead. */
export function readTomlObject(text: string): JsonObject {
  const doc = scanToml(text)
  const root: JsonObject = {}
  const containers = doc.tables.map((table) => containerFor(root, table))
  for (const entry of doc.entries) {
    const table = doc.tables[entry.tableIndex]
    const container = containers[entry.tableIndex] ?? root
    const keys = table === undefined ? entry.path : entry.path.slice(table.path.length)
    setIn(container, keys, parseTomlValue(text.slice(entry.valueStart, entry.valueEnd)))
  }
  return root
}
