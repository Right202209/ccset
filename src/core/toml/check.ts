import { describePosition } from '../position.js'
import { endOfLine, scanKeyPath, skipSpace } from './scan.js'
import { SHORT_ESCAPES } from './strings.js'

/**
 * Syntax check for a TOML target. The scanner is deliberately tolerant so an
 * edit never refuses to run; this is the strict pass that decides whether ccset
 * is allowed to rewrite the file at all. A file that fails here reaches the user
 * as the same "back it up and start fresh" confirm a malformed JSON target does
 * -- ccset must never silently overwrite something it could not read.
 *
 * Values are checked as whole values, not by their last character: an array
 * missing a comma, an inline table missing one, and a multi-line string whose
 * closing delimiter never arrives are all shapes the tolerant scanner happily
 * spans and a naive endpoint check happily accepts.
 */

const UNICODE_ESCAPES: Record<string, number> = { u: 4, U: 8 }
/** An array or inline table may nest; the cap keeps a pathological file linear. */
const MAX_VALUE_DEPTH = 64
const HEX_RADIX = 16

const BOOL = /^(?:true|false)$/
const INTEGER = /^[+-]?(?:0x[0-9A-Fa-f_]+|0o[0-7_]+|0b[01_]+|[0-9][0-9_]*)$/
const FLOAT = /^[+-]?(?:[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9_]+)?|inf|nan)$/
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
const TIME = /^[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?$/
/** `1979-05-27T07:32:00Z` in one token; the space-separated form is two. */
const DATE_TIME = /^[0-9]{4}-[0-9]{2}-[0-9]{2}[Tt ][0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:[Zz]|[+-][0-9]{2}:[0-9]{2})?$/

interface ValueScan {
  /** Offset just past the value, when it is well formed. */
  end: number
  /** Position of the first problem, or null. */
  problem: string | null
}

function isLineEnd(text: string, index: number): boolean {
  const char = text.charAt(index)
  return char === '' || char === '\n' || char === '\r' || char === '#'
}

function problem(text: string, index: number): ValueScan {
  return { end: index, problem: describePosition(text, index) }
}

function ok(text: string, end: number): ValueScan {
  return { end, problem: null }
}

/* --------------------------------------------------------------- strings */

function isForbiddenControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return code < 0x20 && char !== '\t' && char !== '\n' && char !== '\r'
}

/** One escape sequence inside a basic string; null when it is not valid. */
function checkEscape(text: string, backslash: number): number | null {
  const marker = text.charAt(backslash + 1)
  if (SHORT_ESCAPES[marker] !== undefined) return backslash + 2
  const width = UNICODE_ESCAPES[marker]
  if (width === undefined) return null
  const digits = text.slice(backslash + 2, backslash + 2 + width)
  if (digits.length !== width || !/^[0-9A-Fa-f]+$/.test(digits)) return null
  return backslash + 2 + width
}

/**
 * The closing run may carry up to two extra quotes (`"""a""""` ends with one),
 * matching the scanner's MAX_ADJACENT_QUOTES reading of the same shape.
 */
function closeAt(text: string, index: number, quote: string, triple: boolean): number {
  let end = index + (triple ? 3 : 1)
  if (!triple) return end
  for (let extra = 0; extra < 2 && text.charAt(end) === quote; extra += 1) end += 1
  return end
}

/** Multi-line: `\` before a newline (optionally padded) swallows the break. */
function isLineEndingBackslash(text: string, backslash: number): boolean {
  let i = backslash + 1
  while (text.charAt(i) === ' ' || text.charAt(i) === '\t') i += 1
  if (text.charAt(i) === '\n') return true
  return text.charAt(i) === '\r' && text.charAt(i + 1) === '\n'
}

function checkBasic(text: string, start: number, triple: boolean): ValueScan {
  const quote = '"'
  const closer = triple ? quote.repeat(3) : quote
  let i = start + closer.length
  for (;;) {
    const char = text.charAt(i)
    if (char === '') return problem(text, start)
    if (char === '\\') {
      if (triple && isLineEndingBackslash(text, i)) {
        i = endOfLine(text, i)
        continue
      }
      const next = checkEscape(text, i)
      if (next === null) return problem(text, i)
      i = next
      continue
    }
    if (text.startsWith(closer, i)) return ok(text, closeAt(text, i, quote, triple))
    if (!triple && (char === '\n' || char === '\r')) return problem(text, start)
    if (isForbiddenControl(char)) return problem(text, i)
    i += 1
  }
}

function checkLiteral(text: string, start: number, triple: boolean): ValueScan {
  const quote = "'"
  const closer = triple ? quote.repeat(3) : quote
  let i = start + closer.length
  for (;;) {
    const char = text.charAt(i)
    if (char === '') return problem(text, start)
    if (text.startsWith(closer, i)) return ok(text, closeAt(text, i, quote, triple))
    if (!triple && (char === '\n' || char === '\r')) return problem(text, start)
    if (isForbiddenControl(char)) return problem(text, i)
    i += 1
  }
}

function checkString(text: string, start: number): ValueScan {
  const quote = text.charAt(start)
  const triple = text.startsWith(quote.repeat(3), start)
  if (quote === '"') return checkBasic(text, start, triple)
  return checkLiteral(text, start, triple)
}

/* ----------------------------------------------------------------- bare */

function checkBare(text: string, start: number): ValueScan {
  let i = start
  while (
    text.charAt(i) !== '' &&
    text.charAt(i) !== '\n' &&
    text.charAt(i) !== '\r' &&
    text.charAt(i) !== '#' &&
    text.charAt(i) !== ',' &&
    text.charAt(i) !== ']' &&
    text.charAt(i) !== '}' &&
    text.charAt(i) !== ' ' &&
    text.charAt(i) !== '\t'
  ) {
    i += 1
  }
  const raw = text.slice(start, i)
  if (BOOL.test(raw) || INTEGER.test(raw) || FLOAT.test(raw)) return ok(text, i)
  if (DATE_TIME.test(raw)) return ok(text, i)
  // A local date on its own is a value; `1979-05-27 07:32:00` is one too --
  // the date, one space, and the time.
  if (DATE.test(raw)) {
    if (text.charAt(i) === ' ' || text.charAt(i) === '\t') {
      let j = i + 1
      while (
        text.charAt(j) !== '' &&
        text.charAt(j) !== '\n' &&
        text.charAt(j) !== '\r' &&
        text.charAt(j) !== '#' &&
        text.charAt(j) !== ' ' &&
        text.charAt(j) !== '\t'
      ) {
        j += 1
      }
      if (TIME.test(text.slice(i + 1, j))) return ok(text, j)
    }
    return ok(text, i)
  }
  if (TIME.test(raw)) return ok(text, i)
  return problem(text, start)
}

/* ------------------------------------------------------ compound values */

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

function checkArray(text: string, start: number, depth: number): ValueScan {
  let i = start + 1
  for (;;) {
    i = skipTrivia(text, i)
    const char = text.charAt(i)
    if (char === ']') return ok(text, i + 1)
    if (char === '') return problem(text, start)
    const scanned = checkValue(text, i, depth + 1)
    if (scanned.problem !== null) return scanned
    i = skipTrivia(text, scanned.end)
    if (text.charAt(i) === ',') {
      i += 1
      continue
    }
    if (text.charAt(i) === ']') return ok(text, i + 1)
    return problem(text, i)
  }
}

function checkInlineTable(text: string, start: number, depth: number): ValueScan {
  let i = skipSpace(text, start + 1)
  if (text.charAt(i) === '}') return ok(text, i + 1)
  for (;;) {
    if (text.charAt(i) === '\n' || text.charAt(i) === '\r') return problem(text, i)
    const key = scanKeyPath(text, i)
    if (key === null) return problem(text, i)
    const equals = skipSpace(text, key.end)
    if (text.charAt(equals) !== '=') return problem(text, equals)
    const scanned = checkValue(text, skipSpace(text, equals + 1), depth + 1)
    if (scanned.problem !== null) return scanned
    i = skipSpace(text, scanned.end)
    if (text.charAt(i) === ',') {
      i = skipSpace(text, i + 1)
      continue
    }
    if (text.charAt(i) === '}') return ok(text, i + 1)
    return problem(text, i)
  }
}

function checkValue(text: string, start: number, depth: number): ValueScan {
  if (depth > MAX_VALUE_DEPTH) return problem(text, start)
  const char = text.charAt(start)
  if (char === '"' || char === "'") return checkString(text, start)
  if (char === '[') return checkArray(text, start, depth)
  if (char === '{') return checkInlineTable(text, start, depth)
  return checkBare(text, start)
}

/* ------------------------------------------------------------- document */

function checkHeader(text: string, start: number): string | null {
  const isArray = text.startsWith('[[', start)
  const key = scanKeyPath(text, start + (isArray ? 2 : 1))
  if (key === null) return describePosition(text, start)
  const closer = isArray ? ']]' : ']'
  if (!text.startsWith(closer, key.end)) return describePosition(text, key.end)
  const rest = skipSpace(text, key.end + closer.length)
  return isLineEnd(text, rest) ? null : describePosition(text, rest)
}

function checkAssignment(text: string, start: number): string | null {
  const key = scanKeyPath(text, start)
  if (key === null) return describePosition(text, start)
  if (text.charAt(key.end) !== '=') return describePosition(text, key.end)
  const valueStart = skipSpace(text, key.end + 1)
  if (isLineEnd(text, valueStart)) return describePosition(text, valueStart)
  const scanned = checkValue(text, valueStart, 0)
  if (scanned.problem !== null) return scanned.problem
  const rest = skipSpace(text, scanned.end)
  return isLineEnd(text, rest) ? null : describePosition(text, rest)
}

/** Position of the first syntax problem, or null when the document is sound. */
export function findTomlProblem(text: string): string | null {
  let index = 0
  while (index < text.length) {
    const lineStart = index
    const start = skipSpace(text, lineStart)
    if (isLineEnd(text, start)) {
      index = endOfLine(text, lineStart)
      continue
    }
    const problem =
      text.charAt(start) === '[' ? checkHeader(text, start) : checkAssignment(text, start)
    if (problem !== null) return problem
    index = endOfLine(text, nextLineFrom(text, start))
    if (index <= lineStart) index = lineStart + 1
  }
  return null
}

/** A value can span lines, so the next line starts after the value, not the key. */
function nextLineFrom(text: string, start: number): number {
  if (text.charAt(start) === '[') return start
  const key = scanKeyPath(text, start)
  if (key === null) return start
  const valueStart = skipSpace(text, key.end + 1)
  // The assignment has already passed the strict check, so the value has an end.
  return checkValue(text, valueStart, 0).end
}
