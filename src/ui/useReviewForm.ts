import { useEffect, useMemo, useState } from 'react'
import { useInput, type Key } from 'ink'
import wrapAnsi from 'wrap-ansi'
import type { FieldSpec, FieldValue, FormScreen, FormValues } from '../types.js'
import { fieldHints, type FieldHint } from './Field.js'
import { helpFor, pressed } from './keymap.js'
import { useTerminal } from './terminal.js'
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
const HELP_MARGIN_ROWS = 1
const FORM_WINDOW_ROWS = 2

export function textOf(value: FieldValue | undefined): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

function isVisible(field: FieldSpec, values: FormValues): boolean {
  return field.hiddenWhen === undefined || values[field.hiddenWhen.fieldId] !== field.hiddenWhen.value
}

function validateAll(fields: FieldSpec[], values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    if (!isVisible(field, values)) continue
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

function buildRows(fields: FieldSpec[], showAdvanced: boolean, values: FormValues): ReviewRow[] {
  const available = fields.filter((field) => isVisible(field, values))
  const visible = available.filter((field) => field.advanced !== true || showAdvanced)
  const rows: ReviewRow[] = visible.map((field) => ({ kind: 'field', field }))
  if (available.some((field) => field.advanced === true)) rows.push({ kind: 'advanced' })
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

function rowIndexOf(
  target: FieldSpec,
  fields: FieldSpec[],
  showAdvanced: boolean,
  values: FormValues,
): number {
  const visible = fields.filter(
    (field) => isVisible(field, values) && (field.advanced !== true || showAdvanced),
  )
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

/**
 * The help line is one catalog sentence that may wrap onto several rows --
 * the zh-Hans line already does at 100 columns -- so the footer reserves what
 * it actually renders. Reserving a fixed two rows is how the form's window
 * once overflowed a 21-row terminal by one.
 */
function helpFooterRows(fold: (text: string) => string, columns: number): number {
  const text = fold(helpFor('form'))
  const lines = wrapAnsi(text, Math.max(1, columns - 2), { trim: false, hard: true })
  return lines.split('\n').length + HELP_MARGIN_ROWS
}

function useFormLayout({ screen, rows, errors, index }: LayoutOptions) {
  const viewport = useViewport()
  const { fold } = useTerminal()
  const row = rows[Math.min(index, rows.length - 1)]
  const compact = viewport.rows < COMPACT_ROWS || viewport.columns < COMPACT_COLUMNS
  const notesRows = compact || screen.notes?.length === undefined
    ? 0
    : screen.notes.length + NOTES_MARGIN_ROWS
  const footerRows = compact ? 0 : helpFooterRows(fold, viewport.columns)
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

interface FormInputEvent {
  input: string
  key: Key
  row: ReviewRow | undefined
  actions: InputActions
}

function handleNavigationKey(key: Key, actions: InputActions): boolean {
  if (key.upArrow) actions.move(-1)
  else if (key.downArrow || key.tab) actions.move(1)
  else if (key.return) actions.activate()
  else return false
  return true
}

function handleFieldKey({ input, key, row, actions }: FormInputEvent): boolean {
  if (row?.kind !== 'field') return false
  if (isTextual(row.field)) return true
  if (key.leftArrow) actions.cycle(row.field, -1)
  else if (key.rightArrow || input === ' ') actions.cycle(row.field, 1)
  else return false
  return true
}

function handleFormInput({ input, key, row, actions }: FormInputEvent): void {
  if (pressed(input, key).includes('ctrl+s')) actions.save()
  else if (handleNavigationKey(key, actions) || handleFieldKey({ input, key, row, actions })) return
  else if (input === 'k') actions.move(-1)
  else if (input === 'j') actions.move(1)
}

function useFormInput(active: boolean, row: ReviewRow | undefined, actions: InputActions): void {
  useInput((input, key) => handleFormInput({ input, key, row, actions }), { isActive: active })
}

export function useReviewForm(options: ControllerOptions) {
  const { screen, active, onSubmit, onCancel, onDirtyChange } = options
  const [values, setValues] = useState<FormValues>({ ...screen.values })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [index, setIndex] = useState(0)
  const rows = useMemo(
    () => buildRows(screen.fields, showAdvanced, values),
    [screen.fields, showAdvanced, values],
  )
  const row = rows[Math.min(index, rows.length - 1)]
  const layout = useFormLayout({ screen, rows, errors, index })
  useDirtyState(screen, values, onDirtyChange)

  function move(delta: number): void {
    setIndex((current) => (current + delta + rows.length) % rows.length)
  }

  function update(field: FieldSpec, next: FieldValue): void {
    const nextValues = { ...values, [field.id]: next }
    setValues(nextValues)
    setErrors((current) => ({ ...current, [field.id]: '' }))
    const advancedVisibility = field.advancedVisibilityWhen
    if (
      advancedVisibility !== undefined &&
      (advancedVisibility.show === next || advancedVisibility.hide === next)
    ) {
      const nextShowAdvanced = advancedVisibility.show === next
      setShowAdvanced(nextShowAdvanced)
      const nextRows = buildRows(screen.fields, nextShowAdvanced, nextValues)
      const nextIndex = nextRows.findIndex(
        (candidate) => candidate.kind === 'field' && candidate.field.id === field.id,
      )
      if (nextIndex >= 0) setIndex(nextIndex)
    }
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
    const firstBad = screen.fields.find(
      (field) => isVisible(field, values) && found[field.id] !== undefined,
    )
    if (firstBad === undefined) return onSubmit(values)
    const reveal = showAdvanced || firstBad.advanced === true
    if (firstBad.advanced === true) setShowAdvanced(true)
    setIndex(rowIndexOf(firstBad, screen.fields, reveal, values))
  }

  function toggleAdvanced(): void {
    const next = !showAdvanced
    setShowAdvanced(next)
    setIndex(
      screen.fields.filter(
        (field) => isVisible(field, values) && (field.advanced !== true || next),
      ).length,
    )
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
