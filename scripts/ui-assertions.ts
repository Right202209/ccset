import assert from 'node:assert/strict'
import type { Viewport } from '../src/types.js'

export function assertPaintsFit(paints: string[], viewport: Viewport): void {
  for (const paint of paints) {
    const rows = paint.length === 0 ? 0 : paint.split('\n').length
    assert.ok(rows <= viewport.rows, `A Rendered paint used ${rows}/${viewport.rows} rows:\n${paint}`)
  }
}
