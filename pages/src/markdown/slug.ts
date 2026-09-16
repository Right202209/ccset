/**
 * GitHub-compatible heading ids, so anchors written for GitHub (the docs are
 * full of links like user-guide.md#cli) resolve on the site too. The rule:
 * lowercase, drop everything that is not a letter, number, mark, underscore,
 * or hyphen, then spaces become hyphens -- Unicode letters kept as-is.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

export interface Slugger {
  (text: string): string
}

/** Builds a slugger that appends -1, -2, … when a heading repeats, as GitHub does. */
export function createSlugger(): Slugger {
  const counts = new Map<string, number>()
  return (text: string) => {
    const base = slugifyHeading(text)
    const seen = counts.get(base) ?? 0
    counts.set(base, seen + 1)
    return seen === 0 ? base : `${base}-${seen}`
  }
}

/**
 * Plain text of a heading before slugging: inline Markdown (code spans,
 * emphasis, links) must not leak `*` or backticks into the id.
 */
export function headingText(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_~]/g, '')
}
