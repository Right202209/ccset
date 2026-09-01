import { decodeTomlString } from './strings.js'

/**
 * A TOML scanner that records *positions*, not values. It never builds a
 * document it could re-emit, because re-emitting is exactly what would lose the
 * comments, blank lines and key order a TOML file carries (ADR 0003). An edit
 * replaces one recorded span; every other byte is copied through untouched.
 *
 * It is deliberately tolerant: an unterminated string ends at the line or the
 * file, and an unknown construct is scanned past rather than rejected. Refusing
 * to read a file ccset would only ever partly rewrite helps nobody -- the
 * reader validates, and a malformed target reaches the user as a confirm.
 */

export interface TomlEntry {
  /** Full dotted path from the document root, table context included. */
  path: string[]
  /** Index into `tables`, or -1 for a key above the first header. */
  tableIndex: number
  /** True when the owning table came from `[[a.b]]` rather than `[a.b]`. */
  inArray: boolean
  valueStart: number
  valueEnd: number
  /** Whole `key = value` line: from its indentation to past its newline. */
  lineStart: number
  lineEnd: number
}

export interface TomlTable {
  path: string[]
  isArray: boolean
  /** Start of the header line. */
  headerStart: number
  /** Offset just past the header line. */
  bodyStart: number
}

export interface TomlDoc {
  entries: TomlEntry[]
  tables: TomlTable[]
}

interface ScanState {
  text: string
  index: number
  context: string[]
  tableIndex: number
  entries: TomlEntry[]
  tables: TomlTable[]
}

const BARE_KEY_CHAR = /[A-Za-z0-9_-]/
/** Extra quotes TOML allows to sit against a multi-line closing delimiter. */
const MAX_ADJACENT_QUOTES = 2

function isSpace(char: string): boolean {
  return char === ' ' || char === '\t'
}

export function skipSpace(text: string, index: number): number {
  let i = index
  while (isSpace(text.charAt(i))) i += 1
  return i
}

/** Offset just past the next newline, or the end of the text. */
export function endOfLine(text: string, index: number): number {
  const next = text.indexOf('\n', index)
  return next === -1 ? text.length : next + 1
}

/* ---------------------------------------------------------------- values */

function scanQuoted(text: string, start: number): number {
  const quote = text.charAt(start)
  const triple = quote.repeat(3)
  if (text.startsWith(triple, start)) return scanMultiline(text, start, triple)
  const escaped = quote === '"'
  let i = start + 1
  while (i < text.length) {
    const char = text.charAt(i)
    if (char === '\n') return i
    if (escaped && char === '\\') {
      i += 2
      continue
    }
    if (char === quote) return i + 1
    i += 1
  }
  return i
}

function scanMultiline(text: string, start: number, triple: string): number {
  const quote = triple.charAt(0)
  const escaped = quote === '"'
  let i = start + triple.length
  while (i < text.length) {
    if (escaped && text.charAt(i) === '\\') {
      i += 2
      continue
    }
    if (text.startsWith(triple, i)) return skipAdjacentQuotes(text, i + triple.length, quote)
    i += 1
  }
  return i
}

function skipAdjacentQuotes(text: string, index: number, quote: string): number {
  let i = index
  for (let extra = 0; extra < MAX_ADJACENT_QUOTES; extra += 1) {
    if (text.charAt(i) !== quote) break
    i += 1
  }
  return i
}

/** An array or inline table, skipping the strings and comments inside it. */
function scanBracketed(text: string, start: number): number {
  let depth = 0
  let i = start
  while (i < text.length) {
    const char = text.charAt(i)
    if (char === '"' || char === "'") {
      i = scanQuoted(text, i)
    } else if (char === '#') {
      i = endOfLine(text, i)
    } else if (char === '[' || char === '{') {
      depth += 1
      i += 1
    } else if (char === ']' || char === '}') {
      depth -= 1
      i += 1
      if (depth <= 0) return i
    } else {
      i += 1
    }
  }
  return i
}

/**
 * A bare value -- a number, boolean or date. It runs to a comment or the line
 * end, and also to a separator, because the same scanner reads the elements of
 * an array. None of those forms can contain one, so stopping there is safe at
 * the top level too.
 */
const BARE_VALUE_STOP = ['\n', '\r', '#', ',', ']', '}']

function scanBare(text: string, start: number): number {
  let i = start
  while (i < text.length && !BARE_VALUE_STOP.includes(text.charAt(i))) i += 1
  while (i > start && isSpace(text.charAt(i - 1))) i -= 1
  return i
}

/** Offset just past the value beginning at `start`. */
export function scanValue(text: string, start: number): number {
  const char = text.charAt(start)
  if (char === '"' || char === "'") return scanQuoted(text, start)
  if (char === '[' || char === '{') return scanBracketed(text, start)
  return scanBare(text, start)
}

/* ------------------------------------------------------------------ keys */

interface KeyScan {
  path: string[]
  end: number
}

function scanSegment(text: string, start: number): KeyScan | null {
  const char = text.charAt(start)
  if (char === '"' || char === "'") {
    const end = scanQuoted(text, start)
    return { path: [decodeTomlString(text.slice(start, end))], end }
  }
  let i = start
  while (BARE_KEY_CHAR.test(text.charAt(i))) i += 1
  return i === start ? null : { path: [text.slice(start, i)], end: i }
}

/** A dotted key. Returns null when there is no key here at all. */
export function scanKeyPath(text: string, start: number): KeyScan | null {
  const path: string[] = []
  let i = start
  for (;;) {
    const segment = scanSegment(text, skipSpace(text, i))
    if (segment === null) return null
    path.push(...segment.path)
    i = skipSpace(text, segment.end)
    if (text.charAt(i) !== '.') return { path, end: i }
    i += 1
  }
}

/* --------------------------------------------------------------- document */

function readHeader(state: ScanState): void {
  const { text } = state
  const headerStart = state.index
  const isArray = text.startsWith('[[', headerStart)
  const key = scanKeyPath(text, headerStart + (isArray ? 2 : 1))
  const bodyStart = endOfLine(text, headerStart)
  state.index = bodyStart
  if (key === null) return
  state.tables.push({ path: key.path, isArray, headerStart, bodyStart })
  state.context = key.path
  state.tableIndex = state.tables.length - 1
}

function readAssignment(state: ScanState): void {
  const { text } = state
  const lineStart = state.index
  const key = scanKeyPath(text, lineStart)
  if (key === null || text.charAt(key.end) !== '=') {
    state.index = endOfLine(text, lineStart)
    return
  }
  const valueStart = skipSpace(text, key.end + 1)
  const valueEnd = scanValue(text, valueStart)
  state.index = endOfLine(text, valueEnd)
  state.entries.push({
    path: [...state.context, ...key.path],
    tableIndex: state.tableIndex,
    inArray: state.tables[state.tableIndex]?.isArray ?? false,
    valueStart,
    valueEnd,
    lineStart,
    lineEnd: state.index,
  })
}

export function scanToml(text: string): TomlDoc {
  const state: ScanState = {
    text,
    index: 0,
    context: [],
    tableIndex: -1,
    entries: [],
    tables: [],
  }
  while (state.index < text.length) {
    const lineStart = state.index
    const char = text.charAt(skipSpace(text, lineStart))
    if (char === '[') {
      state.index = skipSpace(text, lineStart)
      readHeader(state)
    } else if (char === '' || char === '#' || char === '\n' || char === '\r') {
      state.index = endOfLine(text, lineStart)
    } else {
      readAssignment(state)
    }
    if (state.index <= lineStart) state.index = lineStart + 1
  }
  return { entries: state.entries, tables: state.tables }
}
