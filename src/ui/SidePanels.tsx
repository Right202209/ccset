import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import stringWidth from 'string-width'
import type { ActionResult, MessageTone } from '../types.js'
import { t } from '../i18n/index.js'
import { sanitizeForTerminal } from '../core/terminal-text.js'
import { SIDEBAR_WIDTH } from './Layout.js'
import { Panel } from './Panel.js'
import { useTerminal, type ColorSet } from './terminal.js'
import { truncateEnd, truncateStart } from './text-fit.js'

/** A side Panel's borders and padding. */
const SIDE_CHROME = 4
const SIDE_TEXT_WIDTH = SIDEBAR_WIDTH - SIDE_CHROME

/** The last message Screen: a save, a result, or a failure. */
export interface LastResult {
  title: string
  line?: string
  tone: MessageTone
}

export interface SideState {
  /** The Agent being configured; undefined until one is chosen. */
  agentName?: string
  /** agent.detect() for that Agent; null while it runs. */
  detected: boolean | null
  /** How many Agents discovery found; null while it runs. */
  found: number | null
  home: string
  last: LastResult | null
}

interface SideLine {
  text: string
  color?: string
  bold?: boolean
  dimColor?: boolean
}

/**
 * Keeps the most recent message Screen after the core user leaves it, so the
 * outcome of a save stays in view on the list it returns to.
 */
export function useLastResult(current: ActionResult | undefined): LastResult | null {
  const [last, setLast] = useState<LastResult | null>(null)
  useEffect(() => {
    if (current?.kind !== 'message') return
    setLast({
      title: current.title,
      line: current.lines.find((line) => line.length > 0),
      tone: current.tone,
    })
  }, [current])
  return last
}

function detectionLine(state: SideState, colors: ColorSet): SideLine {
  if (state.agentName === undefined) {
    if (state.found === null) return { text: t('side.checking'), dimColor: true }
    return { text: t('side.agentsFound', { count: state.found }) }
  }
  if (state.detected === null) return { text: t('side.checking'), dimColor: true }
  return state.detected
    ? { text: t('side.configFound'), color: colors.tone.success }
    : { text: t('side.configMissing'), color: colors.tone.warn }
}

function resultLines(last: LastResult | null, colors: ColorSet): SideLine[] {
  if (last === null) return [{ text: t('side.noResult'), dimColor: true }]
  const title: SideLine = { text: last.title, color: colors.tone[last.tone], bold: true }
  return last.line === undefined ? [title] : [title, { text: last.line, dimColor: true }]
}

function Line({ line, fit }: { line: SideLine; fit: (text: string) => string }): React.ReactElement {
  return (
    <Text color={line.color} bold={line.bold} dimColor={line.dimColor}>
      {fit(line.text)}
    </Text>
  )
}

/** The home is a path, so it keeps its end: the directory that names it. */
function HomeLine({ home }: { home: string }): React.ReactElement {
  const { fold } = useTerminal()
  const label = fold(t('side.home'))
  const room = Math.max(1, SIDE_TEXT_WIDTH - stringWidth(label) - 1)
  return (
    <Box>
      <Text dimColor>{`${label} `}</Text>
      <Text>{truncateStart(fold(sanitizeForTerminal(home)), room, fold('…'))}</Text>
    </Box>
  )
}

/**
 * Context beside the main Panel on a wide terminal: which Agent, whether its
 * config exists, where ccset reads and writes, and the last result. Nothing
 * here is needed to act -- a narrow terminal drops the whole column.
 */
export function SidePanels({ state }: { state: SideState }): React.ReactElement {
  const { colors, fold } = useTerminal()
  const fit = (text: string): string => truncateEnd(fold(sanitizeForTerminal(text)), SIDE_TEXT_WIDTH, fold('…'))
  const name: SideLine = state.agentName === undefined
    ? { text: t('side.noAgent'), dimColor: true }
    : { text: state.agentName, bold: true }
  return (
    <>
      <Panel width={SIDEBAR_WIDTH} title={[{ text: fit(t('side.agentTitle')) }]} color={colors.panel.browse}>
        <Line line={name} fit={fit} />
        <Line line={detectionLine(state, colors)} fit={fit} />
        <HomeLine home={state.home} />
      </Panel>
      <Panel width={SIDEBAR_WIDTH} title={[{ text: fit(t('side.resultTitle')) }]} color={colors.panel.browse} grow>
        {resultLines(state.last, colors).map((line, index) => (
          <Line key={index} line={line} fit={fit} />
        ))}
      </Panel>
    </>
  )
}
