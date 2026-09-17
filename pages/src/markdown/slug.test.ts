import { describe, expect, it } from 'vitest'
import { createSlugger, headingText, slugifyHeading } from './slug.js'

describe('slugifyHeading', () => {
  it('matches GitHub ids used by the repository docs', () => {
    expect(slugifyHeading('What it will not do to your files')).toBe('what-it-will-not-do-to-your-files')
    expect(slugifyHeading('Fixture map')).toBe('fixture-map')
    expect(slugifyHeading('New agents')).toBe('new-agents')
    expect(slugifyHeading('功能')).toBe('功能')
    expect(slugifyHeading('CLI')).toBe('cli')
  })

  it('drops punctuation and keeps inner hyphens', () => {
    expect(slugifyHeading('Non-interactive commands')).toBe('non-interactive-commands')
    expect(slugifyHeading('Backups, modes, and atomic writes')).toBe('backups-modes-and-atomic-writes')
  })

  it('keeps inline code content and slugs it like GitHub would', () => {
    expect(slugifyHeading(headingText('Run `npm test` first'))).toBe('run-npm-test-first')
  })
})

describe('createSlugger', () => {
  it('suffixes duplicates as GitHub does', () => {
    const slug = createSlugger()
    expect(slug('Notes')).toBe('notes')
    expect(slug('Notes')).toBe('notes-1')
    expect(slug('Notes')).toBe('notes-2')
    expect(slug('Notes')).toBe('notes-3')
  })

  it('is independent between documents', () => {
    expect(createSlugger()('Notes')).toBe('notes')
    expect(createSlugger()('Notes')).toBe('notes')
  })
})
