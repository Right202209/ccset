import assert from 'node:assert/strict'
import { PROVIDER_FIELDS } from '../../src/agents/claude-code/manifest.js'
import { maskSecret } from '../../src/core/mask.js'
import { t } from '../../src/i18n/index.js'
import {
  APP_PADDING,
  BASELINE_HINT_INDENT,
  BASELINE_LABEL_WIDTH,
  CHANGED_WIDTH,
  LABEL_GAP,
  MARKER_WIDTH,
  TIGHT_HINT_INDENT,
  advancedFields,
  basicFields,
  hintBudget,
  isAdvanced,
  labelCellWidth,
  labelColumnWidth,
  screenColumns,
  valueColumn,
  visibleFields,
} from './layout.js'

/**
 * The prototype's gate. Two kinds of claim are checked: the layout arithmetic
 * the recommendation quotes, and a property of every render it writes out.
 *
 * Prototype code for issue #9.
 */

const ANSI = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g

/** Carried by every focusable row, as `verify-ui-render` names it. */
const FOCUS_MARKER = '❯'
/** Fields not behind the Advanced toggle, in the provider form. */
const PROVIDER_BASIC_FIELDS = 4
const WIDE_COLUMNS = 80
const NARROW_COLUMNS = 60
/**
 * The hint budget today, at 80 columns: the Screen keeps 78 of them and the
 * 36-column indent takes all but 42. This is the symptom issue #18 names, and it
 * has to be measured against the Screen rather than the terminal -- the App's
 * padding is gone before a hint is painted.
 */
const BASELINE_HINT_BUDGET_AT_80 = 42

export function plain(paint: string): string {
  return paint.replace(ANSI, '')
}

function checkScreenColumns(): void {
  const lost = APP_PADDING * 2
  assert.equal(screenColumns(WIDE_COLUMNS), WIDE_COLUMNS - lost, 'A Screen loses a column per edge')
  assert.equal(screenColumns(NARROW_COLUMNS), NARROW_COLUMNS - lost, 'At every width, the same')
}

function checkVisibleFields(): void {
  const collapsed = visibleFields(PROVIDER_FIELDS, false)
  const expanded = visibleFields(PROVIDER_FIELDS, true)
  assert.equal(collapsed.length, PROVIDER_BASIC_FIELDS, 'Collapsed shows only the basic fields')
  assert.equal(expanded.length, PROVIDER_FIELDS.length, 'Expanded shows every field')
  assert.ok(
    collapsed.every((field) => !isAdvanced(field)),
    'A collapsed form must not paint an advanced field',
  )
}

/**
 * The measured column is a property of what is on screen, so expanding the
 * advanced fields is what widens it -- and even expanded it stays inside the
 * fixed column the interface hardcodes today.
 */
function checkLabelColumnWidth(): void {
  const collapsed = labelColumnWidth(visibleFields(PROVIDER_FIELDS, false))
  const expanded = labelColumnWidth(visibleFields(PROVIDER_FIELDS, true))
  assert.equal(collapsed, t('field.providerName').length, 'Collapsed, "Provider name" is longest')
  assert.equal(expanded, t('field.defaultSonnetModel').length, 'Expanded, "Sonnet model remap" is')
  assert.ok(collapsed < expanded, 'Expanding the advanced fields widens the label column')
  assert.ok(expanded < BASELINE_LABEL_WIDTH, 'Even expanded, the form fits inside today s column')
  assert.equal(labelColumnWidth([]), 0, 'A form with no visible field has no label column')
}

/** A measured column has to earn back the gap today's fixed one had by accident. */
function checkLabelCell(): void {
  const collapsed = visibleFields(PROVIDER_FIELDS, false)
  assert.equal(labelCellWidth(collapsed), labelColumnWidth(collapsed) + LABEL_GAP)
  assert.equal(valueColumn(collapsed), MARKER_WIDTH + labelCellWidth(collapsed) + CHANGED_WIDTH)
  assert.ok(
    valueColumn(collapsed) < MARKER_WIDTH + BASELINE_LABEL_WIDTH + CHANGED_WIDTH,
    'A measured label column has to start the value earlier than the fixed one does',
  )
}

function checkHintBudget(): void {
  const screen = screenColumns(WIDE_COLUMNS)
  assert.equal(
    hintBudget(screen, BASELINE_HINT_INDENT),
    BASELINE_HINT_BUDGET_AT_80,
    'Today a hint gets 42 of a Screen s 78 columns; that is the number #18 has to move',
  )
  assert.ok(
    hintBudget(screen, TIGHT_HINT_INDENT) > hintBudget(screen, BASELINE_HINT_INDENT),
    'A tightened hint must end up with more room than today s',
  )
}

/** The split has to be a partition; two callers computing it apart is how C's
 *  advanced label column went unreported in the measurement table. */
function checkAdvancedSplit(): void {
  const basic = basicFields(PROVIDER_FIELDS)
  const advanced = advancedFields(PROVIDER_FIELDS)
  assert.equal(basic.length + advanced.length, PROVIDER_FIELDS.length, 'Every field lands once')
  assert.deepEqual(basic, visibleFields(PROVIDER_FIELDS, false), 'Collapsed paints the basic split')
}

/**
 * The variant the recommendation puts to #18: measured across every field the
 * form declares, the value column does not move when Advanced expands. It is a
 * candidate here rather than a note, so the claim has a paint behind it.
 */
function checkStableLabelColumn(): void {
  const stable = labelCellWidth(PROVIDER_FIELDS)
  const collapsed = labelCellWidth(visibleFields(PROVIDER_FIELDS, false))
  const expanded = labelCellWidth(visibleFields(PROVIDER_FIELDS, true))
  assert.equal(stable, expanded, 'Expanded, the visible measurement already is the stable one')
  assert.ok(stable > collapsed, 'Stability costs columns while collapsed; that is the whole trade')
}

/** The layout arithmetic, checked before anything is rendered or written. */
export function checkLayout(): void {
  checkScreenColumns()
  checkVisibleFields()
  checkAdvancedSplit()
  checkLabelColumnWidth()
  checkLabelCell()
  checkStableLabelColumn()
  checkHintBudget()
}

/** The widest painted line, which is how a render's fit gets reported. */
export function widestLine(paint: string): number {
  return plain(paint)
    .split('\n')
    .reduce((widest, line) => Math.max(widest, line.length), 0)
}

/**
 * No painted line may run past the terminal. A treatment that overflows is not a
 * treatment with a wrapping bug -- the terminal hard-wraps it and the border it
 * drew comes apart, which is the failure the 60-column render exists to find.
 */
export function checkFits(label: string, paint: string, columns: number): void {
  for (const [index, line] of plain(paint).split('\n').entries()) {
    assert.ok(
      line.length <= columns,
      `${label}: line ${index + 1} runs to ${line.length} of ${columns} columns:\n${line}`,
    )
  }
}

/**
 * Focus is single-valued, as `verify-ui-render` asserts of the real interface:
 * the marker says where Enter lands, so two of them would be two answers. These
 * paints all focus a field, so each carries exactly one.
 */
export function checkSingleFocus(label: string, paint: string): void {
  const markers = plain(paint).split(FOCUS_MARKER).length - 1
  assert.equal(markers, 1, `${label}: ${markers} rows carry the focus marker:\n${plain(paint)}`)
}

/** The masking invariant, restated for a render that gets written to a file. */
export function checkSecretMasked(label: string, paint: string, secret: string): void {
  const text = plain(paint)
  assert.equal(text.includes(secret), false, `${label}: the secret reached a render:\n${text}`)
  assert.ok(text.includes(maskSecret(secret)), `${label}: no masked secret, so nothing was masked`)
}
