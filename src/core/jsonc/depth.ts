export const MAX_JSONC_DEPTH = 64

interface DepthToken {
  index: number
  change: 1 | -1
}

function skipString(text: string, start: number): number {
  for (let index = start + 1; index < text.length; index += 1) {
    if (text.charAt(index) === '\\') index += 1
    else if (text.charAt(index) === '"') return index + 1
  }
  return text.length
}

function skipComment(text: string, start: number): number {
  if (text.charAt(start + 1) === '/') {
    let index = start + 2
    while (index < text.length && text.charAt(index) !== '\n' && text.charAt(index) !== '\r') index += 1
    return index
  }
  const end = text.indexOf('*/', start + 2)
  return end === -1 ? text.length : end + 2
}

function nextDepthToken(text: string, start: number): DepthToken | null {
  for (let index = start; index < text.length; index += 1) {
    const char = text.charAt(index)
    if (char === '"') {
      index = skipString(text, index) - 1
      continue
    }
    if (char === '/' && (text.charAt(index + 1) === '/' || text.charAt(index + 1) === '*')) {
      index = skipComment(text, index) - 1
      continue
    }
    if (char === '{' || char === '[') return { index, change: 1 }
    if (char === '}' || char === ']') return { index, change: -1 }
  }
  return null
}

export function excessiveJsoncDepth(text: string): number | null {
  let depth = 0
  let index = 0
  while (index < text.length) {
    const token = nextDepthToken(text, index)
    if (token === null) return null
    depth = token.change === 1 ? depth + 1 : Math.max(0, depth - 1)
    if (depth > MAX_JSONC_DEPTH) return token.index
    index = token.index + 1
  }
  return null
}
