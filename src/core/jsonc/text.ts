/**
 * Text-level helpers for editing a JSONC document span by span. Comments are
 * tokens like any other here: the editor has to step over them without
 * disturbing them, which is the whole point of editing in place (ADR 0004).
 */

/** Offset of the first character that is neither whitespace nor a comment. */
export function skipTrivia(text: string, index: number): number {
  let i = index
  for (;;) {
    const char = text.charAt(i)
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      i += 1
      continue
    }
    if (char === '/' && (text.charAt(i + 1) === '/' || text.charAt(i + 1) === '*')) {
      i = commentEnd(text, i)
      continue
    }
    return i
  }
}

/** End offset (exclusive) of the `//` or `/*` comment starting at `start`. */
export function commentEnd(text: string, start: number): number {
  if (text.startsWith('/*', start)) {
    const close = text.indexOf('*/', start + 2)
    return close === -1 ? text.length : close + 2
  }
  const newline = text.indexOf('\n', start)
  return newline === -1 ? text.length : newline
}

/** Offset just after the line break at `index`, when one is there. */
export function endOfLine(text: string, index: number): number {
  if (text.startsWith('\r\n', index)) return index + 2
  if (text.charAt(index) === '\n') return index + 1
  return index
}

/** Offset of the character that begins the line containing `index`. */
export function lineStartOf(text: string, index: number): number {
  const newline = text.lastIndexOf('\n', index - 1)
  return newline + 1
}

/** The spaces and tabs between a line's start and its first other character. */
export function indentOf(text: string, lineStart: number): string {
  let i = lineStart
  while (text.charAt(i) === ' ' || text.charAt(i) === '\t') i += 1
  return text.slice(lineStart, i)
}

/** True when only spaces and tabs sit between `from` and `to`. */
export function isIndent(text: string, from: number, to: number): boolean {
  for (let i = from; i < to; i += 1) {
    const char = text.charAt(i)
    if (char !== ' ' && char !== '\t') return false
  }
  return true
}

/**
 * End of a comment that starts on the same line as `from`, after any spaces --
 * the trailing comment a removed property takes with it. Null when the next
 * thing on the line is something else, or the line ends first.
 */
export function sameLineCommentEnd(text: string, from: number): number | null {
  let i = from
  while (text.charAt(i) === ' ' || text.charAt(i) === '\t') i += 1
  const char = text.charAt(i)
  if (char === '/' && (text.charAt(i + 1) === '/' || text.charAt(i + 1) === '*')) {
    return commentEnd(text, i)
  }
  return null
}

/** A comma on the same line as `from`, over spaces and tabs -- the separator
 *  a trailing comment may sit in front of. Null when the line ends first. */
export function commaOnLine(text: string, from: number): number | null {
  let i = from
  while (text.charAt(i) === ' ' || text.charAt(i) === '\t') i += 1
  return text.charAt(i) === ',' ? i : null
}

/** Start of the line break at `index` -- `\r\n` starts at its carriage
 *  return. `index` itself when no break is there. */
export function lineBreakStart(text: string, index: number): number {
  if (text.startsWith('\r\n', index)) return index
  if (text.charAt(index) === '\n' && text.charAt(index - 1) === '\r') return index - 1
  return index
}

/**
 * The document's line break, by majority: a document is overwhelmingly
 * written in one style, and inserted lines follow the style most of the
 * document uses. A tie goes to LF.
 */
export function detectEol(text: string): '\r\n' | '\n' {
  let crlf = 0
  let lf = 0
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
    if (text.charAt(i - 1) === '\r') crlf += 1
    else lf += 1
  }
  return crlf > lf ? '\r\n' : '\n'
}
