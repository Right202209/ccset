import React, { useMemo, useRef, useState } from 'react'
import { Box, Text, useInput, type DOMElement, type Key } from 'ink'
import stringWidth from 'string-width'
import type { MessageTone, StatusLine } from '../types.js'
import { t } from '../i18n/index.js'
import { focusGutter, rowStyle, useTerminal } from './terminal.js'
import { KEYMAPS } from './keymap.js'
import { padEnd, truncateEnd } from './text-fit.js'
import { useViewport, WindowRegion, windowAround, type WindowSlice } from './Viewport.js'
import { usePublishFocusPreview } from './useFocusPreview.js'
import { previewLine, safeDisplayValue } from './preview-safety.js'
import { useMouseInput } from './useMouseInput.js'

export interface SelectOption {
  id: string
  label: string
  detail?: string
  preview?: StatusLine[]
  tone?: MessageTone
}

interface SelectListProps {
  options: SelectOption[]
  onSelect: (option: SelectOption, index: number) => void
  /** Where the cursor starts; a destructive list points it at the safe row. */
  initialIndex?: number
  /** Row budget when something else shares the Viewport; the whole Viewport otherwise. */
  rows?: number
}

/** Columns before a row's label: the focus gutter and the "1. " shortcut. */
const ROW_LEAD = 5

const [UP_BINDING, DOWN_BINDING] = KEYMAPS.list

/** -1, 1, or 0 for a key that does not move the cursor. */
function moveDelta(input: string, key: Key): number {
  if ((UP_BINDING?.keys ?? []).includes(key.upArrow ? 'up' : input)) return -1
  if ((DOWN_BINDING?.keys ?? []).includes(key.downArrow ? 'down' : input)) return 1
  return 0
}

/**
 * The row a key selects. Digits number the visible rows (ADR 0002), so a
 * digit past the window selects nothing rather than a row the user cannot see.
 */
function selectTarget(input: string, key: Key, at: { index: number; window: WindowSlice<unknown> }): number | null {
  if (key.return) return at.index
  if (!/^[1-9]$/.test(input)) return null
  const visible = Number(input) - 1
  return visible < at.window.items.length ? at.window.start + visible : null
}

/**
 * Wide enough for every label, not only the visible ones, so scrolling never
 * shifts the detail column; capped so a long label cannot starve the details.
 */
function labelColumn(options: SelectOption[], fold: (text: string) => string, columns: number): number {
  const widest = Math.max(0, ...options.map((option) => stringWidth(fold(option.label))))
  return Math.min(widest, Math.floor(columns / 2))
}

function focusPreview(focused: SelectOption | undefined): { label: string; lines: StatusLine[] } | null {
  if (focused?.preview === undefined) return null
  return { label: safeDisplayValue(focused.label), lines: focused.preview.map(previewLine) }
}

/**
 * Hand-rolled rather than ink-select-input: the menu needs a detail column and
 * numeric shortcuts (PRD 5.4), neither of which that widget offers.
 */
export function SelectList({
  options,
  onSelect,
  initialIndex = 0,
  rows,
}: SelectListProps): React.ReactElement {
  const [index, setIndex] = useState(initialIndex)
  const rowNodes = useRef(new Map<number, DOMElement>())
  const isMouseCodePending = useMouseInput({ rowNodes, options, onSelect, setIndex })
  const count = options.length
  const viewport = useViewport()
  const { fold } = useTerminal()
  const rowBudget = Math.max(1, rows ?? viewport.rows)
  const window = windowAround(options, index, rowBudget)
  const column = labelColumn(options, fold, viewport.columns)
  const focused = options[index]
  const preview = useMemo(() => focusPreview(focused), [focused?.id, focused?.label, focused?.preview])
  usePublishFocusPreview(preview)

  useInput((input, key) => {
    if (count === 0 || isMouseCodePending()) return
    const delta = moveDelta(input, key)
    if (delta !== 0) setIndex((current) => (current + delta + count) % count)
    else selectAt(selectTarget(input, key, { index, window }))
  })

  function selectAt(target: number | null): void {
    const option = target === null ? undefined : options[target]
    if (target === null || option === undefined) return
    setIndex(target)
    onSelect(option, target)
  }

  if (count === 0) return <Text dimColor>{fold(t('list.empty'))}</Text>

  return (
    <WindowRegion window={window} rows={rowBudget}>
      {window.items.map((option, visiblePosition) => (
        <SelectRow
          key={option.id}
          option={option}
          position={visiblePosition}
          focused={window.start + visiblePosition === index}
          labelWidth={column}
          room={viewport.columns - ROW_LEAD}
          register={(element) => registerRow(rowNodes.current, window.start + visiblePosition, element)}
        />
      ))}
    </WindowRegion>
  )
}

interface SelectRowProps {
  option: SelectOption
  position: number
  focused: boolean
  labelWidth: number
  /** Columns after the gutter and the shortcut, shared by the label and the detail. */
  room: number
  register: (element: DOMElement | null) => void
}

/**
 * The selection bar spans gutter, number, and the padded label, so it is one
 * width down the list. The detail takes whatever the label leaves.
 */
function registerRow(rows: Map<number, DOMElement>, index: number, element: DOMElement | null): void {
  if (element === null) rows.delete(index)
  else rows.set(index, element)
}

function SelectRow({ option, position, focused, labelWidth, room, register }: SelectRowProps): React.ReactElement {
  const { glyphs, colors, fold } = useTerminal()
  const style = rowStyle(colors, focused, option.tone)
  const ellipsis = fold('…')
  const label = padEnd(truncateEnd(fold(option.label), room, ellipsis), labelWidth)
  const detailRoom = room - stringWidth(label)
  return (
    <Box ref={register} height={1} overflow="hidden">
      <Text {...style}>{focusGutter(glyphs, focused)}</Text>
      <Text {...(focused ? style : {})} dimColor={!focused}>
        {position < 9 ? `${position + 1}. ` : '   '}
      </Text>
      <Text {...style}>{label}</Text>
      {option.detail !== undefined && detailRoom > 0 && (
        <Text dimColor>{truncateEnd(fold(`  ${safeDisplayValue(option.detail)}`), detailRoom, ellipsis)}</Text>
      )}
    </Box>
  )
}
