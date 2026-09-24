import type { JsonObject, JsonValue } from '../../types.js'
import { isPlainObject } from '../json-file.js'
import { isPrototypeKey, ownChild } from '../merge.js'
import { CcsetError, EXIT_RUNTIME } from '../errors.js'
import { decodeTomlString } from './strings.js'
import { MAX_TOML_VALUE_DEPTH } from './limits.js'
import { endOfLine, scanKeyPath, scanToml, scanValue, skipSpace, skipTrivia, type TomlTable } from './scan.js'

/**
 * Reads a scanned document into the same `JsonObject` every other codec hands
 * back, so an agent module and Status never learn which format they came from.
 *
 * Forms JSON has no equivalent of -- offset date-times, `inf`, `nan` -- are kept
 * as their source text. ccset manages none of them; keeping the text means they
 * still count as preserved keys and still display, and the writer never touches
 * them, so nothing is lost by not modelling them.
 *
 * A `__proto__` key is a legal bare key here, so the traversal guards it the
 * same way the merge writer does: a write aimed at the prototype slot is
 * dropped rather than applied, and a table whose path runs through one collects
 * into a detached object nothing reads back.
 */

const RADIX_PREFIXES: Record<string, number> = { x: 16, o: 8, b: 2 }

function setIn(target: JsonObject, keys: string[], value: JsonValue): void {
  let node = target
  for (const key of keys.slice(0, -1)) {
    if (isPrototypeKey(key)) return
    const child = ownChild(node, key) ?? {}
    node[key] = child
    node = child
  }
  const leaf = keys[keys.length - 1]
  if (leaf !== undefined && !isPrototypeKey(leaf)) node[leaf] = value
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

function parseArray(raw: string, depth: number): JsonValue[] {
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
    items.push(parseTomlValueAtDepth(raw.slice(i, end), depth + 1))
    i = end
  }
  return items
}

function parseInlineTable(raw: string, depth: number): JsonObject {
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
    setIn(table, key.path, parseTomlValueAtDepth(raw.slice(start, end), depth + 1))
    i = end > start ? end : start + 1
  }
  return table
}

/** One value's source text to its JSON equivalent. */
export function parseTomlValue(raw: string): JsonValue {
  return parseTomlValueAtDepth(raw, 0)
}

function parseScalar(text: string): JsonValue {
  if (text === 'true') return true
  if (text === 'false') return false
  if (/^[+-]?[0-9]/.test(text) && !/[:T]/.test(text) && !/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return parseNumber(text)
  }
  return text
}

function parseTomlValueAtDepth(raw: string, depth: number): JsonValue {
  const text = raw.trim()
  if (depth > MAX_TOML_VALUE_DEPTH) throw new CcsetError('error.configNesting', EXIT_RUNTIME)
  const head = text.charAt(0)
  if (head === '"' || head === "'") return decodeTomlString(text)
  if (head === '[') return parseArray(text, depth)
  if (head === '{') return parseInlineTable(text, depth)
  return parseScalar(text)
}

/* -------------------------------------------------------------- document */

/** Ensures the object a table's keys belong in, creating containers as needed. */
function containerFor(root: JsonObject, table: TomlTable, containers: JsonObject[], tables: TomlTable[]): JsonObject {
  const parentTable = tables[table.parentIndex]
  let node = table.parentIndex >= 0 ? containers[table.parentIndex] ?? root : root
  const parentDepth = parentTable?.path.length ?? 0
  const parentKeys = table.path.slice(parentDepth, -1)
  for (const key of parentKeys) {
    if (isPrototypeKey(key)) return {}
    const child = node[key]
    const next: JsonObject = isPlainObject(child) ? child : {}
    node[key] = next
    node = next
  }
  const leaf = table.path[table.path.length - 1]
  if (leaf === undefined) return node
  if (isPrototypeKey(leaf)) return {}
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
  const containers: JsonObject[] = []
  for (const table of doc.tables) containers.push(containerFor(root, table, containers, doc.tables))
  for (const entry of doc.entries) {
    const table = doc.tables[entry.tableIndex]
    const container = containers[entry.tableIndex] ?? root
    const keys = table === undefined ? entry.path : entry.path.slice(table.path.length)
    setIn(container, keys, parseTomlValue(text.slice(entry.valueStart, entry.valueEnd)))
  }
  return root
}
