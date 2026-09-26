import React from 'react'
import { Box, Text } from 'ink'
import stringWidth from 'string-width'
import wrapAnsi from 'wrap-ansi'
import type { Viewport } from '../types.js'
import { LABEL_CHROME, Panel, type LabelSegment } from './Panel.js'
import { useTerminal } from './terminal.js'
import { truncateStart } from './text-fit.js'
import { ViewportProvider } from './Viewport.js'

/** Below either minimum the chrome would cost the Screen too much; the View paints alone. */
export const FRAME_MIN_ROWS = 7
export const FRAME_MIN_COLUMNS = 30
/** Side Panels appear only where the main Panel keeps a comfortable width and height. */
export const SIDEBAR_MIN_COLUMNS = 100
export const SIDEBAR_MIN_ROWS = 16
export const SIDEBAR_WIDTH = 26
const SIDEBAR_GAP = 1
/** The top and bottom borders of the frame and of the main Panel. */
const CHROME_ROWS = 4
const FRAME_SIDES = 2
/** The main Panel's two sides and its padding. */
const PANEL_CHROME_COLUMNS = 4
/** Help too long for the bottom border wraps inside the frame, when the rows can be spared. */
const HELP_LINES_MIN_ROWS = 16
const HELP_PADDING = 1

export interface LayoutPlan {
  framed: boolean
  sidebar: boolean
  /** The main Panel's outer width. */
  paneWidth: number
  helpInBorder: boolean
  helpLines: string[]
  /** What the View is handed: the main Panel's interior, or the whole terminal unframed. */
  body: Viewport
}

/**
 * Every row and column the chrome costs, decided once. Views receive the
 * remainder as their Viewport, so none of them subtracts the frame itself.
 * `side` says whether there are side Panels to place at all.
 */
export function planLayout(viewport: Viewport, help: string, side: boolean): LayoutPlan {
  const { rows, columns } = viewport
  if (rows < FRAME_MIN_ROWS || columns < FRAME_MIN_COLUMNS) {
    return { framed: false, sidebar: false, paneWidth: columns, helpInBorder: false, helpLines: [], body: viewport }
  }
  const helpInBorder = stringWidth(help) + LABEL_CHROME <= columns
  const helpLines = helpInBorder || rows < HELP_LINES_MIN_ROWS ? [] : wrapHelp(help, columns)
  const sidebar = side && columns >= SIDEBAR_MIN_COLUMNS && rows >= SIDEBAR_MIN_ROWS
  const paneWidth = columns - FRAME_SIDES - (sidebar ? SIDEBAR_WIDTH + SIDEBAR_GAP : 0)
  return {
    framed: true,
    sidebar,
    paneWidth,
    helpInBorder,
    helpLines,
    body: {
      rows: Math.max(1, rows - CHROME_ROWS - helpLines.length),
      columns: Math.max(1, paneWidth - PANEL_CHROME_COLUMNS),
    },
  }
}

function wrapHelp(help: string, columns: number): string[] {
  if (help.length === 0) return []
  const width = Math.max(1, columns - FRAME_SIDES - 2 * HELP_PADDING)
  return wrapAnsi(help, width, { hard: true, trim: true }).split('\n')
}

/** How a navigation path is spelled on the Terminal in front of the core user. */
export interface PathMarks {
  separator: string
  ellipsis: string
}

/**
 * The navigation path as the main Panel's title. A trail too long for the
 * border keeps its last two Frames behind an ellipsis -- where the core user
 * is and where Esc returns to -- and only then loses characters from the front.
 */
export function pathTitle(segments: string[], capacity: number, { separator, ellipsis }: PathMarks): string {
  const whole = segments.join(separator)
  if (stringWidth(whole) <= capacity || segments.length <= 2) {
    return truncateStart(whole, capacity, ellipsis)
  }
  return truncateStart([ellipsis, ...segments.slice(-2)].join(separator), capacity, ellipsis)
}

/** The application's name, with its tagline beside it when both fit the border. */
function frameTitle({ name, tagline }: { name: string; tagline: string }, columns: number, color: string): LabelSegment[] {
  const title: LabelSegment = { text: name, color, bold: true }
  const tail = `  ${tagline}`
  if (tagline.length === 0 || stringWidth(name) + stringWidth(tail) + LABEL_CHROME > columns) return [title]
  return [title, { text: tail, dimColor: true }]
}

export interface LayoutProps {
  viewport: Viewport
  name: string
  tagline?: string
  /** Frame titles from the root to the current Screen. */
  path: string[]
  /** The main Panel's border color. */
  color: string
  /** The key help of whatever holds the keys now; empty while nothing does. */
  help: string
  /** Side Panels, drawn only where the terminal has room for them. */
  side?: React.ReactNode
  children: React.ReactNode
}

/**
 * The application frame: the name in its top border, the current key help in
 * its bottom one, the main Panel holding the View, and side Panels on a wide
 * terminal. It is as tall as its content (ADR 0002) -- it never fills or owns
 * the terminal -- and below the minimums it steps aside entirely.
 */
export function Layout({ viewport, name, tagline = '', path, color, help, side, children }: LayoutProps): React.ReactElement {
  const { colors, fold } = useTerminal()
  const shownHelp = fold(help)
  const plan = planLayout(viewport, shownHelp, side !== undefined)
  const body = <ViewportProvider viewport={plan.body}>{children}</ViewportProvider>
  if (!plan.framed) return body
  return (
    <Panel
      width={viewport.columns}
      title={frameTitle({ name: fold(name), tagline: fold(tagline) }, viewport.columns, colors.heading)}
      footer={plan.helpInBorder ? [{ text: shownHelp, dimColor: true }] : []}
      color={colors.frame}
      paddingX={0}
    >
      <Box>
        <MainPanel width={plan.paneWidth} path={path} color={color}>
          {body}
        </MainPanel>
        {plan.sidebar && (
          <Box flexDirection="column" width={SIDEBAR_WIDTH} marginLeft={SIDEBAR_GAP}>
            {side}
          </Box>
        )}
      </Box>
      {plan.helpLines.map((line, index) => (
        <Box key={`${index}:${line}`} paddingX={HELP_PADDING}>
          <Text dimColor>{line}</Text>
        </Box>
      ))}
    </Panel>
  )
}

interface MainPanelProps {
  width: number
  path: string[]
  color: string
  children: React.ReactNode
}

function MainPanel({ width, path, color, children }: MainPanelProps): React.ReactElement {
  const { glyphs, fold } = useTerminal()
  const marks = { separator: ` ${glyphs.pathSeparator} `, ellipsis: fold('…') }
  const title = pathTitle(path.map(fold), width - LABEL_CHROME, marks)
  return (
    <Panel width={width} title={[{ text: title, bold: true }]} color={color}>
      {children}
    </Panel>
  )
}
