import React from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import type { FieldSpec, FieldValue } from '../../src/types.js'
import { MASK_CHAR } from '../../src/core/constants.js'
import { maskSecret } from '../../src/core/mask.js'
import { t } from '../../src/i18n/index.js'
import { APP_PADDING, CHANGED_WIDTH, MARKER_WIDTH } from './layout.js'
import type { Subject, SubjectState } from './subjects.js'

/**
 * The elements every treatment is built from: the App shell, the header, one
 * field row and the control rows. Only the enclosure and the two layout numbers
 * differ between treatments, so everything that does not differ lives here and
 * `treatments.tsx` stays readable as three layouts side by side.
 *
 * The value and the hints use the narrow-terminal idiom `SelectList` and
 * `Status` already use -- `flexGrow`/`flexShrink` with `wrap`. `Field.tsx` never
 * got it, which is why the baseline render overflows at 60 columns and none of
 * the three treatments does.
 *
 * Prototype code for issue #9.
 */

const FOCUS_MARKER = '❯'
const CHANGED_MARKER = '*'

export interface RowLayout {
  /** Label column as the row reserves it: the measurement plus the gap. */
  labelCell: number
  hintIndent: number
}

function pad(width: number): string {
  return ' '.repeat(width)
}

function textOf(value: FieldValue | undefined): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

/** `App.tsx`'s outer shell, so a treatment is measured against the real budget. */
export function Shell({
  subject,
  children,
}: {
  subject: Subject
  children: React.ReactNode
}): React.ReactElement {
  return (
    <Box flexDirection="column" padding={APP_PADDING}>
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold color="cyan">
            {t('app.title')}
          </Text>
          <Text dimColor>{`  ${t('app.tagline')}`}</Text>
        </Box>
        <Text bold>{subject.title}</Text>
      </Box>
      {children}
    </Box>
  )
}

/** What `ReviewForm` calls `FormNotes`: the file path and the preservation promise. */
export function Notes({ subject }: { subject: Subject }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {subject.notes.map((note) => (
        <Text key={note} dimColor wrap="wrap">
          {note}
        </Text>
      ))}
    </Box>
  )
}

interface RowProps {
  field: FieldSpec
  state: SubjectState
  layout: RowLayout
}

export function Row({ field, state, layout }: RowProps): React.ReactElement {
  const focused = state.focusId === field.id
  const changed = textOf(state.values[field.id]) !== textOf(state.baseline[field.id])
  return (
    <Box flexDirection="column">
      <Box>
        {/* The gutters are fixed cells. Left shrinkable, flex steals a column
            from them the moment a row wants more width than it has, and the
            focus marker loses its space -- which is what the baseline does. */}
        <Box width={MARKER_WIDTH} flexShrink={0}>
          <Text color={focused ? 'cyan' : undefined}>{focused ? FOCUS_MARKER : ''}</Text>
        </Box>
        <Box width={layout.labelCell} flexShrink={0}>
          <Text color={focused ? 'cyan' : undefined} bold={focused}>
            {t(field.labelKey)}
          </Text>
        </Box>
        <Box width={CHANGED_WIDTH} flexShrink={0}>
          <Text color="yellow">{changed ? CHANGED_MARKER : ''}</Text>
        </Box>
        <Value field={field} value={state.values[field.id] ?? ''} focused={focused} />
      </Box>
      <Hints field={field} focused={focused} error={state.errors[field.id]} layout={layout} />
    </Box>
  )
}

interface HintsProps {
  field: FieldSpec
  focused: boolean
  error?: string
  layout: RowLayout
}

interface HintLine {
  text: string
  color?: string
}

/** An error prints whether or not its row has focus; a help line only focused. */
function hintLines({ field, focused, error }: HintsProps): HintLine[] {
  const lines: HintLine[] = []
  if (focused && field.helpKey !== undefined) lines.push({ text: t(field.helpKey) })
  if (focused && field.suggestions !== undefined) {
    lines.push({ text: t('hint.suggestions', { list: field.suggestions.join(', ') }) })
  }
  if (error !== undefined) lines.push({ text: t(error), color: 'red' })
  return lines
}

function Hints(props: HintsProps): React.ReactElement | null {
  const lines = hintLines(props)
  if (lines.length === 0) return null
  return (
    <Box flexDirection="column" paddingLeft={props.layout.hintIndent}>
      {lines.map((line) => (
        <Box key={line.text} flexGrow={1} flexShrink={1}>
          <Text color={line.color} dimColor={line.color === undefined} wrap="wrap">
            {line.text}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

interface ValueProps {
  field: FieldSpec
  value: FieldValue
  focused: boolean
}

function Value(props: ValueProps): React.ReactElement {
  if (props.field.type === 'choice') return <ChoiceValue {...props} />
  if (props.field.type === 'boolean') return <BooleanValue {...props} />
  return <TextValue {...props} />
}

function TextValue({ field, value, focused }: ValueProps): React.ReactElement {
  const text = typeof value === 'string' ? value : ''
  if (focused) {
    return (
      <TextInput
        value={text}
        onChange={() => {}}
        focus
        mask={field.type === 'secret' ? MASK_CHAR : undefined}
        placeholder={t('hint.empty')}
      />
    )
  }
  const shown = field.type === 'secret' ? maskSecret(text) : text
  return (
    <Box flexGrow={1} flexShrink={1}>
      <Text dimColor={shown.length === 0} wrap="wrap">
        {shown.length === 0 ? t('status.unset') : shown}
      </Text>
    </Box>
  )
}

/**
 * `flexWrap` is the difference that matters at 60 columns: three radios need 30
 * columns, and a row of Boxes without it overflows rather than folding.
 */
function ChoiceValue({ field, value, focused }: ValueProps): React.ReactElement {
  const current = typeof value === 'string' ? value : ''
  return (
    <Box flexGrow={1} flexShrink={1} flexWrap="wrap">
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

function BooleanValue({ value, focused }: ValueProps): React.ReactElement {
  const on = value === true
  return (
    <Text color={focused ? 'cyan' : on ? 'green' : undefined}>
      {on ? t('choice.on') : t('choice.off')}
      <Text dimColor>{focused ? t('hint.toggle') : ''}</Text>
    </Text>
  )
}

/**
 * Advanced toggle, Save, Cancel and the help line. None of them is focused in a
 * static paint, because the focused row is a field and focus is single-valued.
 */
export function Controls({
  subject,
  showAdvanced,
}: {
  subject: Subject
  showAdvanced: boolean
}): React.ReactElement {
  const toggle = subject.fields.some((field) => field.advanced === true)
  return (
    <Box flexDirection="column">
      {toggle && (
        <Box marginTop={1}>
          <Text>{`${pad(MARKER_WIDTH)}${t(showAdvanced ? 'form.hideAdvanced' : 'form.showAdvanced')}`}</Text>
        </Box>
      )}
      <Text color="green">{`${pad(MARKER_WIDTH)}${t('form.save')}`}</Text>
      <Text>{`${pad(MARKER_WIDTH)}${t('form.cancel')}`}</Text>
      <Box marginTop={1}>
        <Text dimColor wrap="wrap">
          {t('form.help')}
        </Text>
      </Box>
    </Box>
  )
}
