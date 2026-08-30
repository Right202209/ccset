import React from 'react'
import { Box, Text } from 'ink'
import type { ListItem, StatusScreen, StatusSection } from '../types.js'
import { t } from '../i18n/index.js'
import { SelectList, toneColor, type SelectOption } from './SelectList.js'

const LABEL_WIDTH = 22

interface StatusViewProps {
  screen: StatusScreen
  onSelect: (item: ListItem) => void
}

/** Read-only by construction: nothing here can write, only the items can. */
export function StatusView({ screen, onSelect }: StatusViewProps): React.ReactElement {
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
        <Text dimColor>{t('status.help')}</Text>
      </Box>
    </Box>
  )
}

function SectionView({ section }: { section: StatusSection }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        {section.title}
      </Text>
      {section.lines.map((line) => (
        <Box key={`${section.title}:${line.label}`}>
          <Box width={LABEL_WIDTH}>
            <Text dimColor>{`  ${line.label}`}</Text>
          </Box>
          <Text color={toneColor(line.tone)}>{line.value}</Text>
        </Box>
      ))}
      {section.note !== undefined && (
        <Box paddingLeft={2}>
          <Text dimColor>{section.note}</Text>
        </Box>
      )}
    </Box>
  )
}
