import React from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import type { FieldSpec, FieldValue, MessageTone } from '../types.js'
import { maskSecret } from '../core/mask.js'
import { t } from '../i18n/index.js'
import { focusGutter, markerGutter, useTerminal } from './terminal.js'

export const FORM_HINT_INDENT = 4

export interface FieldRowProps {
  field: FieldSpec
  labelWidth: number
  value: FieldValue
  focused: boolean
  changed: boolean
  showHints?: boolean
  error?: string
  onChange: (next: FieldValue) => void
}

export interface FieldHint {
  text: string
  tone?: MessageTone
}

export function fieldHints(field: FieldSpec, error?: string): FieldHint[] {
  const hints: FieldHint[] = []
  if (field.helpKey !== undefined) hints.push({ text: t(field.helpKey) })
  if (field.suggestions !== undefined) {
    hints.push({ text: t('hint.suggestions', { list: field.suggestions.join(', ') }) })
  }
  if (error !== undefined) hints.push({ text: t(error), tone: 'error' })
  return hints
}

export function FieldRow(props: FieldRowProps): React.ReactElement {
  const { field, labelWidth, focused, changed, error, showHints = true } = props
  const { glyphs, colors, fold } = useTerminal()
  const labelColor = focused ? colors.focus : undefined
  return (
    <Box flexDirection="column">
      <Box flexShrink={1}>
        <Text color={labelColor}>{focusGutter(glyphs, focused)}</Text>
        <Box width={labelWidth} flexShrink={0}>
          <Text color={labelColor} bold={focused} wrap="truncate-end">
            {fold(t(field.labelKey))}
          </Text>
        </Box>
        <Text color={colors.tone.warn}>{markerGutter(glyphs.changed, changed)}</Text>
        <FieldValueView {...props} />
      </Box>
      {showHints && fieldHints(field, error)
        .filter((hint) => focused || hint.tone === 'error')
        .map((hint) => (
          <Hint
            key={`${hint.tone ?? 'hint'}:${hint.text}`}
            text={fold(hint.text)}
            color={hint.tone === undefined ? undefined : colors.tone[hint.tone]}
          />
        ))}
    </Box>
  )
}

function Hint({ text, color }: { text: string; color?: string }): React.ReactElement {
  return (
    <Box paddingLeft={FORM_HINT_INDENT}>
      <Text color={color} dimColor={color === undefined}>
        {text}
      </Text>
    </Box>
  )
}

function FieldValueView(props: FieldRowProps): React.ReactElement {
  const { field } = props
  if (field.type === 'choice') return <ChoiceValue {...props} />
  if (field.type === 'boolean') return <BooleanValue {...props} />
  return <TextValue {...props} />
}

/** Text, secret and csv share one editor; only the display differs. */
function TextValue({ field, value, focused, onChange }: FieldRowProps): React.ReactElement {
  const { glyphs, fold } = useTerminal()
  const text = typeof value === 'string' ? value : ''
  if (focused && field.readOnly !== true) {
    return <Box flexGrow={1} flexShrink={1}>
      <TextInput
        value={text}
        onChange={onChange}
        focus
        mask={field.type === 'secret' ? glyphs.mask : undefined}
        placeholder={fold(t('hint.empty'))}
      />
    </Box>
  }
  const shown = field.type === 'secret' ? maskSecret(text) : text
  if (shown.length === 0) return <Text dimColor>{fold(t('status.unset'))}</Text>
  return <Box flexGrow={1} flexShrink={1}>
    <Text dimColor={field.readOnly === true} wrap="truncate-end">{fold(shown)}</Text>
  </Box>
}

function ChoiceValue({ field, value, focused }: FieldRowProps): React.ReactElement {
  const current = typeof value === 'string' ? value : ''
  const { glyphs, colors, fold } = useTerminal()
  const selectedColor = focused ? colors.focus : colors.tone.success
  return (
    <Box flexGrow={1} flexShrink={1} flexWrap="wrap">
      {(field.choices ?? []).map((choice) => (
        <Box key={choice.value || 'unset'} marginRight={2}>
          <Text
            color={choice.value === current ? selectedColor : undefined}
            dimColor={choice.value !== current}
          >
            {`${choice.value === current ? glyphs.radioOn : glyphs.radioOff} `}
            {fold(t(choice.labelKey))}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

function BooleanValue({ value, focused }: FieldRowProps): React.ReactElement {
  const on = value === true
  const { colors, fold } = useTerminal()
  return (
    <Text color={focused ? colors.focus : on ? colors.tone.success : undefined}>
      {fold(on ? t('choice.on') : t('choice.off'))}
      <Text dimColor>{focused ? fold(t('hint.toggle')) : ''}</Text>
    </Text>
  )
}
