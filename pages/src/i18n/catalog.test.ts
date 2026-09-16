import { describe, expect, it } from 'vitest'
import { en } from './en.js'
import { zhHans } from './zh-Hans.js'

/** The site equivalent of the CLI's verify:i18n-zh: catalogs stay in lockstep. */
describe('site catalogs', () => {
  it('en and zh-Hans carry the same key set', () => {
    expect(Object.keys(zhHans).sort()).toEqual(Object.keys(en).sort())
  })

  it('every entry with placeholders uses the same {slots} in both catalogs', () => {
    const placeholders = (value: string): string[] =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort()
    for (const [key, value] of Object.entries(en)) {
      const zh = zhHans[key]
      expect(zh, `zh-Hans is missing "${key}"`).toBeDefined()
      expect(placeholders(zh ?? ''), `placeholder mismatch for "${key}"`).toEqual(placeholders(value))
    }
  })

  it('no entry is empty', () => {
    for (const [key, value] of Object.entries(en)) expect(value.trim().length, key).toBeGreaterThan(0)
    for (const [key, value] of Object.entries(zhHans)) expect(value.trim().length, key).toBeGreaterThan(0)
  })
})
