import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The inline critical CSS in index.html paints before any stylesheet loads;
 * its two colours must be the same values tokens.css defines.
 */
describe('index.html critical CSS', () => {
  const root = process.cwd()
  const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')
  const tokensCss = readFileSync(join(root, 'src', 'styles', 'tokens.css'), 'utf8')

  const tokenValue = (name: string): string => {
    const match = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]+)`))
    return match?.[1] ?? ''
  }

  it('background matches --color-bg', () => {
    expect(indexHtml).toContain(`background: ${tokenValue('color-bg')};`)
  })

  it('foreground matches --color-fg', () => {
    expect(indexHtml).toContain(`color: ${tokenValue('color-fg')};`)
  })

  it('enforces the first-party content security policy', () => {
    expect(indexHtml).toMatch(/http-equiv="Content-Security-Policy"/)
    expect(indexHtml).toContain("default-src 'self'")
    expect(indexHtml).toContain("object-src 'none'")
    expect(indexHtml).toContain("frame-src 'none'")
    expect(indexHtml).toContain("script-src 'self'")
  })
})
