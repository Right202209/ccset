import { describePosition } from '../position.js'
import { endOfLine, scanKeyPath, skipSpace, skipTrivia } from './scan.js'
import { SHORT_ESCAPES } from './strings.js'
import { MAX_TOML_VALUE_DEPTH } from './limits.js'
import { checkTomlKeyEscapes } from './key-check.js'

/**
 * Whole-value checks for the strict TOML pass. Values are checked in full, not
 * by their last character: an array missing a comma, an inline table missing
 * one, and a multi-line string whose closing delimiter never arrives are all
 * shapes the tolerant scanner happily spans and a naive endpoint check happily
 * accepts. Split from check.ts, which owns the document-level structure.
 */

const UNICODE_ESCAPES: Record<string, number> = { u: 4, U: 8 }
/** An array or inline table may nest; the cap keeps a pathological file linear. */
const BOOL = /^(?:true|false)$/
const INTEGER = /^[+-]?(?:0|[1-9](?:_?[0-9])*)$|^0x[0-9A-Fa-f](?:_?[0-9A-Fa-f])*$|^0o[0-7](?:_?[0-7])*$|^0b[01](?:_?[01])*$/
const FLOAT = /^[+-]?(?:inf|nan|(?:0|[1-9](?:_?[0-9])*)(?:\.[0-9](?:_?[0-9])*(?:[eE][+-]?[0-9](?:_?[0-9])*)?|[eE][+-]?[0-9](?:_?[0-9])*))$/
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/
const TIME = /^([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?$/
const DATE_TIME = /^([0-9]{4}-[0-9]{2}-[0-9]{2})[Tt ]([0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?)(?:[Zz]|([+-])([0-9]{2}):([0-9]{2}))?$/

interface ValueScan {
  /** Offset just past the value, when it is well formed. */
  end: number
  /** Position of the first problem, or null. */
  problem: string | null
}

function problem(text: string, index: number): ValueScan {
  return { end: index, problem: describePosition(text, index) }
}

function ok(text: string, end: number): ValueScan {
  return { end, problem: null }
}

/** TOML 1.0 forbids the C0 controls (bar the whitespace multi-line strings
 *  allow) and DEL inside every string form; DEL has no literal exemption. */
function isForbiddenControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  const control = code < 0x20 && char !== '\t' && char !== '\n' && char !== '\r'
  return control || code === 0x7f
}

/** One escape sequence inside a basic string; null when it is not valid. */
function checkEscape(text: string, backslash: number): number | null {
  const marker = text.charAt(backslash + 1)
  if (SHORT_ESCAPES[marker] !== undefined) return backslash + 2
  const width = UNICODE_ESCAPES[marker]
  if (width === undefined) return null
  const digits = text.slice(backslash + 2, backslash + 2 + width)
  if (digits.length !== width || !/^[0-9A-Fa-f]+$/.test(digits)) return null
  const codePoint = Number.parseInt(digits, 16)
  if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return null
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
  if (validDateTime(raw)) return ok(text, i)
  // A local date on its own is a value; `1979-05-27 07:32:00` is one too --
  // the date, one space, and the time.
  if (validDate(raw)) {
    if (text.charAt(i) === ' ' || text.charAt(i) === '\t') {
      let j = i + 1
      while (
        text.charAt(j) !== '' &&
        text.charAt(j) !== '\n' &&
        text.charAt(j) !== '\r' &&
        text.charAt(j) !== '#' &&
        text.charAt(j) !== ',' &&
        text.charAt(j) !== ']' &&
        text.charAt(j) !== '}' &&
        text.charAt(j) !== ' ' &&
        text.charAt(j) !== '\t'
      ) {
        j += 1
      }
      if (validDateTime(`${raw} ${text.slice(i + 1, j)}`)) return ok(text, j)
    }
    return ok(text, i)
  }
  if (validTime(raw)) return ok(text, i)
  return problem(text, start)
}

function dateParts(raw: string): { year: number; month: number; day: number } | null {
  const match = DATE.exec(raw)
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function daysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return days[month - 1] ?? 0
}

function validDate(raw: string): boolean {
  const parts = dateParts(raw)
  if (parts === null) return false
  return parts.year > 0 && parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= daysInMonth(parts.year, parts.month)
}

function validTime(raw: string): boolean {
  const match = TIME.exec(raw)
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3])
  return hour <= 23 && minute <= 59 && second <= 59
}

function validDateTime(raw: string): boolean {
  const match = DATE_TIME.exec(raw)
  if (match?.[1] === undefined || match[2] === undefined || !validDate(match[1]) || !validTime(match[2])) {
    return false
  }
  if (match[3] === undefined) return true
  const hour = Number(match[4])
  const minute = Number(match[5])
  return hour <= 23 && minute <= 59
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

function hasInlinePathConflict(paths: string[][], path: string[]): boolean {
  return paths.some((existing) => isPrefix(existing, path) || isPrefix(path, existing))
}

interface InlineKey {
  path: string[]
  valueStart: number
}

function inlineKey(text: string, index: number, paths: string[][]): InlineKey | ValueScan {
  if (text.charAt(index) === '\n' || text.charAt(index) === '\r') return problem(text, index)
  const key = scanKeyPath(text, index)
  if (key === null) return problem(text, index)
  const keyProblem = checkTomlKeyEscapes(text, index, key.end)
  if (keyProblem !== null) return { end: index, problem: keyProblem }
  if (hasInlinePathConflict(paths, key.path)) return problem(text, index)
  const equals = skipSpace(text, key.end)
  if (text.charAt(equals) !== '=') return problem(text, equals)
  return { path: key.path, valueStart: skipSpace(text, equals + 1) }
}

function checkInlineTable(text: string, start: number, depth: number): ValueScan {
  let index = skipSpace(text, start + 1)
  if (text.charAt(index) === '}') return ok(text, index + 1)
  const paths: string[][] = []
  for (;;) {
    const key = inlineKey(text, index, paths)
    if ('problem' in key) return key
    paths.push(key.path)
    const value = checkValue(text, key.valueStart, depth + 1)
    if (value.problem !== null) return value
    index = skipSpace(text, value.end)
    if (text.charAt(index) === ',') {
      index = skipSpace(text, index + 1)
      continue
    }
    if (text.charAt(index) === '}') return ok(text, index + 1)
    return problem(text, index)
  }
}

function isPrefix(prefix: string[], path: string[]): boolean {
  return prefix.length <= path.length && prefix.every((part, index) => path[index] === part)
}

export function checkValue(text: string, start: number, depth: number): ValueScan {
  if (depth > MAX_TOML_VALUE_DEPTH) return problem(text, start)
  const char = text.charAt(start)
  if (char === '"' || char === "'") return checkString(text, start)
  if (char === '[') return checkArray(text, start, depth)
  if (char === '{') return checkInlineTable(text, start, depth)
  return checkBare(text, start)
}
