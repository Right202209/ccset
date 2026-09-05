import { describePosition } from '../position.js'
import { endOfLine, scanKeyPath, scanValue, skipSpace } from './scan.js'

/**
 * Syntax check for a TOML target. The scanner is deliberately tolerant so an
 * edit never refuses to run; this is the strict pass that decides whether ccset
 * is allowed to rewrite the file at all. A file that fails here reaches the user
 * as the same "back it up and start fresh" confirm a malformed JSON target does
 * -- ccset must never silently overwrite something it could not read.
 */

const CLOSERS: Record<string, string> = { '"': '"', "'": "'", '[': ']', '{': '}' }

/** `1979-05-27 07:32:00` is one value; `1 2` is two, and so is a syntax error. */
const SPACED_DATE_TIME = /^\d{4}-\d{2}-\d{2}[ ]\d{2}:\d{2}/

function isLineEnd(text: string, index: number): boolean {
  const char = text.charAt(index)
  return char === '' || char === '\n' || char === '\r' || char === '#'
}

/**
 * A bare value carrying interior whitespace is two values on one line. That is
 * the malformed case worth catching: the scanner would read it as a single
 * span, so an edit elsewhere would preserve a line Codex rejects. Other bare
 * nonsense is left alone -- ccset copies it through untouched either way.
 */
function isWellFormedBare(raw: string): boolean {
  if (!/\s/.test(raw)) return true
  return SPACED_DATE_TIME.test(raw)
}

/** A quoted or bracketed value has to actually close. */
function isClosed(text: string, start: number, end: number): boolean {
  const closer = CLOSERS[text.charAt(start)]
  if (closer === undefined) return end > start
  if (end - start < 2) return false
  return text.charAt(end - 1) === closer
}

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
  const valueEnd = scanValue(text, valueStart)
  if (!isClosed(text, valueStart, valueEnd)) return describePosition(text, valueStart)
  if (CLOSERS[text.charAt(valueStart)] === undefined) {
    if (!isWellFormedBare(text.slice(valueStart, valueEnd))) return describePosition(text, valueStart)
  }
  const rest = skipSpace(text, valueEnd)
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
  return scanValue(text, skipSpace(text, key.end + 1))
}
