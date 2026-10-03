import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import type { Viewport } from '../types.js'
import { t } from '../i18n/index.js'
import { useTerminal } from './terminal.js'

const DEFAULT_ROWS = 24
const DEFAULT_COLUMNS = 80
const WINDOW_COUNT_ROWS = 1
/**
 * Erase the visible screen and home the cursor. Never the scrollback (`3J`):
 * what the core user copies out of it is what ADR 0002 keeps the output
 * flowing for.
 */
const CLEAR_VISIBLE = '\x1b[H\x1b[2J'

const ViewportContext = createContext<Viewport>({ rows: DEFAULT_ROWS, columns: DEFAULT_COLUMNS })

export function resolveViewport(output: NodeJS.WriteStream): Viewport {
  return {
    rows: output.rows && output.rows > 0 ? output.rows : DEFAULT_ROWS,
    columns: output.columns && output.columns > 0 ? output.columns : DEFAULT_COLUMNS,
  }
}

/**
 * The frame's borders run to the last column, so when the terminal narrows it
 * rewraps every painted row, and Ink's erase -- which counts the rows it wrote,
 * not the rows they became -- leaves the top of the old paint behind. A width
 * below the one last painted clears the visible screen first, so the repaint
 * lands on a blank one.
 */
export function useTerminalViewport(explicit?: Viewport): Viewport {
  const { stdout } = useStdout()
  const [viewport, setViewport] = useState(() => explicit ?? resolveViewport(stdout))
  // Read by the resize listener, so a narrowing that lands before the listener
  // subscribes is still measured against what was actually painted.
  const painted = useRef(viewport.columns)
  painted.current = viewport.columns

  useEffect(() => {
    if (explicit !== undefined) {
      setViewport(explicit)
      return
    }
    const update = (): void => {
      const next = resolveViewport(stdout)
      if (next.columns < painted.current) stdout.write(CLEAR_VISIBLE)
      setViewport(next)
    }
    update()
    stdout.on('resize', update)
    return () => {
      stdout.off('resize', update)
    }
  }, [explicit, stdout])

  return viewport
}

export function ViewportProvider({
  viewport,
  children,
}: {
  viewport: Viewport
  children: React.ReactNode
}): React.ReactElement {
  return <ViewportContext.Provider value={viewport}>{children}</ViewportContext.Provider>
}

export function useViewport(): Viewport {
  return useContext(ViewportContext)
}

export interface WindowSlice<T> {
  items: T[]
  start: number
  end: number
  total: number
}

export function windowAround<T>(items: T[], focused: number, rows: number): WindowSlice<T> {
  const total = items.length
  if (total <= rows) return { items, start: 0, end: total, total }
  const size = Math.max(1, rows - 1)
  const maxStart = Math.max(0, total - size)
  const start = Math.min(Math.max(0, focused - size + 1), maxStart)
  const end = Math.min(total, start + size)
  return { items: items.slice(start, end), start, end, total }
}

export function WindowCount({ window }: { window: WindowSlice<unknown> }): React.ReactElement | null {
  const { fold } = useTerminal()
  if (window.total <= window.items.length) return null
  return (
    <Text dimColor>
      {fold(t('list.count', {
        start: window.end === 0 ? 0 : window.start + 1,
        end: window.end,
        total: window.total,
      }))}
    </Text>
  )
}

/**
 * Every windowed row is one row tall and clips its own overflow, so a window
 * never outgrows its budget. The height is pinned only beside a count line,
 * where it equals the rows shown; pinning it otherwise left blank rows under a
 * short list on a narrow Panel.
 */
export function WindowRegion({
  window,
  rows,
  children,
}: {
  window: WindowSlice<unknown>
  rows: number
  children: React.ReactNode
}): React.ReactElement {
  const viewport = useViewport()
  const countRows = window.total > window.items.length && rows > WINDOW_COUNT_ROWS
    ? WINDOW_COUNT_ROWS
    : 0
  return (
    <Box flexDirection="column" width={Math.max(1, viewport.columns)}>
      <Box
        flexDirection="column"
        height={countRows > 0 ? Math.max(1, rows - countRows) : undefined}
        overflow="hidden"
      >
        {children}
      </Box>
      {countRows > 0 && <WindowCount window={window} />}
    </Box>
  )
}
