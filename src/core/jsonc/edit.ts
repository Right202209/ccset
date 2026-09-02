import { findNodeAtLocation, parseTree, type Node } from 'jsonc-parser'
import type { JsonValue } from '../../types.js'
import { applyManagedWrites, type ManagedWrite } from '../merge.js'
import { renderJsoncValue, INDENT_UNIT } from './format.js'
import {
  detectEol,
  endOfLine,
  indentOf,
  isIndent,
  lineStartOf,
  sameLineCommentEnd,
  skipTrivia,
} from './text.js'

/**
 * Applies the manifest to a JSONC document by editing its text, not by
 * rebuilding it (ADR 0004). Setting a managed key replaces the span its value
 * occupies; adding one inserts a single line into the object it belongs to;
 * deleting one removes a single line. Every comment, blank line and key order
 * outside those spans is copied through byte for byte.
 *
 * The parser and the strict pass are npm's jsonc-parser -- the one behind VS
 * Code's settings editor, and the one opencode itself parses with. Its patch
 * engine is not used: with formatting options it reflows the line around an
 * insertion, which rewrites bytes ccset does not own, and without them an
 * insertion is jammed inline. So the spans come from the parse tree and the
 * splices are ours, under ADR 0003's rules. The corpus gate inside
 * `verify:opencode` carries the byte-identity guarantee.
 *
 * Each write re-parses. Documents are a few kilobytes and the alternative --
 * tracking how every earlier splice shifted every later offset -- is the kind
 * of bookkeeping that silently corrupts a file when it is wrong.
 */

function parseRoot(text: string): Node | undefined {
  return parseTree(text, [], { allowTrailingComma: true })
}

/** The property node a key resolves to. JSON.parse reads the last duplicate
 *  key as the value, so the last one is the one a save has to replace. */
function propertyOf(objectNode: Node, key: string): Node | undefined {
  let found: Node | undefined
  for (const child of objectNode.children ?? []) {
    if (child.type === 'property' && child.children?.[0]?.value === key) found = child
  }
  return found
}

function valueEnd(prop: Node): number {
  const value = prop.children?.[1]
  return value === undefined ? prop.offset + prop.length : value.offset + value.length
}

/** Chains missing keys onto a leaf: `['a','b'], v` becomes `{a: {b: v}}`. */
function wrapValue(keys: string[], leaf: JsonValue): JsonValue {
  return keys.reduceRight<JsonValue>((acc, key) => ({ [key]: acc }), leaf)
}

/** A half-open [start, end) range of the document text. */
interface Span {
  start: number
  end: number
}

/** A property a save adds to an object: its key and the value it takes. */
interface NewProperty {
  key: string
  value: JsonValue
}

function spliceSpan(text: string, span: Span, content: string): string {
  return `${text.slice(0, span.start)}${content}${text.slice(span.end)}`
}

/* ---------------------------------------------------------------- set */

export function setJsoncPath(text: string, path: string[], value: JsonValue): string {
  if (path.length === 0) return text
  const root = parseRoot(text)
  if (root === undefined) return renderFreshDocument([{ path, value }])
  for (let depth = path.length - 1; depth >= 0; depth -= 1) {
    const key = path[depth]
    if (key === undefined) continue
    const container = depth === 0 ? root : findNodeAtLocation(root, path.slice(0, depth))
    if (container === undefined) continue
    if (container.type === 'object') {
      const child = propertyOf(container, key)
      const leaf = wrapValue(path.slice(depth + 1), value)
      if (child === undefined) return insertProperty(text, container, { key, value: leaf })
      return replaceValueSpan(text, child, leaf)
    }
    // An intermediate that is not an object sits on a managed path, so
    // replacing it is in scope; unmanaged siblings are untouched either way.
    return replaceNodeSpan(text, container, wrapValue(path.slice(depth), value))
  }
  return text
}

/** A replacement rewrites the span ccset owns; the value renders pretty at the
 *  property's own indent, so re-saving ccset's own output changes nothing. */
function replaceValueSpan(text: string, prop: Node, value: JsonValue): string {
  const start = prop.children?.[1]?.offset ?? prop.offset
  const indent = indentOf(text, lineStartOf(text, start))
  const rendered = renderJsoncValue(value, indent, detectEol(text))
  return spliceSpan(text, { start, end: valueEnd(prop) }, rendered)
}

function replaceNodeSpan(text: string, node: Node, value: JsonValue): string {
  const indent = indentOf(text, lineStartOf(text, node.offset))
  const rendered = renderJsoncValue(value, indent, detectEol(text))
  return spliceSpan(text, { start: node.offset, end: node.offset + node.length }, rendered)
}

function renderFreshDocument(writes: ManagedWrite[]): string {
  const data = applyManagedWrites({}, writes)
  return `${JSON.stringify(data, null, 2)}\n`
}

/**
 * Adds one property to an object node: appended after its last child, the way
 * the JSON codec's insertion order works. The separator goes in front of the
 * new property, so a trailing comma the document already had stays one -- the
 * author's style survives the save. An expanded object gets the new property
 * on its own line at the children's indent; an inline object stays inline.
 */
function insertProperty(text: string, container: Node, added: NewProperty): string {
  const children = container.children ?? []
  const last = children[children.length - 1]
  if (last === undefined) return insertFirstProperty(text, container, added)
  const expanded = text.slice(container.offset, container.offset + container.length).includes('\n')
  const indent = insertIndent(text, last, expanded)
  const rendered = `${JSON.stringify(added.key)}: ${renderJsoncValue(added.value, indent, detectEol(text))}`
  const content = expanded ? `,${detectEol(text)}${indent}${rendered}` : `, ${rendered}`
  return spliceSpan(text, { start: valueEnd(last), end: valueEnd(last) }, content)
}

/** Where a new child line sits: the existing children's indent when the
 *  object is expanded over several lines, inline when it is not. */
function insertIndent(text: string, last: Node, expanded: boolean): string {
  if (!expanded) return ''
  return indentOf(text, lineStartOf(text, last.offset))
}

/**
 * Appends the first property an object ever gets. An inline object takes it
 * right after the brace; an expanded one (`{\n  }`) takes it one unit deeper
 * than its closing brace, so the container reads like the rest of the file.
 */
function insertFirstProperty(text: string, container: Node, added: NewProperty): string {
  const open = container.offset + 1
  const close = container.offset + container.length - 1
  const inline = !text.slice(open, close).includes('\n')
  const indent = inline ? '' : indentOf(text, lineStartOf(text, close)) + INDENT_UNIT
  const eol = inline ? '' : detectEol(text)
  const rendered = `${JSON.stringify(added.key)}: ${renderJsoncValue(added.value, indent, eol)}`
  return spliceSpan(text, { start: open, end: open }, inline ? rendered : `${eol}${indent}${rendered}`)
}

/* -------------------------------------------------------------- delete */

/**
 * Removes one property and, when that leaves a container object empty, the
 * container too -- the same rule the JSON merge applies along a deleted path,
 * so a `.jsonc` target behaves like the `.json` one. The root object is never
 * removed.
 */
export function deleteJsoncPath(text: string, path: string[]): string {
  if (path.length === 0) return text
  const removed = removeProperty(text, path)
  if (removed === null) return text
  return deleteIfEmpty(removed, path.slice(0, -1))
}

function removeProperty(text: string, path: string[]): string | null {
  const key = path[path.length - 1]
  if (key === undefined) return null
  const root = parseRoot(text)
  if (root === undefined) return null
  const container = path.length === 1 ? root : findNodeAtLocation(root, path.slice(0, -1))
  if (container?.type !== 'object') return null
  const prop = propertyOf(container, key)
  if (prop === undefined) return null
  const span = removalSpan(text, prop)
  return spliceSpan(text, span, '')
}

function deleteIfEmpty(text: string, containerPath: string[]): string {
  if (containerPath.length === 0) return text
  const root = parseRoot(text)
  if (root === undefined) return text
  const container = findNodeAtLocation(root, containerPath)
  if (container?.type !== 'object' || (container.children ?? []).length > 0) return text
  return deleteJsoncPath(text, containerPath)
}

/**
 * Removal span for one property. Exactly one separator comma goes with it; a
 * comment on its own line survives, and a trailing comment on the property's
 * line goes with the key, the way the TOML codec removes a line. A
 * line-leading property takes its whole line -- indentation, comma, trailing
 * comment and the line break -- so no blank line is left where the key was.
 */
function removalSpan(text: string, prop: Node): Span {
  const start = prop.offset
  const lineStart = lineStartOf(text, start)
  const leading = isIndent(text, lineStart, start)
  const spanEnd = valueEnd(prop)
  let end = sameLineCommentEnd(text, spanEnd) ?? spanEnd
  const following = commaAfter(text, end)
  if (following !== null) {
    return { start: leading ? lineStart : start, end: following.end }
  }
  const preceding = commaBefore(text, start)
  if (preceding !== null) return { start: preceding, end }
  return { start: leading ? lineStart : start, end: endOfLine(text, end) }
}

interface Swallow {
  end: number
  ateLineBreak: boolean
}

/** A comma after the value, with any same-line comment and line break on it. */
function commaAfter(text: string, from: number): Swallow | null {
  const comma = skipTrivia(text, from)
  if (text.charAt(comma) !== ',') return null
  const comment = sameLineCommentEnd(text, comma + 1)
  const rest = comment ?? comma + 1
  const lineEnd = endOfLine(text, rest)
  return { end: lineEnd, ateLineBreak: lineEnd !== rest }
}

/** A comma immediately before the key, over whitespace but never a comment. */
function commaBefore(text: string, from: number): number | null {
  let i = from
  for (;;) {
    if (i === 0) return null
    i -= 1
    const char = text.charAt(i)
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') continue
    return char === ',' ? i : null
  }
}

/* --------------------------------------------------------------- entry */

export function applyJsoncWrites(text: string, writes: ManagedWrite[]): string {
  if (writes.length === 0) return text
  if (text.trim().length === 0) return renderFreshDocument(writes)
  let current = text
  for (const write of writes) {
    current =
      write.value === undefined
        ? deleteJsoncPath(current, write.path)
        : setJsoncPath(current, write.path, write.value)
  }
  return current
}
