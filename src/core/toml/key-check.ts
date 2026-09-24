import { describePosition } from '../position.js'
import { SHORT_ESCAPES } from './strings.js'

function escapeWidth(marker: string): number {
  if (marker === 'u') return 4
  if (marker === 'U') return 8
  return 0
}

function escapeEnd(text: string, index: number, end: number): number | null {
  const width = escapeWidth(text.charAt(index + 1))
  const digits = text.slice(index + 2, index + 2 + width)
  if (width === 0 || digits.length !== width || !/^[0-9A-Fa-f]+$/.test(digits)) return null
  const point = Number.parseInt(digits, 16)
  if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return null
  return index + width + 2 <= end ? index + width + 2 : null
}

function invalidKeyControl(char: string): boolean {
  return char === '\n' || char === '\r' || char.charCodeAt(0) < 0x20
}

function nextKeyIndex(text: string, index: number, end: number, quote: string): number | null {
  if (quote !== '"' || text.charAt(index) !== '\\') return index + 1
  const marker = text.charAt(index + 1)
  if (SHORT_ESCAPES[marker] !== undefined) return index + 2
  return escapeEnd(text, index, end)
}

function quotedKeyEnd(text: string, start: number, end: number, quote: string): number | null {
  let index = start + 1
  while (index < end && text.charAt(index) !== quote) {
    if (invalidKeyControl(text.charAt(index))) return null
    const next = nextKeyIndex(text, index, end, quote)
    if (next === null) return null
    index = next
  }
  return index < end && text.charAt(index) === quote ? index + 1 : null
}

export function checkTomlKeyEscapes(text: string, start: number, end: number): string | null {
  for (let index = start; index < end;) {
    const quote = text.charAt(index)
    if (quote !== '"' && quote !== "'") {
      index += 1
      continue
    }
    const next = quotedKeyEnd(text, index, end, quote)
    if (next === null) return describePosition(text, index)
    index = next
  }
  return null
}
