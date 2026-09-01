/**
 * TOML string tokens, both directions. Shared by the scanner (which needs the
 * text of a quoted key), the reader, and the writer, so the escape rules are
 * stated once.
 */

const SHORT_ESCAPES: Record<string, string> = {
  b: '\b',
  t: '\t',
  n: '\n',
  f: '\f',
  r: '\r',
  // TOML 1.1 only; harmless to accept when reading a 1.0 document.
  e: '\u001b',
  '"': '"',
  '\\': '\\',
}

const ENCODE_ESCAPES: Record<string, string> = {
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
  '"': '\\"',
  '\\': '\\\\',
}

const UNICODE_LENGTHS: Record<string, number> = { u: 4, U: 8 }
const HEX_RADIX = 16
const CONTROL_MAX = 0x1f
const ESCAPE_HEX_WIDTH = 4

/** Strips the delimiters and reports whether escapes apply inside them. */
interface Token {
  body: string
  escaped: boolean
}

function openToken(token: string): Token {
  const quote = token.charAt(0)
  const triple = quote.repeat(3)
  const escaped = quote === '"'
  if (token.startsWith(triple) && token.length >= 6) {
    // A newline straight after the opening delimiter is not part of the value.
    const body = token.slice(3, token.length - 3).replace(/^\r?\n/, '')
    return { body, escaped }
  }
  return { body: token.slice(1, Math.max(1, token.length - 1)), escaped }
}

/** Reads one escape sequence starting at the backslash; returns its text. */
function readEscape(body: string, index: number): { text: string; end: number } {
  const marker = body.charAt(index + 1)
  const short = SHORT_ESCAPES[marker]
  if (short !== undefined) return { text: short, end: index + 2 }
  const width = UNICODE_LENGTHS[marker]
  if (width !== undefined) {
    const digits = body.slice(index + 2, index + 2 + width)
    const code = Number.parseInt(digits, HEX_RADIX)
    if (!Number.isNaN(code)) {
      return { text: String.fromCodePoint(code), end: index + 2 + width }
    }
  }
  // A line-ending backslash in a multi-line string swallows the whitespace
  // that follows it. Anything else unrecognised is kept verbatim rather than
  // guessed at -- this decoder only ever feeds a display, never a rewrite.
  if (marker === '\n' || marker === '\r' || marker === ' ' || marker === '\t') {
    const rest = body.slice(index + 1)
    const trimmed = rest.replace(/^[ \t]*\r?\n?[ \t\r\n]*/, '')
    return { text: '', end: index + 1 + (rest.length - trimmed.length) }
  }
  return { text: marker, end: index + 2 }
}

function unescape(body: string): string {
  let out = ''
  let i = 0
  while (i < body.length) {
    if (body.charAt(i) !== '\\') {
      out += body.charAt(i)
      i += 1
      continue
    }
    const escape = readEscape(body, i)
    out += escape.text
    i = escape.end
  }
  return out
}

/** Quoted token (delimiters included) to its value. */
export function decodeTomlString(token: string): string {
  const { body, escaped } = openToken(token)
  return escaped ? unescape(body) : body
}

/** Value to a basic string token, delimiters included. */
export function encodeTomlString(value: string): string {
  let out = '"'
  for (const char of value) {
    const escape = ENCODE_ESCAPES[char]
    if (escape !== undefined) {
      out += escape
      continue
    }
    const code = char.codePointAt(0) ?? 0
    out += code <= CONTROL_MAX ? unicodeEscape(code) : char
  }
  return `${out}"`
}

function unicodeEscape(code: number): string {
  return `\\u${code.toString(HEX_RADIX).padStart(ESCAPE_HEX_WIDTH, '0')}`
}
