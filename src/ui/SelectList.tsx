import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { MessageTone } from '../types.js'
import { t } from '../i18n/index.js'
import { focusGutter, toneColor, useTerminal } from './terminal.js'
import { KEYMAPS } from './keymap.js'
import { useViewport, WindowRegion, windowAround } from './Viewport.js'

export interface SelectOption {
  id: string
  label: string
  detail?: string
  tone?: MessageTone
}

interface SelectListProps {
  options: SelectOption[]
  onSelect: (option: SelectOption, index: number) => void
  /** Where the cursor starts; a destructive list points it at the safe row. */
  initialIndex?: number
  /** Row budget when another windowed region shares the same Screen. */
  rows?: number
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
  const count = options.length
  const viewport = useViewport()
  const { fold } = useTerminal()
  const rowBudget = rows ?? Math.max(2, viewport.rows - (viewport.columns < 60 ? 10 : 7))
  const window = windowAround(options, index, rowBudget)

  useInput((input, key) => {
    if (count === 0) return
    const [upBinding, downBinding] = KEYMAPS.list
    if (upBinding === undefined || downBinding === undefined) return
    const up = key.upArrow ? 'up' : input
    const down = key.downArrow ? 'down' : input
    if (upBinding.keys.includes(up)) setIndex((current) => (current - 1 + count) % count)
    else if (downBinding.keys.includes(down)) setIndex((current) => (current + 1) % count)
    else if (key.return) selectAt(index)
    else if (/^[1-9]$/.test(input)) {
      const visibleIndex = Number(input) - 1
      if (visibleIndex < window.items.length) selectAt(window.start + visibleIndex)
    }
  })

  function selectAt(target: number): void {
    const option = options[target]
    if (option === undefined) return
    setIndex(target)
    onSelect(option, target)
  }

  if (count === 0) return <Text dimColor>{fold(t('list.empty'))}</Text>

  return (
    <WindowRegion window={window} rows={rowBudget}>
      {window.items.map((option, visiblePosition) => {
        const position = window.start + visiblePosition
        return (
          <SelectRow
            key={option.id}
            option={option}
            position={visiblePosition}
            focused={position === index}
          />
        )
      })}
    </WindowRegion>
  )
}

interface SelectRowProps {
  option: SelectOption
  position: number
  focused: boolean
}

function SelectRow({ option, position, focused }: SelectRowProps): React.ReactElement {
  const { glyphs, colors, fold } = useTerminal()
  const color = focused ? colors.focus : toneColor(colors, option.tone)
  return (
    <Box height={1} overflow="hidden">
      <Text color={color}>{focusGutter(glyphs, focused)}</Text>
      <Text dimColor>{position < 9 ? `${position + 1}. ` : '   '}</Text>
      <Text color={color} bold={focused}>
        {fold(option.label)}
      </Text>
      {option.detail !== undefined && (
        <Box flexGrow={1} flexShrink={1}>
          <Text dimColor wrap="truncate-end">
            {fold(`  ${option.detail}`)}
          </Text>
        </Box>
      )}
    </Box>
  )
}
