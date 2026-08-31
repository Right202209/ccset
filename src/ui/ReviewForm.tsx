import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { FieldSpec, FieldValue, FormScreen, FormValues } from '../types.js'
import { t } from '../i18n/index.js'
import { FieldRow } from './Field.js'
import { focusGutter, useTerminal } from './terminal.js'
import { helpFor } from './keymap.js'

type Row =
  | { kind: 'field'; field: FieldSpec }
  | { kind: 'advanced' }
  | { kind: 'save' }
  | { kind: 'cancel' }

interface ReviewFormProps {
  screen: FormScreen
  active?: boolean
  onSubmit: (values: FormValues) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}

function textOf(value: FieldValue | undefined): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

function validateAll(fields: FieldSpec[], values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const raw = textOf(values[field.id])
    const missing = field.required === true && raw.trim().length === 0
    if (missing) errors[field.id] = 'validate.required'
    else if (field.validate !== undefined) {
      const problem = field.validate(raw)
      if (problem !== null) errors[field.id] = problem
    }
  }
  return errors
}

function buildRows(fields: FieldSpec[], showAdvanced: boolean): Row[] {
  const visible = fields.filter((field) => field.advanced !== true || showAdvanced)
  const rows: Row[] = visible.map((field) => ({ kind: 'field', field }))
  if (fields.some((field) => field.advanced === true)) rows.push({ kind: 'advanced' })
  rows.push({ kind: 'save' }, { kind: 'cancel' })
  return rows
}

/**
 * Row position of a field, not its index in the manifest: with advanced fields
 * collapsed the two only coincide while every advanced field happens to sit at
 * the end of the list.
 */
function rowIndexOf(target: FieldSpec, fields: FieldSpec[], showAdvanced: boolean): number {
  const visible = fields.filter((field) => field.advanced !== true || showAdvanced)
  return Math.max(0, visible.indexOf(target))
}

export function ReviewForm({
  screen,
  active = true,
  onSubmit,
  onCancel,
  onDirtyChange,
}: ReviewFormProps): React.ReactElement {
  const [values, setValues] = useState<FormValues>({ ...screen.values })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [index, setIndex] = useState(0)

  const rows = useMemo(() => buildRows(screen.fields, showAdvanced), [screen.fields, showAdvanced])
  const row = rows[Math.min(index, rows.length - 1)]
  const editing = row?.kind === 'field' && isTextual(row.field)

  useEffect(() => {
    const dirty = screen.fields.some(
      (field) => textOf(values[field.id]) !== textOf(screen.values[field.id]),
    )
    onDirtyChange(dirty)
  }, [values, screen, onDirtyChange])

  function move(delta: number): void {
    setIndex((current) => (current + delta + rows.length) % rows.length)
  }

  function update(field: FieldSpec, next: FieldValue): void {
    setValues((current) => ({ ...current, [field.id]: next }))
    setErrors((current) => ({ ...current, [field.id]: '' }))
  }

  function cycle(field: FieldSpec, delta: number): void {
    if (field.type === 'boolean') {
      update(field, values[field.id] !== true)
      return
    }
    const choices = field.choices ?? []
    if (choices.length === 0) return
    const current = choices.findIndex((choice) => choice.value === textOf(values[field.id]))
    const next = choices[(current + delta + choices.length) % choices.length]
    if (next !== undefined) update(field, next.value)
  }

  function save(): void {
    const found = validateAll(screen.fields, values)
    setErrors(found)
    const firstBad = screen.fields.find((field) => found[field.id] !== undefined)
    if (firstBad === undefined) {
      onSubmit(values)
      return
    }
    // An invalid field the user cannot see is an invalid field they cannot fix.
    const reveal = showAdvanced || firstBad.advanced === true
    if (firstBad.advanced === true) setShowAdvanced(true)
    setIndex(rowIndexOf(firstBad, screen.fields, reveal))
  }

  function activate(): void {
    if (row === undefined) return
    if (row.kind === 'advanced') setShowAdvanced((current) => !current)
    else if (row.kind === 'save') save()
    else if (row.kind === 'cancel') onCancel()
    else if (isTextual(row.field)) move(1)
    else cycle(row.field, 1)
  }

  useInput(
    (input, key) => {
      if (key.upArrow) move(-1)
      else if (key.downArrow || key.tab) move(1)
      else if (key.return) activate()
      else if (editing) return
      else if (key.leftArrow) cycleFocused(-1)
      else if (key.rightArrow || input === ' ') cycleFocused(1)
    },
    { isActive: active },
  )

  function cycleFocused(delta: number): void {
    if (row?.kind === 'field') cycle(row.field, delta)
  }

  const { fold } = useTerminal()

  return (
    <Box flexDirection="column">
      <FormNotes notes={screen.notes} />
      {rows.map((current, position) => (
        <FormRow
          key={rowKey(current, position)}
          row={current}
          focused={active && position === index}
          state={{ values, errors, baseline: screen.baseline, showAdvanced }}
          onChange={update}
        />
      ))}
      <Box marginTop={1}>
        <Text dimColor>{fold(helpFor('form'))}</Text>
      </Box>
    </Box>
  )
}

function isTextual(field: FieldSpec): boolean {
  return field.type === 'text' || field.type === 'secret' || field.type === 'csv'
}

function rowKey(row: Row, position: number): string {
  return row.kind === 'field' ? row.field.id : `${row.kind}-${position}`
}

function FormNotes({ notes }: { notes?: string[] }): React.ReactElement | null {
  // Above the early return: a hook called once per note, or not at all, changes
  // the hook count between renders.
  const { fold } = useTerminal()
  if (notes === undefined || notes.length === 0) return null
  return (
    <Box flexDirection="column" marginBottom={1}>
      {notes.map((note) => (
        <Text key={note} dimColor>
          {fold(note)}
        </Text>
      ))}
    </Box>
  )
}

interface FormRowProps {
  row: Row
  focused: boolean
  state: {
    values: FormValues
    errors: Record<string, string>
    baseline: FormValues
    showAdvanced: boolean
  }
  onChange: (field: FieldSpec, next: FieldValue) => void
}

function FormRow({ row, focused, state, onChange }: FormRowProps): React.ReactElement {
  if (row.kind === 'field') {
    const error = state.errors[row.field.id]
    return (
      <FieldRow
        field={row.field}
        value={state.values[row.field.id] ?? ''}
        focused={focused}
        changed={textOf(state.values[row.field.id]) !== textOf(state.baseline[row.field.id])}
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
    <Box marginTop={kind === 'advanced' ? 1 : 0}>
      <Text color={color} bold={focused}>
        {focusGutter(glyphs, focused)}
        {fold(label)}
      </Text>
    </Box>
  )
}
