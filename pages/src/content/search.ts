import { docTitle, getDoc } from './docs.js'
import { DOC_ORDER } from './registry.js'
import type { Locale } from '../i18n/types.js'

export interface SearchHit {
  slug: string
  title: string
  /** A few words around the first match, cut at word edges. */
  snippet: string
}

const SNIPPET_RADIUS = 60
const MAX_HITS = 10

/**
 * One normalized haystack shape for matching and for snippets, so an index
 * found in one is an index into the other: inline-Markdown noise becomes
 * spaces, whitespace collapses.
 */
function normalizeForSearch(markdown: string): string {
  return markdown.replace(/[#>*`[\]()!-]/g, ' ').replace(/\s+/g, ' ')
}

/**
 * Case-insensitive substring search over the docs visible in one locale,
 * title first. Snippets cut at word boundaries so a match never appears
 * chopped mid-word.
 */
export function searchDocs(query: string, locale: Locale): SearchHit[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []
  const hits: SearchHit[] = []
  for (const slug of DOC_ORDER) {
    const doc = getDoc(slug, locale)
    if (doc === undefined) continue
    const haystack = normalizeForSearch(doc.markdown).toLowerCase()
    if (haystack.indexOf(needle) === -1) continue
    hits.push({ slug, title: docTitle(doc.markdown), snippet: snippetAround(doc.markdown, needle) })
    if (hits.length >= MAX_HITS) break
  }
  return hits
}

function snippetAround(markdown: string, needle: string): string {
  const haystack = normalizeForSearch(markdown)
  const index = haystack.toLowerCase().indexOf(needle)
  if (index === -1) return ''
  const start = Math.max(0, index - SNIPPET_RADIUS)
  const end = Math.min(haystack.length, index + needle.length + SNIPPET_RADIUS)
  let text = haystack.slice(start, end).trim()
  if (start > 0) {
    const firstSpace = text.indexOf(' ')
    if (firstSpace !== -1) text = text.slice(firstSpace + 1)
    text = `…${text}`
  }
  if (end < haystack.length) {
    const lastSpace = text.lastIndexOf(' ')
    if (lastSpace !== -1) text = text.slice(0, lastSpace)
    text = `${text}…`
  }
  return text
}
