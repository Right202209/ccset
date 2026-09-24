import DOMPurify from 'dompurify'
import { Marked, type RendererObject, type Tokens } from 'marked'
import { resolveRepoLink } from '../content/links.js'
import { createSlugger, headingText } from './slug.js'

const ALLOWED_TAGS = [
  'a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'input', 'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'th', 'thead',
  'tr', 'ul',
]
const ALLOWED_ATTR = ['checked', 'class', 'disabled', 'href', 'id', 'rel', 'start', 'type']

/**
 * Renders repository Markdown to sanitized HTML. Headings get GitHub-compatible
 * ids and links are rewritten to site routes or GitHub blob URLs (ADR 0015),
 * resolved relative to the source document's directory.
 */
export function renderMarkdown(markdown: string, sourceDir: string): string {
  const slugger = createSlugger()
  const renderer: RendererObject = {
    heading(token: Tokens.Heading): string {
      const inline = this.parser.parseInline(token.tokens)
      const id = slugger(headingText(token.text))
      return `<h${token.depth} id="${id}">${inline}</h${token.depth}>\n`
    },
    link(token: Tokens.Link): string {
      const href = resolveRepoLink(token.href, sourceDir)
      const external = /^https?:\/\//i.test(href)
      const rel = external ? ' rel="noopener noreferrer"' : ''
      const inline = this.parser.parseInline(token.tokens)
      return `<a href="${escapeHref(href)}"${rel}>${inline}</a>`
    },
  }
  const marked = new Marked({ gfm: true, renderer })
  const html = marked.parse(markdown, { async: false })
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}

/** Attribute-safe href: slugs and routes are safe, passthrough URLs may not be. */
function escapeHref(href: string): string {
  return href.replace(/"/g, '%22')
}
