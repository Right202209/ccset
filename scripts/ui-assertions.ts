import assert from 'node:assert/strict'
import type { Viewport } from '../src/types.js'
import {
  ASCII_GLYPHS,
  ASCII_TERMINAL,
  UNICODE_GLYPHS,
  UNICODE_TERMINAL,
  resolveTerminal,
} from '../src/ui/terminal.js'

export function assertPaintsFit(paints: string[], viewport: Viewport): void {
  for (const paint of paints) {
    const rows = paint.length === 0 ? 0 : paint.split('\n').length
    assert.ok(rows <= viewport.rows, `A Rendered paint used ${rows}/${viewport.rows} rows:\n${paint}`)
  }
}

/** Paints carry ANSI attributes; the text itself is what assertions read. */
export function stripAnsi(paint: string): string {
  // eslint-disable-next-line no-control-regex
  return paint.replace(/\u001B\[[0-9;?]*[a-zA-Z]/g, '')
}

/** A glyph is one or more printable ASCII characters -- an empty glyph is not one. */
const ASCII_GLYPH = /^[\x20-\x7e]+$/

/**
 * A paint spans lines, so the line breaks and tabs Ink emits are allowed beside
 * printable ASCII -- and nothing else. `\s` would have admitted U+00A0, U+2028
 * and U+3000, which are precisely the characters this assertion exists to catch.
 */
const ASCII_PAINT = /^[\x20-\x7e\n\r\t]*$/

/**
 * The seven-bit guarantee, asserted over every paint rather than the visited
 * ones. Any paint site that forgets to fold turns this red on its own, which is
 * what makes the fold safe to spread across the interface.
 */
export function assertPaintsAreAscii(paints: string[]): void {
  const unrenderable = 'A paint under the ASCII set carries a character it cannot draw'
  for (const paint of paints) {
    assert.match(paint, ASCII_PAINT, `${unrenderable}:\n${paint}`)
  }
}

/**
 * The environment override, checked without touching process.env: the ASCII set
 * has to be reachable from CCSET_ASCII=1, has to be free of any glyph a
 * seven-bit terminal cannot draw, and has to actually differ from the default.
 */
export function assertGlyphSetsAreSelectable(): void {
  for (const [name, glyph] of Object.entries(ASCII_GLYPHS)) {
    assert.ok(ASCII_GLYPH.test(glyph), `The ASCII glyph set's ${name} is not ASCII: ${glyph}`)
  }
  for (const frame of ASCII_TERMINAL.busyFrames) {
    assert.ok(ASCII_GLYPH.test(frame), `The ASCII busy indicator is not ASCII: ${frame}`)
  }
  const ascii = resolveTerminal({ CCSET_ASCII: '1' })
  assert.equal(ascii, ASCII_TERMINAL, 'CCSET_ASCII=1 must select the ASCII set')
  assert.equal(resolveTerminal({}), UNICODE_TERMINAL, 'An unset CCSET_ASCII must select Unicode')
  assert.notEqual(ASCII_GLYPHS.focus, UNICODE_GLYPHS.focus, 'The two focus markers are identical')
  assert.notDeepEqual(
    ASCII_TERMINAL.busyFrames,
    UNICODE_TERMINAL.busyFrames,
    'The two terminals use identical busy indicators',
  )
}
