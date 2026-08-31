import React from 'react'
import { Box, Text } from 'ink'
import type { ListItem, StatusScreen, StatusSection } from '../types.js'
import { t } from '../i18n/index.js'
import { SelectList, type SelectOption } from './SelectList.js'
import { toneColor, useTerminal } from './terminal.js'

const LABEL_WIDTH = 22

interface StatusViewProps {
  screen: StatusScreen
  onSelect: (item: ListItem) => void
}

/** Read-only by construction: nothing here can write, only the items can. */
export function StatusView({ screen, onSelect }: StatusViewProps): React.ReactElement {
  const { fold } = useTerminal()
  const options: SelectOption[] = screen.items.map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
    tone: item.tone,
  }))
  return (
    <Box flexDirection="column">
      {screen.sections.map((section) => (
        <SectionView key={section.title} section={section} />
      ))}
      {screen.items.length > 0 && (
        <Box marginTop={1}>
          <SelectList
            options={options}
            onSelect={(_option, index) => {
              const item = screen.items[index]
              if (item !== undefined) onSelect(item)
            }}
          />
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>{fold(t('status.help'))}</Text>
      </Box>
    </Box>
  )
}

function SectionView({ section }: { section: StatusSection }): React.ReactElement {
  const { colors, fold } = useTerminal()
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={colors.heading}>
        {fold(section.title)}
      </Text>
      {section.lines.map((line) => (
        <Box key={`${section.title}:${line.label}`}>
          <Box width={LABEL_WIDTH}>
            <Text dimColor>{fold(`  ${line.label}`)}</Text>
          </Box>
          <Box flexGrow={1} flexShrink={1}>
            <Text color={toneColor(colors, line.tone)} wrap="wrap">
              {fold(line.value)}
            </Text>
          </Box>
        </Box>
      ))}
      {section.note !== undefined && (
        <Box paddingLeft={2}>
          <Text dimColor>{fold(section.note)}</Text>
        </Box>
      )}
    </Box>
  )
}
