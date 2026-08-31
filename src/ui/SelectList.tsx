import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { MessageTone } from '../types.js'
import { t } from '../i18n/index.js'
import { focusGutter, toneColor, useTerminal } from './terminal.js'
import { KEYMAPS } from './keymap.js'

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
}

/**
 * Hand-rolled rather than ink-select-input: the menu needs a detail column and
 * numeric shortcuts (PRD 5.4), neither of which that widget offers.
 */
export function SelectList({
  options,
  onSelect,
  initialIndex = 0,
}: SelectListProps): React.ReactElement {
  const [index, setIndex] = useState(initialIndex)
  const count = options.length
  const { fold } = useTerminal()

  useInput((input, key) => {
    if (count === 0) return
    const up = key.upArrow ? 'up' : input
    const down = key.downArrow ? 'down' : input
    if (KEYMAPS.list[0].keys.includes(up)) setIndex((current) => (current - 1 + count) % count)
    else if (KEYMAPS.list[1].keys.includes(down)) setIndex((current) => (current + 1) % count)
    else if (key.return) selectAt(index)
    else if (/^[1-9]$/.test(input)) selectAt(Number(input) - 1)
  })

  function selectAt(target: number): void {
    const option = options[target]
    if (option === undefined) return
    setIndex(target)
    onSelect(option, target)
  }

  if (count === 0) return <Text dimColor>{fold(t('list.empty'))}</Text>

  return (
    <Box flexDirection="column">
      {options.map((option, position) => (
        <SelectRow
          key={option.id}
          option={option}
          position={position}
          focused={position === index}
        />
      ))}
    </Box>
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
    <Box>
      <Text color={color}>{focusGutter(glyphs, focused)}</Text>
      <Text dimColor>{position < 9 ? `${position + 1}. ` : '   '}</Text>
      <Text color={color} bold={focused}>
        {fold(option.label)}
      </Text>
      {option.detail !== undefined && (
        <Box flexGrow={1} flexShrink={1}>
          <Text dimColor wrap="wrap">
            {fold(`  ${option.detail}`)}
          </Text>
        </Box>
      )}
    </Box>
  )
}
