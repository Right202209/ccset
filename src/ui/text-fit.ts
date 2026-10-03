import stringWidth from 'string-width'
import wrapAnsi from 'wrap-ansi'

/**
 * Display-width helpers for text that cannot wrap: a border label, the
 * selection bar, a side Panel line. Ink's own truncation always inserts U+2026,
 * which a seven-bit terminal cannot draw, so these take the ellipsis as an
 * argument and the caller passes it through the Terminal's `fold`.
 */

/** Rows `text` takes once Ink wraps it to `width` columns, with Ink's own options. */
export function wrappedRows(text: string, width: number): number {
  return wrapAnsi(text, Math.max(1, width), { trim: false, hard: true }).split('\n').length
}

/** Pads with spaces to `width` display columns; wider text comes back as it was. */
export function padEnd(text: string, width: number): string {
  const gap = width - stringWidth(text)
  return gap > 0 ? `${text}${' '.repeat(gap)}` : text
}

/** Keeps the start of `text` inside `width` columns and marks the cut. */
export function truncateEnd(text: string, width: number, ellipsis: string): string {
  if (stringWidth(text) <= width) return text
  const budget = width - stringWidth(ellipsis)
  if (budget <= 0) return takeColumns(Array.from(text), width).join('')
  return `${takeColumns(Array.from(text), budget).join('')}${ellipsis}`
}

/**
 * Keeps the end of `text`: the end of a path or of a navigation trail is the
 * part that says where the core user is.
 */
export function truncateStart(text: string, width: number, ellipsis: string): string {
  if (stringWidth(text) <= width) return text
  const budget = width - stringWidth(ellipsis)
  const reversed = Array.from(text).reverse()
  if (budget <= 0) return takeColumns(reversed, width).reverse().join('')
  return `${ellipsis}${takeColumns(reversed, budget).reverse().join('')}`
}

/** The leading characters that fit in `width` columns; a wide one never straddles the edge. */
function takeColumns(characters: string[], width: number): string[] {
  const taken: string[] = []
  let used = 0
  for (const character of characters) {
    used += stringWidth(character)
    if (used > width) break
    taken.push(character)
  }
  return taken
}
