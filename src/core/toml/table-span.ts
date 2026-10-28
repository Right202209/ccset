import type { TomlDoc } from './scan.js'

/**
 * What a table deletion covers. Kept apart from the editor that calls it
 * because "which bytes belong to this table" is the part worth reading on its
 * own: the header line, the keys under it, its sub-tables, and -- deliberately --
 * not the comment above the header, which ccset never wrote and so never removes.
 */

export interface Span {
  start: number
  end: number
}

/** True when `prefix` names a strictly shallower path than `path`. */
function isPrefix(prefix: string[], path: string[]): boolean {
  if (prefix.length >= path.length) return false
  return prefix.every((segment, index) => path[index] === segment)
}

function pathKey(path: string[]): string {
  return JSON.stringify(path)
}

/**
 * The span of the table a path names, or of the first table below it: a
 * `[model.acme.sub]` block is what `model.acme` has on disk when no header
 * declares `model.acme` itself.
 *
 * It covers the header line, the entries under it, and the nested headers and
 * entries below those -- and it stops at the last of those lines. Comments and
 * blank lines after that point stay, even the ones that sat between this section
 * and the next header, because a comment above a header describes what follows
 * it and no codec of ccset's removes a comment it did not write (JSONC's
 * deletion leaves every one of them). A table spelled only with dotted keys has
 * no span of its own, and an array of tables is never ccset's to remove.
 */
export function tableSectionSpan(doc: TomlDoc, path: string[]): Span | null {
  const key = pathKey(path)
  const belongs = (candidate: TomlDoc['tables'][number]): boolean =>
    !candidate.isArray && (pathKey(candidate.path) === key || isPrefix(path, candidate.path))
  const indexes = new Set<number>()
  doc.tables.forEach((table, index) => {
    if (belongs(table)) indexes.add(index)
  })
  const head = doc.tables[doc.tables.findIndex(belongs)]
  if (head === undefined) return null
  let end = head.bodyStart
  for (const index of indexes) {
    end = Math.max(end, doc.tables[index]?.bodyStart ?? end)
  }
  for (const entry of doc.entries) {
    if (indexes.has(entry.tableIndex)) end = Math.max(end, entry.lineEnd)
  }
  return { start: head.headerStart, end }
}

/** The next line defining a key under a dotted-only table; one per pass. */
export function dottedLineSpan(doc: TomlDoc, path: string[]): Span | null {
  for (const entry of doc.entries) {
    if (entry.inArray || !isPrefix(path, entry.path)) continue
    return { start: entry.lineStart, end: entry.lineEnd }
  }
  return null
}

export function removeSpan(text: string, span: Span): string {
  return `${text.slice(0, span.start)}${text.slice(span.end)}`
}
