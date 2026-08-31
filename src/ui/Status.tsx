import React from 'react'
import { Box, Text } from 'ink'
import type { ListItem, StatusScreen, StatusSection } from '../types.js'
import { t } from '../i18n/index.js'
import { SelectList, type SelectOption } from './SelectList.js'
import { toneColor, useTerminal } from './terminal.js'
import { helpFor } from './keymap.js'
import { useViewport, WindowRegion, windowAround } from './Viewport.js'

const LABEL_WIDTH = 22

interface StatusViewProps {
  screen: StatusScreen
  onSelect: (item: ListItem) => void
}

/** Read-only by construction: nothing here can write, only the items can. */
export function StatusView({ screen, onSelect }: StatusViewProps): React.ReactElement {
  const viewport = useViewport()
  const { fold } = useTerminal()
  const rows = screen.sections.flatMap(statusRows)
  const showHelp = viewport.rows >= 16 && viewport.columns >= 60
  const bodyRows = Math.max(2, viewport.rows - 5 - (showHelp ? 2 : 0))
  const actionBudget = screen.items.length > 0 ? Math.max(2, Math.ceil(bodyRows / 3)) : 0
  const actionWindow = windowAround(screen.items, 0, actionBudget)
  const renderedActionRows = actionWindow.items.length + (actionWindow.total > actionWindow.items.length ? 1 : 0)
  const statusBudget = Math.max(1, bodyRows - (screen.items.length > 0 ? renderedActionRows + 1 : 0))
  const window = windowAround(rows, 0, statusBudget)
  const options: SelectOption[] = screen.items.map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
    tone: item.tone,
  }))
  return (
    <Box flexDirection="column">
      <WindowRegion window={window} rows={statusBudget}>
        {window.items.map((row) => <StatusRowView key={row.key} row={row} />)}
      </WindowRegion>
      {screen.items.length > 0 && (
        <Box marginTop={1}>
          <SelectList
            options={options}
            rows={actionBudget}
            onSelect={(_option, index) => {
              const item = screen.items[index]
              if (item !== undefined) onSelect(item)
            }}
          />
        </Box>
      )}
      {showHelp && (
        <Box marginTop={1}>
          <Text dimColor>{fold(helpFor('status'))}</Text>
        </Box>
      )}
    </Box>
  )
}

type StatusRow =
  | { kind: 'title'; key: string; text: string }
  | {
      kind: 'line'
      key: string
      label: string
      value: string
      tone?: StatusSection['lines'][number]['tone']
    }
  | { kind: 'note'; key: string; text: string }

function statusRows(section: StatusSection): StatusRow[] {
  const rows: StatusRow[] = [{ kind: 'title', key: `title:${section.title}`, text: section.title }]
  rows.push(...section.lines.map((line) => ({
    kind: 'line' as const,
    key: `line:${section.title}:${line.label}`,
    label: line.label,
    value: line.value,
    tone: line.tone,
  })))
  if (section.note !== undefined) {
    rows.push({ kind: 'note', key: `note:${section.title}`, text: section.note })
  }
  return rows
}

function StatusRowView({ row }: { row: StatusRow }): React.ReactElement {
  const { colors, fold } = useTerminal()
  if (row.kind === 'title') {
    return (
      <Box height={1} overflow="hidden">
        <Text bold color={colors.heading}>
          {fold(row.text)}
        </Text>
      </Box>
    )
  }
  if (row.kind === 'note') {
    return (
      <Box height={1} overflow="hidden">
        <Text dimColor wrap="truncate-end">{fold(`  ${row.text}`)}</Text>
      </Box>
    )
  }
  return (
    <Box height={1} overflow="hidden">
      <Box width={LABEL_WIDTH}>
        <Text dimColor>{fold(`  ${row.label}`)}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1}>
        <Text color={toneColor(colors, row.tone)} wrap="truncate-end">
          {fold(row.value)}
        </Text>
      </Box>
    </Box>
  )
}
