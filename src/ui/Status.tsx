import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import stringWidth from 'string-width'
import wrapAnsi from 'wrap-ansi'
import type { ListItem, StatusScreen, StatusSection } from '../types.js'
import { SelectList, type SelectOption } from './SelectList.js'
import { toneColor, useTerminal } from './terminal.js'
import { truncateEnd } from './text-fit.js'
import { useViewport, WindowCount, WindowRegion, windowAround, type WindowSlice } from './Viewport.js'
import { sanitizeForTerminal } from '../core/terminal-text.js'

/** Labels indent under their section title and always keep a blank before the value. */
const LABEL_INDENT = 2
const LABEL_GAP = 1
/**
 * The most of the Panel's width the label column may take: values are often
 * paths the core user copies, so they keep the larger share.
 */
const LABEL_SHARE = 1 / 3

interface StatusViewProps {
  screen: StatusScreen
  onSelect: (item: ListItem) => void
}

/**
 * As wide as the widest label on the Screen, so short labels leave the values
 * room and a long one is cut only when the Panel is too narrow for it.
 */
function labelColumn(sections: StatusSection[], width: number, fold: (text: string) => string): number {
  const labels = sections.flatMap((section) => section.lines.map((line) => fold(sanitizeForTerminal(line.label))))
  const widest = Math.max(0, ...labels.map((label) => stringWidth(label)))
  const chrome = LABEL_INDENT + LABEL_GAP
  return Math.max(chrome + 1, Math.min(widest + chrome, Math.floor(width * LABEL_SHARE)))
}

interface StatusPlan {
  actionBudget: number
  actionMargin: number
  statusBudget: number
  window: WindowSlice<StatusRow>
  maxStart: number
}

/**
 * The Viewport's rows split between the windowed status rows and the pinned
 * action list below them. Actions are never the part that gives way: a hidden
 * action is worse than a hidden status line (ADR 0002).
 */
function planStatus(
  rows: StatusRow[],
  items: ListItem[],
  { bodyRows, offset }: { bodyRows: number; offset: number },
): StatusPlan {
  const desiredActionRows = items.length > 1 ? 2 : 1
  const reservedStatusRows = bodyRows > 1 ? 1 : 0
  const actionBudget = items.length > 0
    ? Math.min(desiredActionRows, Math.max(1, bodyRows - reservedStatusRows))
    : 0
  const actionWindow = windowAround(items, 0, actionBudget)
  const actionCountRows = actionWindow.total > actionWindow.items.length && actionBudget > 1 ? 1 : 0
  const renderedActionRows = actionWindow.items.length + actionCountRows
  const actionMargin = items.length > 0 && bodyRows > renderedActionRows + 1 ? 1 : 0
  const statusBudget = Math.max(0, bodyRows - renderedActionRows - actionMargin)
  // Same sizing rule windowAround applies: an overflowing window keeps one row
  // of the budget for the count line, so the region never overflows.
  const size = rows.length <= statusBudget ? statusBudget : Math.max(1, statusBudget - 1)
  const maxStart = Math.max(0, rows.length - size)
  const start = Math.min(offset, maxStart)
  const end = Math.min(rows.length, start + size)
  const window = statusBudget > 0
    ? { items: rows.slice(start, end), start, end, total: rows.length }
    : { items: [], start: 0, end: 0, total: rows.length }
  return { actionBudget, actionMargin, statusBudget, window, maxStart }
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
  const labelWidth = labelColumn(screen.sections, viewport.columns, fold)
  const layout = { width: viewport.columns, labelWidth, fold }
  const rows = screen.sections.flatMap((section) => statusRows(section, layout))
  const plan = planStatus(rows, screen.items, { bodyRows: Math.max(1, viewport.rows), offset })
  const { start } = plan.window

  useInput((input, key) => {
    if (plan.statusBudget === 0 || plan.maxStart === 0) return
    if (key.upArrow || input === 'k') setOffset(Math.max(0, start - 1))
    else if (key.downArrow || input === 'j') setOffset(Math.min(plan.maxStart, start + 1))
  })

  const options: SelectOption[] = screen.items.map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
    tone: item.tone,
  }))
  return (
    <Box flexDirection="column">
      <StatusRegion plan={plan} labelWidth={labelWidth} />
      {screen.items.length > 0 && (
        <Box marginTop={plan.actionMargin}>
          <SelectList
            options={options}
            rows={plan.actionBudget}
            onSelect={(_option, index) => {
              const item = screen.items[index]
              if (item !== undefined) onSelect(item)
            }}
          />
        </Box>
      )}
    </Box>
  )
}

function StatusRegion({ plan, labelWidth }: { plan: StatusPlan; labelWidth: number }): React.ReactElement | null {
  const { statusBudget, window } = plan
  if (statusBudget === 0) return null
  if (statusBudget === 1 && window.total > window.items.length) {
    return <WindowCount window={{ items: [], start: 0, end: 0, total: window.total }} />
  }
  return (
    <WindowRegion window={window} rows={statusBudget}>
      {window.items.map((row) => <StatusRowView key={row.key} row={row} labelWidth={labelWidth} />)}
    </WindowRegion>
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

interface RowLayout {
  width: number
  labelWidth: number
  fold: (text: string) => string
}

function statusRows(section: StatusSection, { width, labelWidth, fold }: RowLayout): StatusRow[] {
  const rows: StatusRow[] = wrapLines(fold(sanitizeForTerminal(section.title)), width).map((text, index) => ({
    kind: 'title',
    key: `title:${section.title}:${index}`,
    text,
  }))
  const valueWidth = Math.max(1, width - labelWidth)
  for (const line of section.lines) {
    rows.push(...wrapLines(fold(sanitizeForTerminal(line.value)), valueWidth).map((value, index) => ({
      kind: 'line' as const,
      key: `line:${section.title}:${line.label}:${index}`,
      label: index === 0 ? fold(sanitizeForTerminal(line.label)) : '',
      value,
      tone: line.tone,
    })))
  }
  if (section.note !== undefined) {
    rows.push(...wrapLines(fold(sanitizeForTerminal(section.note)), Math.max(1, width - 2)).map((text, index) => ({
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

function StatusRowView({ row, labelWidth }: { row: StatusRow; labelWidth: number }): React.ReactElement {
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
      <Box height={1} overflow="hidden" paddingLeft={LABEL_INDENT}>
        <Text dimColor wrap="wrap">{fold(row.text)}</Text>
      </Box>
    )
  }
  const label = `${' '.repeat(LABEL_INDENT)}${row.label}`
  return (
    <Box height={1} overflow="hidden">
      <Box width={labelWidth} flexShrink={0}>
        <Text dimColor>{truncateEnd(label, labelWidth - LABEL_GAP, fold('…'))}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1}>
        <Text color={toneColor(colors, row.tone)} wrap="wrap">
          {fold(row.value)}
        </Text>
      </Box>
    </Box>
  )
}
