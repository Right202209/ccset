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
 * Codex refuses.
 */

function join(path: string[]): string {
  return JSON.stringify(path)
}

/**
 * Key paths as a prefix-aware set. When an array table repeats, every key
 * recorded under its path belongs to the previous element and must be cleared.
 * Scanning every recorded path for that is quadratic in a crafted document
 * (many unrelated keys, many repeats), so each path is also indexed under each
 * of its proper prefixes and a clear touches only the real descendants.
 */
class PathSet {
  private readonly paths = new Map<string, string[]>()
  private readonly underPrefix = new Map<string, Set<string>>()

  has(path: string[]): boolean {
    return this.paths.has(join(path))
  }

  add(path: string[]): void {
    const key = join(path)
    if (this.paths.has(key)) return
    this.paths.set(key, [...path])
    for (let depth = 1; depth < path.length; depth += 1) {
      const prefix = join(path.slice(0, depth))
      let bucket = this.underPrefix.get(prefix)
      if (bucket === undefined) {
        bucket = new Set()
        this.underPrefix.set(prefix, bucket)
      }
      bucket.add(key)
    }
  }

  /** True when any proper prefix of `path` is a member -- a table was created
   *  on the way to it, so one form or the other redefines that table. */
  hasPrefix(path: string[]): boolean {
    for (let depth = 1; depth < path.length; depth += 1) {
      if (this.paths.has(join(path.slice(0, depth)))) return true
    }
    return false
  }

  clearDescendants(path: string[]): void {
    const prefix = join(path)
    const bucket = this.underPrefix.get(prefix)
    if (bucket === undefined) return
    this.underPrefix.delete(prefix)
    for (const descendant of bucket) {
      const stored = this.paths.get(descendant)
      this.paths.delete(descendant)
      if (stored === undefined) continue
      for (let depth = 1; depth < stored.length; depth += 1) {
        const parent = join(stored.slice(0, depth))
        const holder = this.underPrefix.get(parent)
        if (holder === undefined) continue
        holder.delete(descendant)
        if (holder.size === 0) this.underPrefix.delete(parent)
      }
    }
  }
}

/** Hands one construct's full key path to the tracker: the syntax has already
 *  passed, so the key is present, and an assignment path carries the table it
 *  sits in. `tableDepth` is how many leading segments the enclosing table
 *  contributed -- only the key's own dotted segments create tables that a
 *  header may never redefine. True when the header or assignment redefines. */
export function recordDefinition(
  definitions: DefinitionCheck,
  path: string[],
  isHeader: boolean,
  isArray: boolean,
  tableDepth: number,
): boolean {
  return isHeader
    ? definitions.noteHeader(path, isArray)
    : definitions.noteAssignment(path, tableDepth)
}

interface DefinitionState {
  /** Every assigned leaf, across all instances. */
  leaves: PathSet
  /** Tables dotted keys created, across all instances -- headers may never
   *  redefine one, wherever in the document the dotted keys sat. */
  dotted: PathSet
  singleTables: PathSet
  arrayTables: PathSet
  /** Per table instance: an array of tables repeats its keys per element, and
   *  a single table's keys cannot repeat only because its header cannot. */
  instanceLeaves: Set<string>
  instanceDotted: Set<string>
}

function noteAssignment(state: DefinitionState, path: string[], tableDepth: number): boolean {
  const key = join(path)
  if (state.instanceLeaves.has(key) || state.instanceDotted.has(key) || state.singleTables.has(path)) {
    return true
  }
  if (state.leaves.hasPrefix(path)) return true
  state.instanceLeaves.add(key)
  state.leaves.add(path)
  // The table the assignment sits in was opened by a header (or an enclosing
  // dotted key elsewhere); only the key's own dotted segments are tables a
  // header may never redefine later.
  for (let depth = tableDepth + 1; depth < path.length; depth += 1) {
    const prefix = path.slice(0, depth)
    state.instanceDotted.add(join(prefix))
    state.dotted.add(prefix)
  }
  return false
}

function noteHeader(state: DefinitionState, path: string[], isArray: boolean): boolean {
  const known =
    state.singleTables.has(path) ||
    state.dotted.has(path) ||
    state.leaves.has(path) ||
    (!isArray && state.arrayTables.has(path))
  if (known || state.leaves.hasPrefix(path)) return true
  if (isArray && state.arrayTables.has(path)) {
    state.leaves.clearDescendants(path)
    state.dotted.clearDescendants(path)
    state.singleTables.clearDescendants(path)
    state.arrayTables.clearDescendants(path)
  }
  if (isArray) state.arrayTables.add(path)
  else state.singleTables.add(path)
  state.instanceLeaves = new Set()
  state.instanceDotted = new Set()
  return false
}

export interface DefinitionCheck {
  /** Records one `key = value` line under the table it sits in; true when it
   *  redefines something. `tableDepth` is the enclosing table's path length. */
  noteAssignment: (path: string[], tableDepth: number) => boolean
  /** Records one `[table]` or `[[array]]` header; true when it redefines. */
  noteHeader: (path: string[], isArray: boolean) => boolean
}

export function trackDefinitions(): DefinitionCheck {
  const state: DefinitionState = {
    leaves: new PathSet(),
    dotted: new PathSet(),
    singleTables: new PathSet(),
    arrayTables: new PathSet(),
    instanceLeaves: new Set(),
    instanceDotted: new Set(),
  }
  return {
    noteAssignment: (path, tableDepth) => noteAssignment(state, path, tableDepth),
    noteHeader: (path, isArray) => noteHeader(state, path, isArray),
  }
}
