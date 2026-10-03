import React, { useEffect, useState } from 'react'
import { Text } from 'ink'
import stringWidth from 'string-width'
import type { ActionResult, MessageTone, StatusLine } from '../types.js'
import { t } from '../i18n/index.js'
import { sanitizeForTerminal } from '../core/terminal-text.js'
import { SIDEBAR_WIDTH } from './Layout.js'
import { Panel } from './Panel.js'
import { useTerminal, type ColorSet } from './terminal.js'
import { truncateEnd, truncateStart } from './text-fit.js'
import { planSide, type SidePanelInput } from './side-plan.js'
import type { GlanceState } from './useGlance.js'
import { useFocusPreview, type FocusPreview } from './useFocusPreview.js'
import { previewLine, safeDisplayValue } from './preview-safety.js'

/** A side Panel's borders and padding. */
const SIDE_CHROME = 4

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
  glance: GlanceState
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
function HomeLine({ home, width }: { home: string; width: number }): React.ReactElement {
  const { fold } = useTerminal()
  const label = fold(t('side.home'))
  const room = Math.max(1, width - SIDE_CHROME - stringWidth(label) - 1)
  return (
    <Text>
      <Text dimColor>{`${label} `}</Text>
      {truncateStart(fold(sanitizeForTerminal(home)), room, fold('…'))}
    </Text>
  )
}

interface SidePanelsProps {
  state: SideState
  budget: number
  width?: number
}

function panelLines(state: SideState, preview: FocusPreview | null): SidePanelInput[] {
  return [
    { id: 'result', lines: state.last?.line === undefined ? 1 : 2 },
    { id: 'agent', lines: 3 },
    { id: 'config', lines: state.glance.summary.length },
    { id: 'preview', lines: preview?.lines.length ?? 0 },
    { id: 'warnings', lines: Math.max(1, state.glance.findings.length) },
  ]
}

export function SidePanels({ state, budget, width = SIDEBAR_WIDTH }: SidePanelsProps): React.ReactElement {
  const { colors, fold } = useTerminal()
  const preview = useFocusPreview()
  const fit = (text: string): string => truncateEnd(fold(sanitizeForTerminal(text)), width - SIDE_CHROME, fold('…'))
  const name: SideLine = state.agentName === undefined
    ? { text: t('side.noAgent'), dimColor: true }
    : { text: state.agentName, bold: true }
  const planned = new Map(planSide(budget, panelLines(state, preview)).map((panel) => [panel.id, panel]))
  const visible = (id: string): number => planned.get(id)?.lines ?? 0
  return (
    <>
      {visible('agent') > 0 && <AgentPanel state={state} name={name} width={width} fit={fit} rows={visible('agent')} colors={colors} />}
      {visible('config') > 0 && <StatusPanel id="config" title={t('side.configTitle')} lines={state.glance.summary} width={width} fit={fit} rows={visible('config')} colors={colors} />}
      {visible('preview') > 0 && preview !== null && <StatusPanel id="preview" title={preview.label} lines={preview.lines} width={width} fit={fit} rows={visible('preview')} colors={colors} />}
      {visible('warnings') > 0 && <WarningsPanel state={state} width={width} fit={fit} rows={visible('warnings')} more={planned.get('warnings')?.more ?? 0} colors={colors} />}
      {visible('result') > 0 && <ResultPanel state={state} width={width} fit={fit} rows={visible('result')} colors={colors} />}
    </>
  )
}

interface PanelProps {
  state: SideState
  width: number
  rows: number
  fit: (text: string) => string
  colors: ColorSet
}

function AgentPanel({ state, name, width, fit, rows, colors }: PanelProps & { name: SideLine }): React.ReactElement {
  const lines = [name, detectionLine(state, colors)]
  return <Panel width={width} title={[{ text: fit(t('side.agentTitle')) }]} color={colors.panel.browse}>
    {lines.slice(0, rows).map((line, index) => <Line key={index} line={line} fit={fit} />)}
    {rows > 2 && <HomeLine home={state.home} width={width} />}
  </Panel>
}

function StatusPanel({ id, title, lines, width, fit, rows, colors }: {
  id: string
  title: string
  lines: StatusLine[]
  width: number
  fit: (text: string) => string
  rows: number
  colors: ColorSet
}): React.ReactElement {
  return <Panel width={width} title={[{ text: fit(title) }]} color={colors.panel.browse}>
    {lines.slice(0, rows).map((line, index) => <StatusLineView key={`${id}:${index}`} line={previewLine(line)} width={width} fit={fit} colors={colors} />)}
  </Panel>
}

function WarningsPanel({ state, width, fit, rows, more, colors }: PanelProps & { more: number }): React.ReactElement {
  const findings = state.glance.findings
  const shown = more > 0 ? findings.slice(0, Math.max(0, rows - 1)) : findings.slice(0, rows)
  const title = t('side.warningsTitle', { count: warningCount(findings) })
  return <Panel width={width} title={[{ text: fit(title) }]} color={colors.panel.browse}>
    {findings.length === 0
      ? <Text dimColor>{fit(t('side.noWarnings'))}</Text>
      : <>
          {shown.map((finding, index) => <Line key={index} line={{ text: finding.text, color: colors.tone[finding.tone] }} fit={fit} />)}
          {more > 0 && <Text dimColor>{fit(t('side.more', { count: more }))}</Text>}
        </>}
  </Panel>
}

function ResultPanel({ state, width, fit, rows, colors }: PanelProps): React.ReactElement {
  return <Panel width={width} title={[{ text: fit(t('side.resultTitle')) }]} color={colors.panel.browse}>
    {resultLines(state.last, colors).slice(0, rows).map((line, index) => <Line key={index} line={line} fit={fit} />)}
  </Panel>
}

function StatusLineView({ line, width, fit, colors }: {
  line: StatusLine
  width: number
  fit: (text: string) => string
  colors: ColorSet
}): React.ReactElement {
  const { fold } = useTerminal()
  if (line.label === t('status.path')) {
    const label = `${line.label}: `
    const room = Math.max(1, width - SIDE_CHROME - stringWidth(fold(label)))
    const value = truncateStart(fold(sanitizeForTerminal(line.value)), room, fold('…'))
    return <Text color={line.tone === undefined ? undefined : colors.tone[line.tone]}>{fold(label)}{value}</Text>
  }
  const text = line.value.length === 0 ? line.label : `${line.label}: ${line.value}`
  return <Text color={line.tone === undefined ? undefined : colors.tone[line.tone]}>{fit(text)}</Text>
}

export function DetailStrip({ state, width }: { state: SideState; width: number }): React.ReactElement {
  const { colors, fold } = useTerminal()
  const preview = useFocusPreview()
  const fit = (text: string): string => truncateEnd(fold(sanitizeForTerminal(text)), width - SIDE_CHROME, fold('…'))
  const title = t('side.detailsTitle', { count: warningCount(state.glance.findings) })
  const summary = state.glance.summary.map((line) => lineText(previewLine(line))).join(' · ') || t('side.checking')
  const detail = stripDetail(preview, state.glance.findings)
  return <Panel width={width} title={[{ text: fit(title) }]} color={colors.panel.browse}>
    <Text>{fit(summary)}</Text>
    <Text color={detail.tone === undefined ? undefined : colors.tone[detail.tone]}>{fit(detail.text)}</Text>
  </Panel>
}

function stripDetail(preview: FocusPreview | null, findings: SideState['glance']['findings']): { text: string; tone?: MessageTone } {
  if (preview !== null && preview.lines.length > 0) {
    const lines = preview.lines.map(previewLine)
    const compact = lines.filter((line) => line.label !== t('status.path'))
    const paths = lines.filter((line) => line.label === t('status.path'))
    return { text: [...compact, ...paths].map(compactPreviewLine).join(' · ') }
  }
  const finding = findings[0]
  return finding === undefined ? { text: t('side.noWarnings') } : { text: finding.text, tone: finding.tone }
}

function compactPreviewLine(line: StatusLine): string {
  if (line.label === t('status.path')) {
    const segments = line.value.split(/[\\/]/)
    const filename = segments[segments.length - 1] ?? line.value
    return filename
  }
  if (line.label === t('field.baseUrl')) return `${t('side.compactUrl')}: ${line.value}`
  if (line.label === t('field.providerModel') || line.label === t('field.globalModel')) {
    return `${t('side.compactModel')}: ${line.value}`
  }
  if (line.label === t('field.token')) return `${t('side.compactKey')}: ${line.value}`
  return lineText(line)
}

function lineText(line: StatusLine): string {
  return line.value.length === 0 ? line.label : `${line.label}: ${line.value}`
}

function warningCount(findings: SideState['glance']['findings']): number {
  return findings.filter((finding) => finding.tone === 'warn').length
}
