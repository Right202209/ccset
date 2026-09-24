import assert from 'node:assert/strict'
import { findJsoncProblem, readJsoncObject } from '../src/core/jsonc/index.js'

export function verifyJsoncDepthLimit(): void {
  const deeplyNested = `${'{"x":'.repeat(100_000)}0${'}'.repeat(100_000)}`
  assert.notEqual(findJsoncProblem(deeplyNested), null, 'a 100,000-level JSONC document was accepted')
  assert.throws(
    () => readJsoncObject(deeplyNested),
    (error: Error) => error.message.includes('error.configNesting'),
    'a deep direct read did not fail cleanly',
  )
}
