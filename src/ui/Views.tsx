import React, { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type {
  ActionResult,
  ConfirmScreen,
  FormValues,
  ListItem,
  ListScreen,
  MessageScreen,
} from '../types.js'
import { t } from '../i18n/index.js'
import { ReviewForm } from './ReviewForm.js'
import { SelectList, type SelectOption } from './SelectList.js'
import { StatusView } from './Status.js'
import { toneColor, useTerminal } from './terminal.js'
import { pressed } from './keymap.js'
import { handleEscape } from './mouse.js'

/** The cursor starts on the safe row: a confirm screen guards a real effect. */
const CANCEL_INDEX = 1

/** Transient and informational, so it takes the info tone rather than a color of its own. */
export function Busy({ label }: { label?: string }): React.ReactElement {
  const { busyFrames, colors, fold } = useTerminal()
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setFrame((current) => (current + 1) % busyFrames.length), 80)
    return () => clearInterval(timer)
  }, [busyFrames])
  return (
    <Text>
      <Text color={colors.tone.info} bold>{busyFrames[frame]}</Text>
      <Text> {fold(label ?? t('app.busy'))}</Text>
    </Text>
  )
}

function toOption(item: ListItem): SelectOption {
  return { id: item.id, label: item.label, detail: item.detail, preview: item.preview, tone: item.tone }
}

interface ListViewProps {
  screen: ListScreen
  onSelect: (item: ListItem) => void
}

export function ListView({ screen, onSelect }: ListViewProps): React.ReactElement {
  const { fold } = useTerminal()
  if (screen.items.length === 0) {
    return <Text dimColor>{fold(screen.empty ?? t('list.empty'))}</Text>
  }
  return (
    <SelectList
      options={screen.items.map(toOption)}
      onSelect={(_option, index) => {
        const item = screen.items[index]
        if (item !== undefined) onSelect(item)
      }}
    />
  )
}

interface MessageViewProps {
  screen: MessageScreen
  onDone: () => void
}

export function MessageView({ screen, onDone }: MessageViewProps): React.ReactElement {
  const { colors, glyphs, fold } = useTerminal()
  useInput((input, key) => {
    if (pressed(input, key).includes('enter')) onDone()
  })
  return (
    <Box flexDirection="column">
      {screen.lines.map((line, position) => (
        <MessageLine
          key={`${position}:${line}`}
          line={fold(line)}
          lead={position === 0 ? { glyph: glyphs.tone[screen.tone], color: toneColor(colors, screen.tone) } : undefined}
          command={position > 0 && (screen.lines[position - 1] ?? '').trimEnd().endsWith(':')}
        />
      ))}
    </Box>
  )
}

/** `Path:   /home/...` -- a label, its alignment padding, and the value. */
const LABELLED = /^(\S[^:]{0,30}:\s+)(\S.*)$/

interface MessageLineProps {
  line: string
  /** The headline: the first line, led by its tone's glyph in its tone's color. */
  lead?: { glyph: string; color?: string }
  /** The line under an introducing `...:` line -- the command the core user copies -- stands out. */
  command: boolean
}

/**
 * One line of a message Screen. Only styling varies: every character of the
 * line is painted as written, so what the core user selects and copies is
 * exactly what the agent produced.
 */
function MessageLine({ line, lead, command }: MessageLineProps): React.ReactElement {
  const { colors } = useTerminal()
  const labelled = LABELLED.exec(line)
  const prefix = lead === undefined ? null : <Text color={lead.color} bold>{`${lead.glyph} `}</Text>
  if (command) return <Text>{prefix}<Text color={colors.accent} bold>{line}</Text></Text>
  if (labelled === null) return <Text>{prefix}<Text color={lead?.color}>{line}</Text></Text>
  return (
    <Text>
      {prefix}
      <Text color={colors.muted}>{labelled[1]}</Text>
      <Text color={lead?.color}>{labelled[2]}</Text>
    </Text>
  )
}

/** A decision's question, led by the warn glyph: what follows it changes something. */
function Question({ lines }: { lines: string[] }): React.ReactElement {
  const { glyphs, colors, fold } = useTerminal()
  return (
    <>
      {lines.map((line, position) => (
        <Text key={`${position}:${line}`}>
          {position === 0 && <Text color={colors.tone.warn} bold>{`${glyphs.tone.warn} `}</Text>}
          {fold(line)}
        </Text>
      ))}
    </>
  )
}

interface ConfirmViewProps {
  screen: ConfirmScreen
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmView({ screen, onConfirm, onCancel }: ConfirmViewProps): React.ReactElement {
  const { fold } = useTerminal()
  const options: SelectOption[] = [
    { id: 'confirm', label: screen.confirmLabel, tone: 'warn' },
    { id: 'cancel', label: t('form.cancel') },
  ]
  return (
    <Box flexDirection="column">
      <Question lines={screen.lines} />
      <Box marginTop={1}>
        <SelectList
          options={options}
          initialIndex={CANCEL_INDEX}
          onSelect={(option) => (option.id === 'confirm' ? onConfirm() : onCancel())}
        />
      </Box>
    </Box>
  )
}

interface PromptProps {
  lineKey: string
  confirmKey: string
  onConfirm: () => void
  onCancel: () => void
}

/** The unsaved-edits guard. Not an ActionResult: no agent produces it. Esc
 *  means stay -- the same safe answer the cursor starts on. */
export function Prompt({ lineKey, confirmKey, onConfirm, onCancel }: PromptProps): React.ReactElement {
  const { fold } = useTerminal()
  useInput((_input, key) => {
    if (key.escape) handleEscape(onCancel)
  })
  const options: SelectOption[] = [
    { id: 'confirm', label: t(confirmKey), tone: 'warn' },
    { id: 'cancel', label: t('prompt.stay') },
  ]
  return (
    <Box flexDirection="column">
      <Question lines={[t(lineKey)]} />
      <Box marginTop={1}>
        <SelectList
          options={options}
          initialIndex={CANCEL_INDEX}
          onSelect={(option) => (option.id === 'confirm' ? onConfirm() : onCancel())}
        />
      </Box>
    </Box>
  )
}

export interface ScreenHandlers {
  onSubmit: (values: FormValues) => void
  onSelect: (item: ListItem) => void
  onConfirm: (screen: ConfirmScreen) => void
  onCancel: () => void
  onDone: () => void
  onDirtyChange: (dirty: boolean) => void
}

interface ScreenViewProps {
  screen: ActionResult
  handlers: ScreenHandlers
  active?: boolean
}

export function ScreenView({ screen, handlers, active = true }: ScreenViewProps): React.ReactElement {
  switch (screen.kind) {
    case 'form':
      return (
        <ReviewForm
          key={screen.title}
          screen={screen}
          active={active}
          onSubmit={handlers.onSubmit}
          onCancel={handlers.onCancel}
          onDirtyChange={handlers.onDirtyChange}
        />
      )
    case 'list':
      return <ListView screen={screen} onSelect={handlers.onSelect} />
    case 'status':
      return <StatusView screen={screen} onSelect={handlers.onSelect} />
    case 'confirm':
      return (
        <ConfirmView
          screen={screen}
          onConfirm={() => handlers.onConfirm(screen)}
          onCancel={handlers.onCancel}
        />
      )
    default:
      return <MessageView screen={screen} onDone={handlers.onDone} />
  }
}
