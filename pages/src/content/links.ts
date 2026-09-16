import { DOC_ENTRIES } from './registry.js'

/** Where every non-route repository link lands. */
export const REPO_OWNER = 'Right202209'
export const REPO_NAME = 'ccset'
export const REPO_BRANCH = 'master'

const BLOB_BASE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${REPO_BRANCH}/`

/** The GitHub URL for a repository path, used for everything the site does not route. */
export function repoBlobUrl(repoPath: string): string {
  return BLOB_BASE + encodeURI(repoPath)
}

/** Directory part of a repository path ('' for a root-level file). */
export function sourceDirOf(repoPath: string): string {
  const index = repoPath.lastIndexOf('/')
  return index === -1 ? '' : repoPath.slice(0, index)
}

function registeredSlug(repoPath: string): string | undefined {
  return DOC_ENTRIES.find((entry) => entry.repoPath === repoPath)?.slug
}

/** Resolves `..`/`.` segments lexically against the source file's directory. */
function resolveRelative(baseDir: string, rel: string): string {
  const joined = rel.startsWith('/') ? rel.slice(1) : `${baseDir === '' ? '' : `${baseDir}/`}${rel}`
  const segments: string[] = []
  for (const segment of joined.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  return segments.join('/')
}

/**
 * Rewrites a Markdown link for the site: repository paths that are registered
 * docs become `/docs/<slug>` routes (fragment preserved), every other
 * repository path becomes its GitHub blob URL, and non-repo URLs pass through.
 * `href` is resolved relative to the directory of the Markdown file it comes
 * from; GitHub-style autolinks may arrive percent-encoded, so the path is
 * decoded before matching and re-encoded for blob URLs.
 */
export function resolveRepoLink(rawHref: string, sourceDir: string): string {
  const href = rawHref.trim()
  if (href.startsWith('#') || /^mailto:/i.test(href)) return href
  if (/^https?:\/\//i.test(href)) {
    if (href.startsWith(BLOB_BASE)) {
      return resolveRepoLink(decodeRest(href.slice(BLOB_BASE.length)), sourceDir)
    }
    return href
  }
  const decoded = safeDecode(href)
  const hashIndex = decoded.indexOf('#')
  const pathPart = hashIndex === -1 ? decoded : decoded.slice(0, hashIndex)
  const fragment = hashIndex === -1 ? undefined : decoded.slice(hashIndex + 1)
  const repoPath = resolveRelative(sourceDir, pathPart)
  const slug = registeredSlug(repoPath)
  if (slug === undefined) {
    const blob = repoBlobUrl(repoPath)
    return fragment === undefined ? blob : `${blob}#${fragment}`
  }
  return fragment === undefined ? `/docs/${slug}` : `/docs/${slug}#${fragment}`
}

function decodeRest(rest: string): string {
  const hashIndex = rest.indexOf('#')
  const pathPart = safeDecode(hashIndex === -1 ? rest : rest.slice(0, hashIndex))
  return hashIndex === -1 ? pathPart : `${pathPart}#${rest.slice(hashIndex + 1)}`
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
