import { sourceDirOf } from './links.js'
import { DOC_ENTRIES, findEntry, HOME_SLUG, type DocEntry } from './registry.js'
import { SOURCES } from './sources.js'
import type { Locale } from '../i18n/types.js'

export interface DocContent {
  entry: DocEntry
  /** Locale whose source is shown (may differ from the request on fallback). */
  locale: Locale
  /** Repository path the content was read from. */
  sourcePath: string
  markdown: string
  sourceDir: string
}

/**
 * Reads a document for a locale. A doc without a source in the requested
 * locale falls back to whichever source exists — every registered doc now
 * carries both locales except the Chinese-only workflow doc, which shows in
 * both languages (ADR 0015).
 */
export function getDoc(slug: string, locale: Locale): DocContent | undefined {
  const entry = findEntry(slug)
  if (entry === undefined) return undefined
  const sourcePath = entry.sources[locale] ?? Object.values(entry.sources)[0]
  if (sourcePath === undefined) return undefined
  const markdown = SOURCES[sourcePath]
  if (markdown === undefined) return undefined
  return { entry, locale, sourcePath, markdown, sourceDir: sourceDirOf(sourcePath) }
}

/** The slug /docs shows without a parameter. */
export function homeSlug(): string {
  return HOME_SLUG
}

/** First H1 of a Markdown document, or the fallback when it has none. */
export function docTitle(markdown: string): string {
  const line = markdown.split('\n').find((candidate) => candidate.trim().length > 0)
  const match = line?.match(/^#\s+(.+)$/)
  return (match?.[1] ?? '').trim()
}

/** Registry neighbours in flat order, for the docs pager. */
export function neighbors(slug: string): { prev?: DocEntry; next?: DocEntry } {
  const index = DOC_ENTRIES.findIndex((entry) => entry.slug === slug)
  if (index === -1) return {}
  return {
    prev: index > 0 ? DOC_ENTRIES[index - 1] : undefined,
    next: index < DOC_ENTRIES.length - 1 ? DOC_ENTRIES[index + 1] : undefined,
  }
}
