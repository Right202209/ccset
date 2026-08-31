import type { FieldSpec } from '../../src/types.js'
import { t } from '../../src/i18n/index.js'

/**
 * Layout metrics shared by the three treatments, kept pure so the numbers the
 * recommendation quotes come from the same source the renders do.
 *
 * Prototype code for issue #9. Nothing here is imported by src/.
 */

/** `'❯ '` or two spaces: every row reserves the focus gutter. */
export const MARKER_WIDTH = 2
/** `'* '` or two spaces: the changed marker sits between label and value. */
export const CHANGED_WIDTH = 2
/**
 * One column between the label and the changed marker. Today's fixed 30-column
 * label leaves slack by accident; a measured column has none, and a longest
 * label would otherwise butt straight against the marker.
 */
export const LABEL_GAP = 1
/** `App.tsx` wraps every Screen in `padding={1}`, so no Screen gets the terminal. */
export const APP_PADDING = 1

/** What `src/ui/Field.tsx` does today: a fixed label column, and a hint past it. */
export const BASELINE_LABEL_WIDTH = 30
export const BASELINE_HINT_GAP = 6
export const BASELINE_HINT_INDENT = BASELINE_LABEL_WIDTH + BASELINE_HINT_GAP

/** A tightened hint clears the focus gutter and stops. */
export const TIGHT_HINT_INDENT = MARKER_WIDTH + 2

/** A bordered panel costs one border column and one padding column per side. */
export const PANEL_CHROME = 4

/** Columns left to a Screen once the App's padding is taken off both edges. */
export function screenColumns(columns: number): number {
  return columns - APP_PADDING * 2
}

/** The rows a form actually paints; advanced fields hide until expanded. */
export function visibleFields(fields: FieldSpec[], showAdvanced: boolean): FieldSpec[] {
  return fields.filter((field) => field.advanced !== true || showAdvanced)
}

/**
 * The label column, sized to the longest label that is on screen rather than to
 * the longest one the manifest declares.
 *
 * English is the only catalog, so a label's code units are its display columns.
 * A CJK catalog would have to measure display width instead -- see the
 * recommendation, because the implementation ticket inherits that.
 */
export function labelColumnWidth(fields: FieldSpec[]): number {
  return fields.reduce((widest, field) => Math.max(widest, t(field.labelKey).length), 0)
}

/** Columns a hint has to itself, given the indent it is printed at. */
export function hintBudget(columns: number, indent: number): number {
  return columns - indent
}

/** The label column as a row actually reserves it: the measurement plus the gap. */
export function labelCellWidth(fields: FieldSpec[]): number {
  return labelColumnWidth(fields) + LABEL_GAP
}

/** Where the value column starts, once the gutters in front of it are counted. */
export function valueColumn(fields: FieldSpec[]): number {
  return MARKER_WIDTH + labelCellWidth(fields) + CHANGED_WIDTH
}
