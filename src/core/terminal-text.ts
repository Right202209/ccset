const TERMINAL_CONTROLS = /[\u0000-\u001f\u007f-\u009f]/g

export function sanitizeForTerminal(text: string): string {
  return text.replace(TERMINAL_CONTROLS, (character) => {
    const code = character.charCodeAt(0)
    const hex = code.toString(16).padStart(code < 0x20 ? 2 : 4, '0')
    return code < 0x20 ? `\\x${hex}` : `\\u${hex}`
  })
}

export function escapeJsonControlCharacters(serialized: string): string {
  return serialized.replace(/[\u007f-\u009f]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}
