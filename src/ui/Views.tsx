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
    <Text color={colors.tone.info}>
      {busyFrames[frame]} {fold(label ?? t('app.busy'))}
    </Text>
  )
}

function toOption(item: ListItem): SelectOption {
  return { id: item.id, label: item.label, detail: item.detail, tone: item.tone }
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
    <Box flexDirection="column">
      <SelectList
        options={screen.items.map(toOption)}
        onSelect={(_option, index) => {
          const item = screen.items[index]
          if (item !== undefined) onSelect(item)
        }}
      />
      <Box marginTop={1}>
        <Text dimColor>{fold(t('menu.help'))}</Text>
      </Box>
    </Box>
  )
}

interface MessageViewProps {
  screen: MessageScreen
  onDone: () => void
}

export function MessageView({ screen, onDone }: MessageViewProps): React.ReactElement {
  const { colors, fold } = useTerminal()
  useInput((_input, key) => {
    if (key.return) onDone()
  })
  return (
    <Box flexDirection="column">
      {screen.lines.map((line, position) => (
        <Text
          key={`${position}:${line}`}
          color={position === 0 ? toneColor(colors, screen.tone) : undefined}
        >
          {fold(line)}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>{fold(t('message.continue'))}</Text>
      </Box>
    </Box>
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
      {screen.lines.map((line, position) => (
        <Text key={`${position}:${line}`}>{fold(line)}</Text>
      ))}
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

/** The unsaved-edits guard. Not an ActionResult: no agent produces it. */
export function Prompt({ lineKey, confirmKey, onConfirm, onCancel }: PromptProps): React.ReactElement {
  const { fold } = useTerminal()
  const options: SelectOption[] = [
    { id: 'confirm', label: t(confirmKey), tone: 'warn' },
    { id: 'cancel', label: t('prompt.stay') },
  ]
  return (
    <Box flexDirection="column">
      <Text>{fold(t(lineKey))}</Text>
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
