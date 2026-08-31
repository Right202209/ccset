import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { FieldSpec, FieldValue, FormScreen, FormValues } from '../types.js'
import { t } from '../i18n/index.js'
import { FieldRow, fieldHints } from './Field.js'
import { focusGutter, useTerminal } from './terminal.js'
import { helpFor, pressed } from './keymap.js'
import { useViewport, WindowRegion, windowAround } from './Viewport.js'

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
  const viewport = useViewport()
  const { colors, fold } = useTerminal()

  const rows = useMemo(() => buildRows(screen.fields, showAdvanced), [screen.fields, showAdvanced])
  const compact = viewport.rows < 16 || viewport.columns < 60
  const row = rows[Math.min(index, rows.length - 1)]
  const hint = formHint(row, errors)
  const noteCount = screen.notes?.length ?? 0
  const notesRows = compact || noteCount === 0 ? 0 : noteCount + 1
  const footerRows = compact ? 0 : 2
  const hintRows = hint === null ? 0 : 1
  const rowBudget = Math.max(2, viewport.rows - 5 - notesRows - footerRows - hintRows)
  const window = windowAround(rows, index, rowBudget)
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
      if (pressed(input, key).includes('ctrl+s')) save()
      else if (key.upArrow) move(-1)
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

  return (
    <Box flexDirection="column">
      {!compact && <FormNotes notes={screen.notes} />}
      <WindowRegion window={window} rows={rowBudget}>
        {window.items.map((current, visiblePosition) => {
          const position = window.start + visiblePosition
          return (
            <Box
              key={rowKey(current, position)}
              height={1}
              overflow="hidden"
            >
              <FormRow
                row={current}
                focused={active && position === index}
                state={{ values, errors, baseline: screen.baseline, showAdvanced }}
                onChange={update}
              />
            </Box>
          )
        })}
      </WindowRegion>
      {hint !== null && (
        <Box height={1} overflow="hidden">
          <Text
            color={hint.tone === undefined ? undefined : colors.tone[hint.tone]}
            dimColor={hint.tone === undefined}
            wrap="truncate-end"
          >
            {fold(hint.text)}
          </Text>
        </Box>
      )}
      {!compact && (
        <Box marginTop={1}>
          <Text dimColor>{fold(helpFor('form'))}</Text>
        </Box>
      )}
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

function formHint(
  row: Row | undefined,
  errors: Record<string, string>,
): ReturnType<typeof fieldHints>[number] | null {
  if (row?.kind !== 'field') return null
  const error = errors[row.field.id]
  const hints = fieldHints(row.field, error !== undefined && error.length > 0 ? error : undefined)
  return hints.find((hint) => hint.tone === 'error') ?? hints[0] ?? null
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
