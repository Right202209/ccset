import { describePosition } from '../position.js'
import { endOfLine, scanKeyPath, skipSpace } from './scan.js'
import { recordDefinition, trackDefinitions, type DefinitionCheck } from './redefine.js'
import { checkValue } from './value-check.js'
import { MAX_TOML_KEY_PATH_DEPTH } from './limits.js'
import { checkTomlKeyEscapes } from './key-check.js'

/**
 * Syntax check for a TOML target. The scanner is deliberately tolerant so an
 * edit never refuses to run; this is the strict pass that decides whether ccset
 * is allowed to rewrite the file at all. A file that fails here reaches the user
 * as the same "back it up and start fresh" confirm a malformed JSON target does
 * -- ccset must never silently overwrite something it could not read.
 *
 * Whole-value shape checking lives in value-check.ts; this file owns the
 * document walk and the duplicate-definition rules (redefine.ts).
 */

function isLineEnd(text: string, index: number): boolean {
  const char = text.charAt(index)
  return char === '' || char === '\n' || char === '\r' || char === '#'
}

/* ------------------------------------------------------------- document */

function checkHeader(text: string, start: number): string | null {
  const isArray = text.startsWith('[[', start)
  const key = scanKeyPath(text, start + (isArray ? 2 : 1))
  if (key === null || key.path.length > MAX_TOML_KEY_PATH_DEPTH) return describePosition(text, start)
  const keyProblem = checkTomlKeyEscapes(text, start + (isArray ? 2 : 1), key.end)
  if (keyProblem !== null) return keyProblem
  const closer = isArray ? ']]' : ']'
  if (!text.startsWith(closer, key.end)) return describePosition(text, key.end)
  const rest = skipSpace(text, key.end + closer.length)
  return isLineEnd(text, rest) ? null : describePosition(text, rest)
}

function checkAssignment(text: string, start: number): string | null {
  const key = scanKeyPath(text, start)
  if (key === null || key.path.length > MAX_TOML_KEY_PATH_DEPTH) return describePosition(text, start)
  const keyProblem = checkTomlKeyEscapes(text, start, key.end)
  if (keyProblem !== null) return keyProblem
  if (text.charAt(key.end) !== '=') return describePosition(text, key.end)
  const valueStart = skipSpace(text, key.end + 1)
  if (isLineEnd(text, valueStart)) return describePosition(text, valueStart)
  const scanned = checkValue(text, valueStart, 0)
  if (scanned.problem !== null) return scanned.problem
  const rest = skipSpace(text, scanned.end)
  return isLineEnd(text, rest) ? null : describePosition(text, rest)
}

interface QuoteState {
  quote: string
  multiline: boolean
  escaped: boolean
  index: number
}

function advanceQuote(text: string, state: QuoteState): QuoteState {
  const char = text.charAt(state.index)
  if (state.escaped) return { ...state, escaped: false, index: state.index + 1 }
  if (state.quote === '"' && char === '\\') return { ...state, escaped: true, index: state.index + 1 }
  if (state.multiline && text.startsWith(state.quote.repeat(3), state.index)) {
    return { quote: '', multiline: false, escaped: false, index: state.index + 3 }
  }
  if (!state.multiline && char === state.quote) return { ...state, quote: '', index: state.index + 1 }
  return { ...state, index: state.index + 1 }
}

function commentControlProblem(text: string, start: number): { end: number; problem: string | null } {
  let end = start + 1
  while (end < text.length && text.charAt(end) !== '\n' && text.charAt(end) !== '\r') {
    const code = text.charCodeAt(end)
    if ((code < 0x20 && code !== 0x09) || (code >= 0x7f && code <= 0x9f)) {
      return { end, problem: describePosition(text, end) }
    }
    end += 1
  }
  return { end, problem: null }
}

function commentProblem(text: string): string | null {
  let state: QuoteState = { quote: '', multiline: false, escaped: false, index: 0 }
  while (state.index < text.length) {
    const char = text.charAt(state.index)
    if (state.quote !== '') {
      state = advanceQuote(text, state)
      continue
    }
    if (char === '"' || char === "'") {
      const multiline = text.startsWith(char.repeat(3), state.index)
      state = { ...state, quote: char, multiline, index: state.index + (multiline ? 3 : 1) }
      continue
    }
    if (char !== '#') {
      state.index += 1
      continue
    }
    const comment = commentControlProblem(text, state.index)
    if (comment.problem !== null) return comment.problem
    state.index = comment.end
  }
  return null
}

/** One line's definition against the tracker. Returns the first problem, or
 *  the table the next line sits in: a header opens its own, an assignment
 *  stays under the table it was recorded in. */
function checkLine(
  text: string,
  start: number,
  currentTable: string[],
  definitions: DefinitionCheck,
): { problem: string | null; table: string[] } {
  const isHeader = text.charAt(start) === '['
  const isArray = isHeader && text.startsWith('[[', start)
  const problem = isHeader ? checkHeader(text, start) : checkAssignment(text, start)
  if (problem !== null) return { problem, table: currentTable }
  const scanned = scanKeyPath(text, start + (isArray ? 2 : isHeader ? 1 : 0))
  if (scanned === null) return { problem: describePosition(text, start), table: currentTable }
  const path = isHeader ? scanned.path : [...currentTable, ...scanned.path]
  if (recordDefinition(definitions, path, isHeader, isArray, currentTable.length)) {
    return { problem: describePosition(text, start), table: currentTable }
  }
  return { problem: null, table: isHeader ? scanned.path : currentTable }
}

/** Position of the first syntax problem, or null when the document is sound.
 *  Sound here includes "no key or table is defined twice": the tolerant
 *  scanner resolves duplicates last-wins, but a strict parser refuses the
 *  document, so the strict pass must too (see redefine.ts). An assignment is
 *  recorded under the table it sits in, so a leaf named like a table prefix
 *  (`model = ...` inside `[model.a]`) is not mistaken for one at the root. */
export function findTomlProblem(text: string): string | null {
  for (let offset = 0; offset < text.length; offset += 1) {
    if (text.charAt(offset) === '\r' && text.charAt(offset + 1) !== '\n') {
      return describePosition(text, offset)
    }
  }
  const invalidComment = commentProblem(text)
  if (invalidComment !== null) return invalidComment
  const definitions = trackDefinitions()
  let currentTable: string[] = []
  let index = 0
  while (index < text.length) {
    const lineStart = index
    const start = skipSpace(text, lineStart)
    if (isLineEnd(text, start)) {
      index = endOfLine(text, lineStart)
      continue
    }
    const outcome = checkLine(text, start, currentTable, definitions)
    if (outcome.problem !== null) return outcome.problem
    currentTable = outcome.table
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
