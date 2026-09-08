import React, { useEffect, useState } from 'react'
import { Text, useInput } from 'ink'
import stringWidth from 'string-width'
import { t } from '../i18n/index.js'
import { useTerminal } from './terminal.js'

/**
 * The single-line editor every textual field shares. Owning it (rather than
 * borrowing ink-text-input) is what makes two guarantees possible:
 *
 * - Control combinations are shortcuts, never text. Ctrl+S belongs to the
 *   form's save; the `s` it carries must not land in the focused field, where
 *   it would survive a blocked validation and be persisted by a later save.
 * - The cursor is always on screen. A long base URL scrolls instead of
 *   wrapping under a one-line row's clip, so the cursor and the edits past the
 *   edge stay visible.
 */

interface TextFieldProps {
  value: string
  onChange: (next: string) => void
  focus: boolean
  mask?: string
  /** Columns available for the editable value, computed by the field row. */
  width: number
}

/** The display window around the cursor: content fills left first, then right. */
function windowBounds(chars: string[], cursor: number, width: number): [number, number] {
  let start = cursor
  let used = 1
  while (start > 0) {
    const glyph = chars[start - 1] ?? ''
    if (used + stringWidth(glyph) > width) break
    used += stringWidth(glyph)
    start -= 1
  }
  let end = cursor + 1
  while (end < chars.length) {
    const glyph = chars[end] ?? ''
    if (used + stringWidth(glyph) > width) break
    used += stringWidth(glyph)
    end += 1
  }
  return [start, end]
}

export function TextField({
  value,
  onChange,
  focus,
  mask,
  width,
}: TextFieldProps): React.ReactElement {
  const { fold } = useTerminal()
  // The cursor counts code points, so a character split across surrogate pairs
  // moves and renders as one.
  const [cursor, setCursor] = useState(() => Array.from(value).length)
  useEffect(() => {
    setCursor((current) => Math.min(current, Array.from(value).length))
  }, [value])

  useInput((input, key) => {
    if (!focus) return
    if (key.upArrow || key.downArrow || key.return || key.tab || key.escape) return
    if (key.shift && key.tab) return
    // A control combination is a shortcut aimed at someone else's handler.
    if (key.ctrl || key.meta) return
    const chars = Array.from(value)
    if (key.leftArrow) {
      setCursor((current) => Math.max(0, current - 1))
      return
    }
    if (key.rightArrow) {
      setCursor((current) => Math.min(chars.length, current + 1))
      return
    }
    if (key.backspace || key.delete) {
      if (cursor > 0) {
        chars.splice(cursor - 1, 1)
        onChange(chars.join(''))
        setCursor(cursor - 1)
      }
      return
    }
    if (input.length === 0) return
    const inserted = Array.from(input)
    chars.splice(cursor, 0, ...inserted)
    onChange(chars.join(''))
    setCursor(cursor + inserted.length)
  }, { isActive: focus })

  const source = Array.from(value)
  const shown = mask === undefined ? source : source.map(() => mask)
  if (shown.length === 0) {
    const placeholder = fold(t('hint.empty'))
    const first = placeholder.charAt(0)
    return (
      <Text>
        {placeholder.length > 0 && <Text inverse>{first}</Text>}
        {placeholder.slice(1)}
      </Text>
    )
  }
  const at = Math.min(cursor, shown.length)
  const [start, end] = windowBounds(shown, at, Math.max(1, width))
  const before = shown.slice(start, at).join('')
  const atCursor = shown[at] ?? ' '
  const after = shown.slice(at + 1, end).join('')
  return (
    <Text>
      {before}
      <Text inverse>{atCursor}</Text>
      {after}
    </Text>
  )
}
