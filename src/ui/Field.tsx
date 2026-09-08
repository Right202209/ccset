import React from 'react'
import { Box, Text } from 'ink'
import stringWidth from 'string-width'
import type { FieldSpec, FieldValue, MessageTone } from '../types.js'
import { maskSecret } from '../core/mask.js'
import { t } from '../i18n/index.js'
import { focusGutter, markerGutter, useTerminal } from './terminal.js'
import { useViewport } from './Viewport.js'
import { TextField } from './TextField.js'

export const FORM_HINT_INDENT = 4

/** Gap between rendered choices, matching the marginRight below. */
const CHOICE_GAP = 2
/** Columns the lead/trail ellipsis marker can occupy. */
const CHOICE_MARKER = 2
/** Fixed chrome around a value: focus gutter, changed marker, side padding. */
const ROW_CHROME = 6

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
function TextValue({ field, value, focused, onChange, labelWidth }: FieldRowProps): React.ReactElement {
  const { glyphs, fold } = useTerminal()
  const { columns } = useViewport()
  const text = typeof value === 'string' ? value : ''
  if (focused && field.readOnly !== true) {
    return (
      <TextField
        value={text}
        onChange={onChange}
        focus
        mask={field.type === 'secret' ? glyphs.mask : undefined}
        width={Math.max(1, columns - labelWidth - ROW_CHROME - 1)}
      />
    )
  }
  const shown = field.type === 'secret' ? maskSecret(text) : text
  if (shown.length === 0) return <Text dimColor>{fold(t('status.unset'))}</Text>
  return <Box flexGrow={1} flexShrink={1}>
    <Text dimColor={field.readOnly === true} wrap="truncate-end">{fold(shown)}</Text>
  </Box>
}

/**
 * The window of choices that fits the row, anchored so the selected choice is
 * always inside it. A wrapped second line would be clipped away by the
 * one-line row, and an option the user can cycle onto must be one they can
 * see; choices beyond the window are announced by an ellipsis on each side.
 */
function choiceWindow(widths: number[], selected: number, width: number): [number, number] {
  const fit = (budget: number): [number, number] => {
    let start = selected
    let end = selected + 1
    let used = widths[selected] ?? 0
    while (start > 0 && used + (widths[start - 1] ?? 0) <= budget) {
      start -= 1
      used += widths[start] ?? 0
    }
    while (end < widths.length && used + (widths[end] ?? 0) <= budget) {
      used += widths[end] ?? 0
      end += 1
    }
    return [start, end]
  }
  const [leadStart, leadEnd] = fit(width)
  if (leadStart === 0 && leadEnd === widths.length) return [leadStart, leadEnd]
  const markers = (leadStart > 0 ? 1 : 0) + (leadEnd < widths.length ? 1 : 0)
  return fit(width - markers * CHOICE_MARKER)
}

function ChoiceValue({ field, value, focused, labelWidth }: FieldRowProps): React.ReactElement {
  const current = typeof value === 'string' ? value : ''
  const { glyphs, colors, fold } = useTerminal()
  const { columns } = useViewport()
  const choices = field.choices ?? []
  const selected = Math.max(
    0,
    choices.findIndex((choice) => choice.value === current),
  )
  const rendered = choices.map((choice) => ({
    text: `${choice.value === current ? glyphs.radioOn : glyphs.radioOff} ${fold(t(choice.labelKey))}`,
    chosen: choice.value === current,
  }))
  const widths = rendered.map((item) => stringWidth(item.text) + CHOICE_GAP)
  const [start, end] = choiceWindow(widths, selected, Math.max(1, columns - labelWidth - ROW_CHROME))
  const selectedColor = focused ? colors.focus : colors.tone.success
  return (
    <Box flexGrow={1} flexShrink={1}>
      {start > 0 && <Text dimColor>{fold('… ')} </Text>}
      {rendered.slice(start, end).map((item, offset) => (
        <Box key={choices[start + offset]?.value ?? offset} marginRight={CHOICE_GAP}>
          <Text
            color={item.chosen ? selectedColor : undefined}
            dimColor={!item.chosen}
          >
            {item.text}
          </Text>
        </Box>
      ))}
      {end < choices.length && <Text dimColor> {fold('…')}</Text>}
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
