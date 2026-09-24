import { parseTree, type Node } from 'jsonc-parser'
import type { JsonObject, JsonValue } from '../../types.js'
import { isPrototypeKey } from '../merge.js'
import { excessiveJsoncDepth } from './depth.js'
import { CcsetError, EXIT_RUNTIME } from '../errors.js'

function objectValue(node: Node): JsonObject {
  const result: JsonObject = {}
  for (const property of node.children ?? []) {
    const [keyNode, valueNode] = property.children ?? []
    if (property.type !== 'property' || typeof keyNode?.value !== 'string' || valueNode === undefined) continue
    if (isPrototypeKey(keyNode.value)) continue
    result[keyNode.value] = valueOf(valueNode)
  }
  return result
}

function primitiveValue(node: Node): JsonValue {
  if (node.type === 'null') return null
  if (node.type === 'string' && typeof node.value === 'string') return node.value
  if (node.type === 'number' && typeof node.value === 'number') return node.value
  return node.value === true
}

function valueOf(node: Node): JsonValue {
  if (node.type === 'object') return objectValue(node)
  if (node.type === 'array') return (node.children ?? []).map(valueOf)
  return primitiveValue(node)
}

/**
 * Reads a JSONC document into the same JsonObject every other codec hands
 * back. It uses the parse tree rather than jsonc-parser's object constructor:
 * dangerous names are discarded and duplicate keys remain last-wins.
 */
export function readJsoncObject(text: string): JsonObject {
  if (excessiveJsoncDepth(text) !== null) throw new CcsetError('error.configNesting', EXIT_RUNTIME)
  const root = parseTree(text, [], { allowTrailingComma: true })
  if (root?.type !== 'object') return {}
  return valueOf(root) as JsonObject
}
