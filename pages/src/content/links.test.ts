import { describe, expect, it } from 'vitest'
import { repoBlobUrl, resolveRepoLink, sourceDirOf } from './links.js'

describe('sourceDirOf', () => {
  it('splits repository paths into their directories', () => {
    expect(sourceDirOf('README.md')).toBe('')
    expect(sourceDirOf('docs/user-guide.md')).toBe('docs')
    expect(sourceDirOf('docs/agents/add-agent-workflow.md')).toBe('docs/agents')
  })
})

describe('resolveRepoLink', () => {
  it('maps a registered repo path to its site route, preserving fragments', () => {
    expect(resolveRepoLink('../README.md', 'docs')).toBe('/docs/overview')
    expect(resolveRepoLink('verification.md#fixture-map', 'docs')).toBe('/docs/verification#fixture-map')
    expect(resolveRepoLink('docs/adding-an-agent.md', '')).toBe('/docs/adding-an-agent')
  })

  it('maps absolute blob links to registered docs to the same route', () => {
    const href = 'https://github.com/Right202209/ccset/blob/master/docs/user-guide.md#cli'
    expect(resolveRepoLink(href, '')).toBe('/docs/user-guide#cli')
  })

  it('sends unregistered repo paths (autolinks included) to GitHub', () => {
    const encoded = '../Important%20Documentation.md'
    expect(resolveRepoLink(encoded, 'docs')).toBe(repoBlobUrl('Important Documentation.md'))
    expect(resolveRepoLink('../src/types.ts', 'docs')).toBe(repoBlobUrl('src/types.ts'))
  })

  it('passes through same-page anchors, mailto, and non-repo URLs', () => {
    expect(resolveRepoLink('#cli', 'docs')).toBe('#cli')
    expect(resolveRepoLink('mailto:a@example.com', '')).toBe('mailto:a@example.com')
    expect(resolveRepoLink('https://example.com', '')).toBe('https://example.com')
  })
})
