import { docTitle, getDoc } from './docs.js'
import { DOC_ORDER } from './registry.js'
import type { Locale } from '../i18n/types.js'

export interface SearchHit {
  slug: string
  title: string
  /** A few words around the first match, match trimmed at word edges. */
  snippet: string
}

const SNIPPET_RADIUS = 60
const MAX_HITS = 10

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
    const title = docTitle(doc.markdown)
    const haystack = doc.markdown.replace(/[#>*`[\]()-]/g, ' ').replace(/\s+/g, ' ').toLowerCase()
    const index = haystack.indexOf(needle)
    if (index === -1) continue
    hits.push({ slug, title, snippet: snippetAround(doc.markdown, needle) })
    if (hits.length >= MAX_HITS) break
  }
  return hits
}

function snippetAround(markdown: string, needle: string): string {
  const haystack = markdown.replace(/[#>*`[\]-]/g, ' ').replace(/\s+/g, ' ')
  const index = haystack.toLowerCase().indexOf(needle)
  if (index === -1) return ''
  const start = Math.max(0, index - SNIPPET_RADIUS)
  const end = Math.min(haystack.length, index + needle.length + SNIPPET_RADIUS)
  let text = haystack.slice(start, end).trim()
  if (start > 0) text = `…${text.slice(text.indexOf(' ') + 1)}`
  if (end < haystack.length) text = `${text.slice(0, text.lastIndexOf(' '))}…`
  return text
}
