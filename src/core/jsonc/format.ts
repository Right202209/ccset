import type { JsonValue } from '../../types.js'
import { isPlainObject } from '../json-file.js'

/**
 * Renders a value ccset writes into a JSONC document. The rendering is a pure
 * function of the value, its indent and the line break: a save that replaces a
 * value ccset wrote before must produce the same bytes again, or a second save
 * would churn the file (D8). Both replacements and insertions go through this
 * one renderer, and an empty object or array stays inline.
 */

export const INDENT_UNIT = '  '

interface Member {
  label: string | null
  value: JsonValue
}

function membersOf(value: JsonValue): Member[] {
  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, member]) => ({ label: JSON.stringify(key), value: member }))
  }
  if (Array.isArray(value)) return value.map((item) => ({ label: null, value: item }))
  return []
}

export function renderJsoncValue(value: JsonValue, indent: string, eol: string): string {
  const members = membersOf(value)
  if (members.length === 0) {
    if (isPlainObject(value)) return '{}'
    if (Array.isArray(value)) return '[]'
    return JSON.stringify(value)
  }
  const inner = indent + INDENT_UNIT
  const [open, close] = isPlainObject(value) ? ['{', '}'] : ['[', ']']
  const lines = members.map((member) => {
    const label = member.label === null ? '' : `${member.label}: `
    return `${inner}${label}${renderJsoncValue(member.value, inner, eol)}`
  })
  return `${open}${eol}${lines.join(`,${eol}`)}${eol}${indent}${close}`
}
