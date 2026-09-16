import { describe, expect, it } from 'vitest'
import { docTitle, getDoc, homeSlug, neighbors } from './docs.js'
import { DOC_ENTRIES, DOC_ORDER } from './registry.js'
import { searchDocs } from './search.js'

describe('registry', () => {
  it('has unique slugs and source files that exist', () => {
    expect(new Set(DOC_ORDER).size).toBe(DOC_ENTRIES.length)
    for (const entry of DOC_ENTRIES) {
      expect(Object.keys(entry.sources).length, entry.slug).toBeGreaterThan(0)
    }
  })
})

describe('getDoc', () => {
  it('resolves every slug to non-empty content with a usable source directory', () => {
    for (const slug of DOC_ORDER) {
      const doc = getDoc(slug, 'en')
      expect(doc, slug).toBeDefined()
      expect(doc?.markdown.length ?? 0, slug).toBeGreaterThan(0)
      expect(doc?.sourceDir.startsWith('/') ?? true, slug).toBe(false)
    }
  })

  it('falls back to the English source for zh-Hans readers', () => {
    const doc = getDoc('user-guide', 'zh-Hans')
    expect(doc?.sourcePath).toBe('docs/user-guide.md')
    expect(doc?.locale).toBe('zh-Hans')
  })

  it('shows the Chinese-only workflow doc in both languages', () => {
    expect(getDoc('add-agent-workflow', 'zh-Hans')?.sourcePath).toBe('docs/agents/add-agent-workflow.md')
    expect(getDoc('add-agent-workflow', 'en')?.sourcePath).toBe('docs/agents/add-agent-workflow.md')
  })

  it('serves the localized overview per locale and rejects unknown slugs', () => {
    expect(getDoc('overview', 'zh-Hans')?.sourcePath).toBe('README.zh-CN.md')
    expect(getDoc('overview', 'en')?.sourcePath).toBe('README.md')
    expect(getDoc('no-such-doc', 'en')).toBeUndefined()
  })
})

describe('docTitle', () => {
  it('reads the first H1 of the document', () => {
    const readme = getDoc('overview', 'en')
    expect(docTitle(readme?.markdown ?? '')).toBe('ccset')
  })

  it('skips leading blanks and returns empty without an H1', () => {
    expect(docTitle('\n\nsome text\n')).toBe('')
  })
})

describe('neighbors', () => {
  it('chains every doc in stable registry order', () => {
    expect(homeSlug()).toBe('overview')
    let slug: string | undefined = DOC_ORDER[0]
    const visited: string[] = []
    let prev: string | undefined
    while (slug !== undefined) {
      const { prev: p, next } = neighbors(slug)
      expect(p?.slug, `chain at ${slug}`).toBe(prev)
      visited.push(slug)
      prev = slug
      slug = next?.slug
    }
    expect(visited).toEqual([...DOC_ORDER])
  })

  it('returns nothing for unknown slugs', () => {
    expect(neighbors('nope')).toEqual({})
  })
})

describe('searchDocs', () => {
  it('finds docs by content with a snippet around the match', () => {
    const hits = searchDocs('fixture map', 'en')
    expect(hits[0]?.slug).toBe('verification')
    expect(hits[0]?.snippet.toLowerCase()).toContain('fixture')
  })

  it('searches the locale a reader sees and tolerates empty queries', () => {
    expect(searchDocs('文件与密钥安全', 'zh-Hans').map((hit) => hit.slug)).toContain('overview')
    expect(searchDocs('', 'en')).toEqual([])
    expect(searchDocs('   ', 'en')).toEqual([])
  })
})
