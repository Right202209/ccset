import React, { createContext, useContext, useEffect, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import type { Viewport } from '../types.js'
import { t } from '../i18n/index.js'
import { useTerminal } from './terminal.js'

const DEFAULT_ROWS = 24
const DEFAULT_COLUMNS = 80
const WINDOW_COUNT_ROWS = 1

const ViewportContext = createContext<Viewport>({ rows: DEFAULT_ROWS, columns: DEFAULT_COLUMNS })

export function resolveViewport(output: NodeJS.WriteStream): Viewport {
  return {
    rows: output.rows && output.rows > 0 ? output.rows : DEFAULT_ROWS,
    columns: output.columns && output.columns > 0 ? output.columns : DEFAULT_COLUMNS,
  }
}

export function useTerminalViewport(explicit?: Viewport): Viewport {
  const { stdout } = useStdout()
  const [viewport, setViewport] = useState(() => explicit ?? resolveViewport(stdout))

  useEffect(() => {
    if (explicit !== undefined) {
      setViewport(explicit)
      return
    }
    const update = (): void => setViewport(resolveViewport(stdout))
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
      {fold(t('list.count', { start: window.start + 1, end: window.end, total: window.total }))}
    </Text>
  )
}

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
  const bounded = countRows > 0 || viewport.columns < 60
  return (
    <Box flexDirection="column" width={Math.max(1, viewport.columns - 2)}>
      <Box
        flexDirection="column"
        height={bounded ? Math.max(1, rows - countRows) : undefined}
        overflow="hidden"
      >
        {children}
      </Box>
      {countRows > 0 && <WindowCount window={window} />}
    </Box>
  )
}
