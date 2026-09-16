import { describe, expect, it } from 'vitest'
import { resolveRepoLink } from '../content/links.js'
import { extractHeadings } from './headings.js'
import { renderMarkdown } from './render.js'

describe('renderMarkdown', () => {
  it('strips script tags and event handlers', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">', '')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
  })

  it('keeps the site first-party: no img, style tags, or style attributes', () => {
    const html = renderMarkdown(
      '<img src="https://badge.example/x.png"><style>p{color:red}</style>\n\n<span style="color:red">x</span>',
      '',
    )
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<style')
    expect(html).not.toContain('style=')
  })

  it('gives headings GitHub-compatible ids', () => {
    const html = renderMarkdown('## What it will not do to your files\n\n### 功能\n', '')
    expect(html).toContain('id="what-it-will-not-do-to-your-files"')
    expect(html).toContain('id="功能"')
  })

  it('suffixes duplicate headings the way GitHub does', () => {
    const html = renderMarkdown('## Same\n\n## Same\n', '')
    expect(html).toContain('id="same"')
    expect(html).toContain('id="same-1"')
  })

  it('keeps the language class on fenced code blocks', () => {
    const html = renderMarkdown('```bash\nnpx @droite/ccset\n```', '')
    expect(html).toContain('<code class="language-bash">')
  })

  it('renders GFM tables', () => {
    const html = renderMarkdown('| Agent | id |\n| --- | --- |\n| Claude Code | claude-code |\n', '')
    expect(html).toContain('<table>')
    expect(html).toContain('claude-code')
  })

  it('rewrites repo links to routes and marks external links', () => {
    const html = renderMarkdown('[guide](user-guide.md#cli) and [site](https://example.com)', 'docs')
    expect(html).toContain(`href="${resolveRepoLink('user-guide.md#cli', 'docs')}"`)
    expect(html).toContain('rel="noopener noreferrer"')
  })
})

describe('extractHeadings', () => {
  it('lists h2 and h3 with renderer ids, skipping h1 and h4', () => {
    const markdown = '# Title\n\n## One\n\n### Deep\n\n#### Skipped\n\n## Two\n'
    expect(extractHeadings(markdown)).toEqual([
      { depth: 2, text: 'One', id: 'one' },
      { depth: 3, text: 'Deep', id: 'deep' },
      { depth: 2, text: 'Two', id: 'two' },
    ])
  })
})
