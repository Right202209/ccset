import assert from 'node:assert/strict'
import { applyJsoncWrites, readJsoncObject } from '../src/core/jsonc/index.js'
import { CcsetError } from '../src/core/errors.js'
import { getPath, type ManagedWrite } from '../src/core/merge.js'
import type { JsonObject } from '../src/types.js'

const PLANTED = `{
  "provider": {
    "__proto__": { "options": { "apiKey": "planted" } },
    "constructor": { "options": { "apiKey": "kept-constructor" } },
    "prototype": { "options": { "apiKey": "kept-prototype" } }
  }
}`

/**
 * M-3: only `__proto__` is the prototype slot. `constructor` and `prototype`
 * are ordinary own keys -- assigning one shadows the inherited value rather
 * than reaching Object.prototype -- so the reader keeps them and the writer can
 * edit them, while `__proto__` stays inert.
 */
export function verifyJsoncPrototypeHandling(): void {
  const parsed = readJsoncObject(PLANTED)
  assert.equal(({} as JsonObject)['apiKey'], undefined, 'JSONC parsing changed Object.prototype')
  assert.equal(getPath(parsed, ['provider', '__proto__', 'options', 'apiKey']), undefined)
  assert.equal(Object.prototype.hasOwnProperty.call(parsed['provider'], '__proto__'), false)
  for (const key of ['constructor', 'prototype']) {
    const sibling = key === 'constructor' ? 'prototype' : 'constructor'
    assert.equal(getPath(parsed, ['provider', key, 'options', 'apiKey']), `kept-${key}`)
    const writes: ManagedWrite[] = [{ path: ['provider', key, 'options', 'apiKey'], value: 'edited' }]
    const edited = readJsoncObject(applyJsoncWrites(PLANTED, writes))
    assert.equal(getPath(edited, ['provider', key, 'options', 'apiKey']), 'edited')
    assert.equal(getPath(edited, ['provider', sibling, 'options', 'apiKey']), `kept-${sibling}`)
  }
  const blocked: ManagedWrite[] = [{ path: ['provider', '__proto__', 'options', 'apiKey'], value: 'planted' }]
  assert.throws(
    () => applyJsoncWrites('{}', blocked),
    (error: Error) => error instanceof CcsetError && error.messageKey === 'error.prototypeKey',
  )
}
