import React from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import type { FieldSpec, FieldValue } from '../types.js'
import { MASK_CHAR } from '../core/constants.js'
import { maskSecret } from '../core/mask.js'
import { t } from '../i18n/index.js'

const LABEL_WIDTH = 30
const CHANGED_MARKER = '*'

export interface FieldRowProps {
  field: FieldSpec
  value: FieldValue
  focused: boolean
  changed: boolean
  error?: string
  onChange: (next: FieldValue) => void
}

export function FieldRow(props: FieldRowProps): React.ReactElement {
  const { field, focused, changed, error } = props
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={focused ? 'cyan' : undefined}>{focused ? '❯ ' : '  '}</Text>
        <Box width={LABEL_WIDTH}>
          <Text color={focused ? 'cyan' : undefined} bold={focused}>
            {t(field.labelKey)}
          </Text>
        </Box>
        <Text color="yellow">{changed ? `${CHANGED_MARKER} ` : '  '}</Text>
        <FieldValueView {...props} />
      </Box>
      {focused && field.helpKey !== undefined && <Hint text={t(field.helpKey)} />}
      {focused && field.suggestions !== undefined && (
        <Hint text={t('hint.suggestions', { list: field.suggestions.join(', ') })} />
      )}
      {error !== undefined && <Hint text={t(error)} color="red" />}
    </Box>
  )
}

function Hint({ text, color }: { text: string; color?: string }): React.ReactElement {
  return (
    <Box paddingLeft={LABEL_WIDTH + 6}>
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
  const text = typeof value === 'string' ? value : ''
  if (focused && field.readOnly !== true) {
    return (
      <TextInput
        value={text}
        onChange={onChange}
        focus
        mask={field.type === 'secret' ? MASK_CHAR : undefined}
        placeholder={t('hint.empty')}
      />
    )
  }
  const shown = field.type === 'secret' ? maskSecret(text) : text
  if (shown.length === 0) return <Text dimColor>{t('status.unset')}</Text>
  return <Text dimColor={field.readOnly === true}>{shown}</Text>
}

function ChoiceValue({ field, value, focused }: FieldRowProps): React.ReactElement {
  const current = typeof value === 'string' ? value : ''
  return (
    <Box>
      {(field.choices ?? []).map((choice) => (
        <Box key={choice.value || 'unset'} marginRight={2}>
          <Text
            color={choice.value === current ? (focused ? 'cyan' : 'green') : undefined}
            dimColor={choice.value !== current}
          >
            {choice.value === current ? '(•) ' : '( ) '}
            {t(choice.labelKey)}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

function BooleanValue({ value, focused }: FieldRowProps): React.ReactElement {
  const on = value === true
  return (
    <Text color={focused ? 'cyan' : on ? 'green' : undefined}>
      {on ? t('choice.on') : t('choice.off')}
      <Text dimColor>{focused ? t('hint.toggle') : ''}</Text>
    </Text>
  )
}
