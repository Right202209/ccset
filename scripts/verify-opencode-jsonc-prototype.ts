import assert from 'node:assert/strict'
import { applyJsoncWrites, readJsoncObject } from '../src/core/jsonc/index.js'
import { CcsetError } from '../src/core/errors.js'
import { getPath, type ManagedWrite } from '../src/core/merge.js'
import type { JsonObject } from '../src/types.js'

export function verifyJsoncPrototypeHandling(): void {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype']
  const planted = JSON.stringify({
    provider: Object.fromEntries(
      dangerousKeys.map((key) => [key, { options: { apiKey: 'planted' } }]),
    ),
  })
  const parsed = readJsoncObject(planted)
  assert.equal(({} as JsonObject)['apiKey'], undefined, 'JSONC parsing changed Object.prototype')
  for (const key of dangerousKeys) {
    assert.equal(getPath(parsed, ['provider', key, 'options', 'apiKey']), undefined)
    assert.equal(Object.prototype.hasOwnProperty.call(parsed['provider'], key), false)
    const writes: ManagedWrite[] = [{ path: ['provider', key, 'options', 'apiKey'], value: 'planted' }]
    assert.throws(
      () => applyJsoncWrites('{}', writes),
      (error: Error) => error instanceof CcsetError && error.messageKey === 'error.prototypeKey',
    )
  }
}
