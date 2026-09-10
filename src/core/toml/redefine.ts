/**
 * Duplicate-definition tracking for the strict pass. The tolerant scanner
 * resolves a repeated key last-wins and would edit such a document happily,
 * but a strict TOML parser refuses to load it -- so a save that lands in a
 * file Codex rejects is exactly the "looks right and silently fails" outcome
 * ccset exists to prevent, and the strict pass must catch it instead.
 *
 * The rules tracked here are the redefinition subset of TOML 1.0: a key may be
 * assigned once per table instance, a single table header may appear once, an
 * inline or dotted-key table cannot be redefined or extended by another form,
 * and a static table cannot take or keep an array-of-tables name. Legally
 * repeating shapes stay sound: `[[array]]` redefines per element, a super
 * table may follow its sub-tables, and the same key name may appear in
 * different tables.
 *
 * Header-vs-dotted conflicts are checked against every instance seen so far,
 * which is conservative for one exotic shape (a dotted key in an earlier array
 * element, then a sub-table header in a later one). Over-rejecting that sends
 * a file to the confirm the user decides on; under-rejecting would write one
 * Codex refuses. Paths are joined with NUL, the same separator the editor
 * uses, because a quoted key may contain any other character.
 */

import { scanKeyPath } from './scan.js'

const SEP = '\u0000'

function join(path: string[]): string {
  return path.join(SEP)
}

/** True when any proper prefix of the path sits in the set -- a table was
 *  created on the way to a leaf, and one form or the other redefines it. */
function hasPrefixIn(path: string[], set: Set<string>): boolean {
  for (let depth = 1; depth < path.length; depth += 1) {
    if (set.has(join(path.slice(0, depth)))) return true
  }
  return false
}

/** Hands one construct's path to the tracker: the syntax has already passed,
 *  so the key is present. True when the header or assignment redefines. */
export function recordDefinition(
  definitions: DefinitionCheck,
  text: string,
  start: number,
  isHeader: boolean,
): boolean {
  const isArray = isHeader && text.startsWith('[[', start)
  const key = scanKeyPath(text, start + (isArray ? 2 : isHeader ? 1 : 0))
  if (key === null) return false
  return isHeader
    ? definitions.noteHeader(key.path, isArray)
    : definitions.noteAssignment(key.path)
}

interface DefinitionState {
  /** Every assigned leaf, across all instances. */
  leaves: Set<string>
  /** Tables dotted keys created, across all instances -- headers may never
   *  redefine one, wherever in the document the dotted keys sat. */
  dotted: Set<string>
  singleTables: Set<string>
  arrayTables: Set<string>
  /** Per table instance: an array of tables repeats its keys per element, and
   *  a single table's keys cannot repeat only because its header cannot. */
  instanceLeaves: Set<string>
  instanceDotted: Set<string>
}

function noteAssignment(state: DefinitionState, path: string[]): boolean {
  const key = join(path)
  if (state.instanceLeaves.has(key) || state.instanceDotted.has(key) || state.singleTables.has(key)) {
    return true
  }
  if (hasPrefixIn(path, state.leaves)) return true
  state.instanceLeaves.add(key)
  state.leaves.add(key)
  for (let depth = 1; depth < path.length; depth += 1) {
    const prefix = join(path.slice(0, depth))
    state.instanceDotted.add(prefix)
    state.dotted.add(prefix)
  }
  return false
}

function noteHeader(state: DefinitionState, path: string[], isArray: boolean): boolean {
  const key = join(path)
  const known =
    state.singleTables.has(key) ||
    state.dotted.has(key) ||
    state.leaves.has(key) ||
    (!isArray && state.arrayTables.has(key))
  if (known || hasPrefixIn(path, state.leaves)) return true
  if (isArray) state.arrayTables.add(key)
  else state.singleTables.add(key)
  state.instanceLeaves = new Set()
  state.instanceDotted = new Set()
  return false
}

export interface DefinitionCheck {
  /** Records one `key = value` line; true when it redefines something. */
  noteAssignment: (path: string[]) => boolean
  /** Records one `[table]` or `[[array]]` header; true when it redefines. */
  noteHeader: (path: string[], isArray: boolean) => boolean
}

export function trackDefinitions(): DefinitionCheck {
  const state: DefinitionState = {
    leaves: new Set(),
    dotted: new Set(),
    singleTables: new Set(),
    arrayTables: new Set(),
    instanceLeaves: new Set(),
    instanceDotted: new Set(),
  }
  return {
    noteAssignment: (path) => noteAssignment(state, path),
    noteHeader: (path, isArray) => noteHeader(state, path, isArray),
  }
}
