import React from 'react'
import { Box, Text } from 'ink'
import stringWidth from 'string-width'
import type { FieldSpec, FieldValue, FormScreen, FormValues, MessageTone } from '../types.js'
import { t } from '../i18n/index.js'
import { FieldRow, FORM_HINT_INDENT, type FieldHint } from './Field.js'
import { focusGutter, useTerminal } from './terminal.js'
import { helpFor } from './keymap.js'
import { WindowRegion } from './Viewport.js'
import { textOf, useReviewForm, type ReviewRow as Row } from './useReviewForm.js'

interface ReviewFormProps {
  screen: FormScreen
  active?: boolean
  onSubmit: (values: FormValues) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}

export function ReviewForm({
  screen,
  active = true,
  onSubmit,
  onCancel,
  onDirtyChange,
}: ReviewFormProps): React.ReactElement {
  const form = useReviewForm({ screen, active, onSubmit, onCancel, onDirtyChange })
  const { colors, fold } = useTerminal()
  const labelWidth = Math.max(...screen.fields.map((field) => stringWidth(fold(t(field.labelKey)))), 0) + 1

  return (
    <Box flexDirection="column">
      {!form.compact && <FormNotes notes={screen.notes} />}
      <WindowRegion window={form.window} rows={form.rowBudget}>
        {form.window.items.map((current, visiblePosition) => {
          const position = form.window.start + visiblePosition
          return (
            <Box
              key={rowKey(current, position)}
              height={1}
              overflow="hidden"
            >
              <FormRow
                row={current}
                labelWidth={labelWidth}
                focused={active && position === form.index}
                state={{
                  values: form.values,
                  errors: form.errors,
                  baseline: screen.baseline,
                  showAdvanced: form.showAdvanced,
                }}
                onChange={form.update}
              />
            </Box>
          )
        })}
      </WindowRegion>
      <FormHints hints={form.visibleHints} colors={colors.tone} fold={fold} />
      {!form.compact && (
        <Box marginTop={1}>
          <Text dimColor>{fold(helpFor('form'))}</Text>
        </Box>
      )}
    </Box>
  )
}

function FormHints({
  hints,
  colors,
  fold,
}: {
  hints: FieldHint[]
  colors: Record<MessageTone, string>
  fold: (text: string) => string
}): React.ReactElement {
  return <>{hints.map((hint) => (
    <Box
      key={`${hint.tone ?? 'hint'}:${hint.text}`}
      height={1}
      overflow="hidden"
      paddingLeft={FORM_HINT_INDENT}
    >
      <Text color={hint.tone === undefined ? undefined : colors[hint.tone]} dimColor={hint.tone === undefined} wrap="truncate-end">
        {fold(hint.text)}
      </Text>
    </Box>
  ))}</>
}

function rowKey(row: Row, position: number): string {
  return row.kind === 'field' ? row.field.id : `${row.kind}-${position}`
}

function FormNotes({ notes }: { notes?: string[] }): React.ReactElement | null {
  const { fold } = useTerminal()
  if (notes === undefined || notes.length === 0) return null
  return (
    <Box flexDirection="column" marginBottom={1}>
      {notes.map((note, position) => (
        <Box key={`${position}:${note}`} height={1} overflow="hidden">
          <Text dimColor wrap="truncate-end">{fold(note)}</Text>
        </Box>
      ))}
    </Box>
  )
}

interface FormRowProps {
  row: Row
  labelWidth: number
  focused: boolean
  state: {
    values: FormValues
    errors: Record<string, string>
    baseline: FormValues
    showAdvanced: boolean
  }
  onChange: (field: FieldSpec, next: FieldValue) => void
}

function FormRow({ row, labelWidth, focused, state, onChange }: FormRowProps): React.ReactElement {
  if (row.kind === 'field') {
    const error = state.errors[row.field.id]
    return (
      <FieldRow
        field={row.field}
        labelWidth={labelWidth}
        value={state.values[row.field.id] ?? ''}
        focused={focused}
        changed={textOf(state.values[row.field.id]) !== textOf(state.baseline[row.field.id])}
        showHints={false}
        error={error !== undefined && error.length > 0 ? error : undefined}
        onChange={(next) => onChange(row.field, next)}
      />
    )
  }
  return <ControlRow kind={row.kind} focused={focused} showAdvanced={state.showAdvanced} />
}

interface ControlRowProps {
  kind: 'advanced' | 'save' | 'cancel'
  focused: boolean
  showAdvanced: boolean
}

function ControlRow({ kind, focused, showAdvanced }: ControlRowProps): React.ReactElement {
  const label =
    kind === 'advanced'
      ? t(showAdvanced ? 'form.hideAdvanced' : 'form.showAdvanced')
      : t(kind === 'save' ? 'form.save' : 'form.cancel')
  const { glyphs, colors, fold } = useTerminal()
  const color = focused ? colors.focus : kind === 'save' ? colors.tone.success : undefined
  return (
    <Box>
      <Text color={color} bold={focused}>
        {focusGutter(glyphs, focused)}
        {fold(label)}
      </Text>
    </Box>
  )
}
