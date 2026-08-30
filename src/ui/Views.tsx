import React from 'react'
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
import { SelectList, toneColor, type SelectOption } from './SelectList.js'
import { StatusView } from './Status.js'

/** The cursor starts on the safe row: a confirm screen guards a real effect. */
const CANCEL_INDEX = 1

export function Busy(): React.ReactElement {
  return <Text color="cyan">{t('app.busy')}</Text>
}

function toOption(item: ListItem): SelectOption {
  return { id: item.id, label: item.label, detail: item.detail, tone: item.tone }
}

interface ListViewProps {
  screen: ListScreen
  onSelect: (item: ListItem) => void
}

export function ListView({ screen, onSelect }: ListViewProps): React.ReactElement {
  if (screen.items.length === 0) {
    return <Text dimColor>{screen.empty ?? t('list.empty')}</Text>
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
        <Text dimColor>{t('menu.help')}</Text>
      </Box>
    </Box>
  )
}

interface MessageViewProps {
  screen: MessageScreen
  onDone: () => void
}

export function MessageView({ screen, onDone }: MessageViewProps): React.ReactElement {
  useInput((_input, key) => {
    if (key.return) onDone()
  })
  return (
    <Box flexDirection="column">
      {screen.lines.map((line, position) => (
        <Text key={`${position}:${line}`} color={position === 0 ? toneColor(screen.tone) : undefined}>
          {line}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>{t('message.continue')}</Text>
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
  const options: SelectOption[] = [
    { id: 'confirm', label: screen.confirmLabel, tone: 'warn' },
    { id: 'cancel', label: t('form.cancel') },
  ]
  return (
    <Box flexDirection="column">
      {screen.lines.map((line, position) => (
        <Text key={`${position}:${line}`}>{line}</Text>
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
  const options: SelectOption[] = [
    { id: 'confirm', label: t(confirmKey), tone: 'warn' },
    { id: 'cancel', label: t('prompt.stay') },
  ]
  return (
    <Box flexDirection="column">
      <Text>{t(lineKey)}</Text>
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
