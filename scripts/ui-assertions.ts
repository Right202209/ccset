import assert from 'node:assert/strict'
import type { Viewport } from '../src/types.js'

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
