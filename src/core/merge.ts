import type { JsonObject, JsonValue } from '../types.js'
import { isPlainObject } from './json-file.js'

/**
 * One managed key and the value it should hold. `undefined` means "not present
 * in the proposed config", which the manifest defines as delete -- deletion is
 * required for correctness, not an optimisation: without it, turning the proxy
 * off would leave HTTPS_PROXY in the file while ccset reported success.
 */
export interface ManagedWrite {
  path: string[]
  value: JsonValue | undefined
}

/**
 * A key is data, but one name is not: reading or writing through `__proto__`
 * reaches Object.prototype rather than the document. Provider ids are rejected
 * upstream (validate.ts), so this is the second line of defense -- traversal
 * follows own properties only, and a write aimed at the prototype slot is
 * dropped rather than applied.
 */
const PROTOTYPE_KEY = '__proto__'

/** Shared with the read-side codecs, which face the same hostile keys. */
export function isPrototypeKey(key: string): boolean {
  return key === PROTOTYPE_KEY
}

export function ownChild(target: JsonObject, key: string): JsonObject | undefined {
  if (isPrototypeKey(key) || !Object.prototype.hasOwnProperty.call(target, key)) return undefined
  const child = target[key]
  return isPlainObject(child) ? child : undefined
}

export function getPath(source: JsonObject, keys: string[]): JsonValue | undefined {
  let current: JsonValue | undefined = source
  for (const key of keys) {
    if (!isPlainObject(current) || isPrototypeKey(key)) return undefined
    if (!Object.prototype.hasOwnProperty.call(current, key)) return undefined
    current = current[key]
  }
  return current
}

export function getStringAt(source: JsonObject, keys: string[]): string | undefined {
  const value = getPath(source, keys)
  return typeof value === 'string' ? value : undefined
}

function setPath(target: JsonObject, keys: string[], value: JsonValue): void {
  const [head, ...rest] = keys
  if (head === undefined) return
  if (isPrototypeKey(head)) return
  if (rest.length === 0) {
    target[head] = value
    return
  }
  // An intermediate that is not an object sits on a managed path, so replacing
  // it is in scope; unmanaged siblings are untouched either way.
  const container: JsonObject = ownChild(target, head) ?? {}
  target[head] = container
  setPath(container, rest, value)
}

/**
 * Returns true when something was actually removed. An emptied intermediate is
 * removed too -- but only along a path where a delete really happened, so an
 * `env: {}` the user wrote by hand is left alone.
 */
function deletePath(target: JsonObject, keys: string[]): boolean {
  const [head, ...rest] = keys
  if (head === undefined) return false
  if (rest.length === 0) {
    if (isPrototypeKey(head) || !Object.prototype.hasOwnProperty.call(target, head)) return false
    delete target[head]
    return true
  }
  const child = ownChild(target, head)
  if (child === undefined) return false
  const removed = deletePath(child, rest)
  if (removed && Object.keys(child).length === 0) delete target[head]
  return removed
}

/**
 * Apply the manifest to a parsed file: managed keys are set or deleted, and
 * every other key at every nesting level is passed through unchanged. `env` is
 * merged per-key and never replaced wholesale.
 */
export function applyManagedWrites(base: JsonObject, writes: ManagedWrite[]): JsonObject {
  const next = structuredClone(base)
  for (const write of writes) {
    if (write.value === undefined) deletePath(next, write.path)
    else setPath(next, write.path, write.value)
  }
  return next
}

/**
 * Count of keys ccset does not manage, so Status can report what it preserved.
 * Counts leaves: a nested object contributes its own leaves, not itself.
 *
 * The join separator has to be a character no key can carry; a NUL byte is the
 * one the TOML editor already uses for the same reason.
 */
export function countUnmanagedKeys(data: JsonObject, managed: string[][]): number {
  const managedKeys = new Set(managed.map((keys) => keys.join('\u0000')))
  return countLeaves(data, [], managedKeys)
}

function countLeaves(node: JsonObject, prefix: string[], managed: Set<string>): number {
  let total = 0
  for (const [key, value] of Object.entries(node)) {
    const keyPath = [...prefix, key]
    if (managed.has(keyPath.join('\u0000'))) continue
    total += isPlainObject(value) ? countLeaves(value, keyPath, managed) : 1
  }
  return total
}
