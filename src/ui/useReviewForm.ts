import { useEffect, useMemo, useState } from 'react'
import { useInput } from 'ink'
import type { FieldSpec, FieldValue, FormScreen, FormValues } from '../types.js'
import { fieldHints, type FieldHint } from './Field.js'
import { pressed } from './keymap.js'
import { useViewport, windowAround } from './Viewport.js'

export type ReviewRow =
  | { kind: 'field'; field: FieldSpec }
  | { kind: 'advanced' }
  | { kind: 'save' }
  | { kind: 'cancel' }

const COMPACT_ROWS = 16
const COMPACT_COLUMNS = 60
const SCREEN_CHROME_ROWS = 5
const NOTES_MARGIN_ROWS = 1
const FORM_FOOTER_ROWS = 2
const FORM_WINDOW_ROWS = 2

export function textOf(value: FieldValue | undefined): string {
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

function buildRows(fields: FieldSpec[], showAdvanced: boolean): ReviewRow[] {
  const visible = fields.filter((field) => field.advanced !== true || showAdvanced)
  const rows: ReviewRow[] = visible.map((field) => ({ kind: 'field', field }))
  if (fields.some((field) => field.advanced === true)) rows.push({ kind: 'advanced' })
  rows.push({ kind: 'save' }, { kind: 'cancel' })
  return rows
}

function formHints(row: ReviewRow | undefined, errors: Record<string, string>): FieldHint[] {
  if (row?.kind !== 'field') return []
  const error = errors[row.field.id]
  return fieldHints(row.field, error !== undefined && error.length > 0 ? error : undefined)
}

function prioritizeHints(hints: FieldHint[]): FieldHint[] {
  const error = hints.find((hint) => hint.tone === 'error')
  return error === undefined ? hints : [error, ...hints.filter((hint) => hint !== error)]
}

function rowIndexOf(target: FieldSpec, fields: FieldSpec[], showAdvanced: boolean): number {
  const visible = fields.filter((field) => field.advanced !== true || showAdvanced)
  return Math.max(0, visible.indexOf(target))
}

function isTextual(field: FieldSpec): boolean {
  return field.type === 'text' || field.type === 'secret' || field.type === 'csv'
}

interface ControllerOptions {
  screen: FormScreen
  active: boolean
  onSubmit: (values: FormValues) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}

interface LayoutOptions {
  screen: FormScreen
  rows: ReviewRow[]
  errors: Record<string, string>
  index: number
}

function formLayout({ screen, rows, errors, index }: LayoutOptions) {
  const viewport = useViewport()
  const row = rows[Math.min(index, rows.length - 1)]
  const compact = viewport.rows < COMPACT_ROWS || viewport.columns < COMPACT_COLUMNS
  const notesRows = compact || screen.notes?.length === undefined
    ? 0
    : screen.notes.length + NOTES_MARGIN_ROWS
  const footerRows = compact ? 0 : FORM_FOOTER_ROWS
  const contentRows = Math.max(1, viewport.rows - SCREEN_CHROME_ROWS - notesRows - footerRows)
  const hints = prioritizeHints(formHints(row, errors))
  const visibleHints = hints.slice(0, contentRows - Math.min(FORM_WINDOW_ROWS, contentRows))
  const rowBudget = contentRows - visibleHints.length
  return { compact, visibleHints, rowBudget, window: windowAround(rows, index, rowBudget) }
}

function useDirtyState(
  screen: FormScreen,
  values: FormValues,
  onDirtyChange: (dirty: boolean) => void,
): void {
  useEffect(() => {
    const dirty = screen.fields.some((field) => textOf(values[field.id]) !== textOf(screen.values[field.id]))
    onDirtyChange(dirty)
  }, [values, screen, onDirtyChange])
}

interface InputActions {
  save: () => void
  move: (delta: number) => void
  activate: () => void
  cycle: (field: FieldSpec, delta: number) => void
}

function useFormInput(active: boolean, row: ReviewRow | undefined, actions: InputActions): void {
  useInput((input, key) => {
    if (pressed(input, key).includes('ctrl+s')) actions.save()
    else if (key.upArrow) actions.move(-1)
    else if (key.downArrow || key.tab) actions.move(1)
    else if (key.return) actions.activate()
    else if (row?.kind === 'field' && isTextual(row.field)) return
    else if (key.leftArrow && row?.kind === 'field') actions.cycle(row.field, -1)
    else if ((key.rightArrow || input === ' ') && row?.kind === 'field') actions.cycle(row.field, 1)
  }, { isActive: active })
}

export function useReviewForm(options: ControllerOptions) {
  const { screen, active, onSubmit, onCancel, onDirtyChange } = options
  const [values, setValues] = useState<FormValues>({ ...screen.values })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [index, setIndex] = useState(0)
  const rows = useMemo(() => buildRows(screen.fields, showAdvanced), [screen.fields, showAdvanced])
  const row = rows[Math.min(index, rows.length - 1)]
  const layout = formLayout({ screen, rows, errors, index })
  useDirtyState(screen, values, onDirtyChange)

  function move(delta: number): void {
    setIndex((current) => (current + delta + rows.length) % rows.length)
  }

  function update(field: FieldSpec, next: FieldValue): void {
    setValues((current) => ({ ...current, [field.id]: next }))
    setErrors((current) => ({ ...current, [field.id]: '' }))
  }

  function cycle(field: FieldSpec, delta: number): void {
    if (field.type === 'boolean') return update(field, values[field.id] !== true)
    const choices = field.choices ?? []
    const current = choices.findIndex((choice) => choice.value === textOf(values[field.id]))
    const next = choices[(current + delta + choices.length) % choices.length]
    if (next !== undefined) update(field, next.value)
  }

  function save(): void {
    const found = validateAll(screen.fields, values)
    setErrors(found)
    const firstBad = screen.fields.find((field) => found[field.id] !== undefined)
    if (firstBad === undefined) return onSubmit(values)
    const reveal = showAdvanced || firstBad.advanced === true
    if (firstBad.advanced === true) setShowAdvanced(true)
    setIndex(rowIndexOf(firstBad, screen.fields, reveal))
  }

  function toggleAdvanced(): void {
    const next = !showAdvanced
    setShowAdvanced(next)
    setIndex(screen.fields.filter((field) => field.advanced !== true || next).length)
  }

  function activate(): void {
    if (row?.kind === 'advanced') toggleAdvanced()
    else if (row?.kind === 'save') save()
    else if (row?.kind === 'cancel') onCancel()
    else if (row?.kind === 'field' && isTextual(row.field)) move(1)
    else if (row?.kind === 'field') cycle(row.field, 1)
  }

  useFormInput(active, row, { save, move, activate, cycle })

  return { values, errors, showAdvanced, index, ...layout, update }
}
