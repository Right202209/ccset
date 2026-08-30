import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { MessageTone } from '../types.js'
import { t } from '../i18n/index.js'

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

const TONE_COLORS: Record<MessageTone, string> = {
  success: 'green',
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
}

export function toneColor(tone?: MessageTone): string | undefined {
  return tone === undefined ? undefined : TONE_COLORS[tone]
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

  useInput((input, key) => {
    if (count === 0) return
    if (key.upArrow || input === 'k') setIndex((current) => (current - 1 + count) % count)
    else if (key.downArrow || input === 'j') setIndex((current) => (current + 1) % count)
    else if (key.return) selectAt(index)
    else if (/^[1-9]$/.test(input)) selectAt(Number(input) - 1)
  })

  function selectAt(target: number): void {
    const option = options[target]
    if (option === undefined) return
    setIndex(target)
    onSelect(option, target)
  }

  if (count === 0) return <Text dimColor>{t('list.empty')}</Text>

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
  const color = focused ? 'cyan' : toneColor(option.tone)
  return (
    <Box>
      <Text color={color}>{focused ? '❯ ' : '  '}</Text>
      <Text dimColor>{position < 9 ? `${position + 1}. ` : '   '}</Text>
      <Text color={color} bold={focused}>
        {option.label}
      </Text>
      {option.detail !== undefined && (
        <Box flexGrow={1} flexShrink={1}>
          <Text dimColor wrap="wrap">
            {`  ${option.detail}`}
          </Text>
        </Box>
      )}
    </Box>
  )
}
