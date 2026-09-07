import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import wrapAnsi from 'wrap-ansi'
import type { ListItem, StatusScreen, StatusSection } from '../types.js'
import { t } from '../i18n/index.js'
import { SelectList, type SelectOption } from './SelectList.js'
import { toneColor, useTerminal } from './terminal.js'
import { helpFor } from './keymap.js'
import { useViewport, WindowCount, WindowRegion, windowAround } from './Viewport.js'

const LABEL_WIDTH = 22

interface StatusViewProps {
  screen: StatusScreen
  onSelect: (item: ListItem) => void
}

/**
 * Read-only by construction: nothing here can write, only the items can.
 *
 * When the rows outrun the budget the data window scrolls: with the window
 * pinned at zero, later sections never rendered at all -- diagnostics like the
 * `.jsonc` warning simply did not exist for a short terminal, and terminal
 * scrollback cannot recover paint that a full-screen app redraws. The pinned
 * action list keeps its own cursor; with the one action a Status carries,
 * sharing ↑↓ with the scroll costs nothing.
 */
export function StatusView({ screen, onSelect }: StatusViewProps): React.ReactElement {
  const viewport = useViewport()
  const { fold } = useTerminal()
  const [offset, setOffset] = useState(0)
  const contentWidth = Math.max(1, viewport.columns - 2)
  const rows = screen.sections.flatMap((section) => statusRows(section, contentWidth, fold))
  const showHelp = viewport.rows >= 16 && viewport.columns >= 60
  const bodyRows = viewport.rows < 7
    ? Math.max(1, viewport.rows)
    : Math.max(2, viewport.rows - 5 - (showHelp ? 2 : 0))
  const desiredActionRows = screen.items.length > 1 ? 2 : 1
  const reservedStatusRows = bodyRows > 1 ? 1 : 0
  const actionBudget = screen.items.length > 0
    ? Math.min(desiredActionRows, Math.max(1, bodyRows - reservedStatusRows))
    : 0
  const actionWindow = windowAround(screen.items, 0, actionBudget)
  const actionCountRows = actionWindow.total > actionWindow.items.length && actionBudget > 1 ? 1 : 0
  const renderedActionRows = actionWindow.items.length + actionCountRows
  const actionMargin = screen.items.length > 0 && bodyRows > renderedActionRows + 1 ? 1 : 0
  const statusBudget = Math.max(0, bodyRows - renderedActionRows - actionMargin)
  // Same sizing rule windowAround applies: an overflowing window keeps one row
  // of the budget for the count line, so the region never overflows.
  const size = rows.length <= statusBudget ? statusBudget : Math.max(1, statusBudget - 1)
  const maxStart = Math.max(0, rows.length - size)
  const start = Math.min(offset, maxStart)
  const window = statusBudget > 0
    ? {
        items: rows.slice(start, start + size),
        start,
        end: Math.min(rows.length, start + size),
        total: rows.length,
      }
    : { items: [], start: 0, end: 0, total: rows.length }

  useInput((input, key) => {
    if (statusBudget === 0 || maxStart === 0) return
    if (key.upArrow || input === 'k') setOffset(Math.max(0, start - 1))
    else if (key.downArrow || input === 'j') setOffset(Math.min(maxStart, start + 1))
  })

  const countOnlyWindow = { items: [], start: 0, end: 0, total: window.total }
  const options: SelectOption[] = screen.items.map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
    tone: item.tone,
  }))
  return (
    <Box flexDirection="column">
      {statusBudget === 0 ? null : statusBudget === 1 && window.total > window.items.length ? (
        <WindowCount window={countOnlyWindow} />
      ) : (
        <WindowRegion window={window} rows={statusBudget}>
          {window.items.map((row) => <StatusRowView key={row.key} row={row} />)}
        </WindowRegion>
      )}
      {screen.items.length > 0 && (
        <Box marginTop={actionMargin}>
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

function statusRows(
  section: StatusSection,
  width: number,
  fold: (text: string) => string,
): StatusRow[] {
  const rows: StatusRow[] = wrapLines(fold(section.title), width).map((text, index) => ({
    kind: 'title',
    key: `title:${section.title}:${index}`,
    text,
  }))
  const valueWidth = Math.max(1, width - LABEL_WIDTH)
  for (const line of section.lines) {
    rows.push(...wrapLines(fold(line.value), valueWidth).map((value, index) => ({
      kind: 'line' as const,
      key: `line:${section.title}:${line.label}:${index}`,
      label: index === 0 ? fold(line.label) : '',
      value,
      tone: line.tone,
    })))
  }
  if (section.note !== undefined) {
    rows.push(...wrapLines(fold(section.note), Math.max(1, width - 2)).map((text, index) => ({
      kind: 'note' as const,
      key: `note:${section.title}:${index}`,
      text,
    })))
  }
  return rows
}

function wrapLines(text: string, width: number): string[] {
  return wrapAnsi(text, width, { hard: true, trim: false, wordWrap: true }).split('\n')
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
      <Box height={1} overflow="hidden" paddingLeft={2}>
        <Text dimColor wrap="wrap">{fold(row.text)}</Text>
      </Box>
    )
  }
  return (
    <Box height={1} overflow="hidden">
      <Box width={LABEL_WIDTH}>
        <Text dimColor wrap="truncate-end">{fold(`  ${row.label}`)}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1}>
        <Text color={toneColor(colors, row.tone)} wrap="wrap">
          {fold(row.value)}
        </Text>
      </Box>
    </Box>
  )
}
