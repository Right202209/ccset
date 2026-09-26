import { useEffect, useMemo, useState } from 'react'
import { useInput, type Key } from 'ink'
import type { FieldSpec, FieldValue, FormScreen, FormValues } from '../types.js'
import { fieldHints, type FieldHint } from './Field.js'
import { pressed } from './keymap.js'
import { useViewport, windowAround } from './Viewport.js'

export type ReviewRow =
  | { kind: 'field'; field: FieldSpec }
  | { kind: 'advanced' }
  | { kind: 'save' }
  | { kind: 'cancel' }

/**
 * Below either size the form drops its notes: they are context, and the rows
 * are better spent on fields. The Viewport is the main Panel's interior, so
 * the frame, the path, and the key help are already paid for.
 */
const COMPACT_ROWS = 10
const COMPACT_COLUMNS = 54
const NOTES_MARGIN_ROWS = 1
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

/** The value a choice or boolean field cycles to; undefined when there is none. */
function nextChoice(field: FieldSpec, current: FieldValue | undefined, delta: number): FieldValue | undefined {
  if (field.type === 'boolean') return current !== true
  const choices = field.choices ?? []
  const at = choices.findIndex((choice) => choice.value === textOf(current))
  return choices[(at + delta + choices.length) % choices.length]?.value
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

function useFormLayout({ screen, rows, errors, index }: LayoutOptions) {
  const viewport = useViewport()
  const row = rows[Math.min(index, rows.length - 1)]
  const compact = viewport.rows < COMPACT_ROWS || viewport.columns < COMPACT_COLUMNS
  const notesRows = compact || screen.notes?.length === undefined
    ? 0
    : screen.notes.length + NOTES_MARGIN_ROWS
  const contentRows = Math.max(1, viewport.rows - notesRows)
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

type FormCommand =
  | { kind: 'save' }
  | { kind: 'move'; delta: number }
  | { kind: 'activate' }
  | { kind: 'cycle'; field: FieldSpec; delta: number }

/** Keys every row answers the same way, checked before a textual row can claim a letter. */
function navigationCommand(input: string, key: Key): FormCommand | null {
  if (pressed(input, key).includes('ctrl+s')) return { kind: 'save' }
  if (key.upArrow) return { kind: 'move', delta: -1 }
  if (key.downArrow || key.tab) return { kind: 'move', delta: 1 }
  if (key.return) return { kind: 'activate' }
  return null
}

function letterMove(input: string): FormCommand | null {
  if (input === 'k') return { kind: 'move', delta: -1 }
  if (input === 'j') return { kind: 'move', delta: 1 }
  return null
}

/**
 * The keymap's form entry promises k/j; textual rows claim every other key
 * first, so the letters keep typing into them and only move on rows where
 * they cannot be text.
 */
function rowCommand(input: string, key: Key, row: ReviewRow | undefined): FormCommand | null {
  if (row?.kind !== 'field') return letterMove(input)
  if (isTextual(row.field)) return null
  if (key.leftArrow) return { kind: 'cycle', field: row.field, delta: -1 }
  if (key.rightArrow || input === ' ') return { kind: 'cycle', field: row.field, delta: 1 }
  return letterMove(input)
}

interface InputActions {
  save: () => void
  move: (delta: number) => void
  activate: () => void
  cycle: (field: FieldSpec, delta: number) => void
}

function runCommand(command: FormCommand, actions: InputActions): void {
  if (command.kind === 'save') actions.save()
  else if (command.kind === 'move') actions.move(command.delta)
  else if (command.kind === 'activate') actions.activate()
  else actions.cycle(command.field, command.delta)
}

function useFormInput(active: boolean, row: ReviewRow | undefined, actions: InputActions): void {
  useInput((input, key) => {
    const command = navigationCommand(input, key) ?? rowCommand(input, key, row)
    if (command !== null) runCommand(command, actions)
  }, { isActive: active })
}

interface RowActions {
  toggleAdvanced: () => void
  save: () => void
  cancel: () => void
  move: (delta: number) => void
  cycle: (field: FieldSpec, delta: number) => void
}

/** Enter on a row: the controls do what they say, a text field moves on, a choice cycles. */
function activateRow(row: ReviewRow | undefined, actions: RowActions): void {
  if (row?.kind === 'advanced') actions.toggleAdvanced()
  else if (row?.kind === 'save') actions.save()
  else if (row?.kind === 'cancel') actions.cancel()
  else if (row?.kind === 'field' && isTextual(row.field)) actions.move(1)
  else if (row?.kind === 'field') actions.cycle(row.field, 1)
}

export function useReviewForm(options: ControllerOptions) {
  const { screen, active, onSubmit, onCancel, onDirtyChange } = options
  const [values, setValues] = useState<FormValues>({ ...screen.values })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [index, setIndex] = useState(0)
  const rows = useMemo(() => buildRows(screen.fields, showAdvanced), [screen.fields, showAdvanced])
  const row = rows[Math.min(index, rows.length - 1)]
  const layout = useFormLayout({ screen, rows, errors, index })
  useDirtyState(screen, values, onDirtyChange)

  function move(delta: number): void {
    setIndex((current) => (current + delta + rows.length) % rows.length)
  }

  function update(field: FieldSpec, next: FieldValue): void {
    setValues((current) => ({ ...current, [field.id]: next }))
    setErrors((current) => ({ ...current, [field.id]: '' }))
  }

  function cycle(field: FieldSpec, delta: number): void {
    const next = nextChoice(field, values[field.id], delta)
    if (next !== undefined) update(field, next)
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

  const activate = (): void => activateRow(row, { toggleAdvanced, save, cancel: onCancel, move, cycle })
  useFormInput(active, row, { save, move, activate, cycle })

  return { values, errors, showAdvanced, index, ...layout, update }
}
