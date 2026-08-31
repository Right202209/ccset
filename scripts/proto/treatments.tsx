import React from 'react'
import { Box, Text } from 'ink'
import type { FieldSpec } from '../../src/types.js'
import { BASELINE_METRICS, BaselineRender } from './baseline.js'
import { Controls, Notes, Row, Shell, type RowLayout } from './elements.js'
import {
  PANEL_CHROME,
  TIGHT_HINT_INDENT,
  advancedFields,
  basicFields,
  isAdvanced,
  labelCellWidth,
  visibleFields,
} from './layout.js'
import type { Subject } from './subjects.js'

/**
 * The candidate treatments: A, A2, B and C, plus the baseline entry that puts the
 * real component in the same table as them. Each candidate is the same elements
 * under a different enclosure and a different pair of layout numbers, so what a
 * reader compares here is only what actually differs.
 *
 * Prototype code for issue #9.
 */

/**
 * Panel titles. If treatment C wins, the implementation ticket has to add
 * `form.groupBasic` and `form.groupAdvanced` to `src/i18n/en.ts`; a literal
 * string is fine in throwaway code and would not be in shipped code.
 */
const GROUP_BASIC = 'Basic'
const GROUP_ADVANCED = 'Advanced'

export interface TreatmentProps {
  subject: Subject
  showAdvanced: boolean
}

type Measure = (props: TreatmentProps) => RowLayout

export interface Treatment {
  id: string
  label: string
  /** The two numbers this treatment chooses, for the measurement table. */
  metrics: Measure
  render: (props: TreatmentProps) => React.ReactElement
  /** Columns the enclosure takes off a row before the row gets any. */
  chrome: number
  /**
   * The baseline is evidence rather than a candidate: it is the real component,
   * so it is reported rather than required to fit its budget, and its Advanced
   * state is internal to it, so there is no static expanded paint to take.
   */
  evidence: boolean
  /**
   * Only rendered for a form that has advanced fields. A2 exists to show what
   * happens on expand, so on a form that cannot expand it is a duplicate of A.
   */
  needsExpandable: boolean
}

/** Which paints a treatment contributes for a given subject and state. */
export function appliesTo(treatment: Treatment, subject: Subject, showAdvanced: boolean): boolean {
  if (treatment.needsExpandable && !subject.fields.some(isAdvanced)) return false
  return !(treatment.evidence && showAdvanced)
}

/** A's measurement: the longest label on screen, which #9 asked for. */
function tightLayout({ subject, showAdvanced }: TreatmentProps): RowLayout {
  return {
    labelCell: labelCellWidth(visibleFields(subject.fields, showAdvanced)),
    hintIndent: TIGHT_HINT_INDENT,
  }
}

/**
 * A2's measurement: the longest label the form declares, visible or not. It pays
 * columns while collapsed and buys a value column that does not move on expand.
 */
function stableLayout({ subject }: TreatmentProps): RowLayout {
  return { labelCell: labelCellWidth(subject.fields), hintIndent: TIGHT_HINT_INDENT }
}

function Rows({
  fields,
  subject,
  layout,
}: {
  fields: FieldSpec[]
  subject: Subject
  layout: RowLayout
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      {fields.map((field) => (
        <Row key={field.id} field={field} state={subject.state} layout={layout} />
      ))}
    </Box>
  )
}

/* ------------------------------------------------- A: tightened flat rows */

/**
 * Today's geometry with both layout numbers changed: the label column is measured
 * against the labels on screen, and the hint clears the focus gutter instead of
 * clearing the whole label column.
 *
 * One thing besides the two numbers differs, and the comparison has to own it.
 * These rows carry the narrow-terminal idiom from `4e78536` -- `flexGrow` and
 * `flexShrink` with `wrap` on the value, `flexWrap` on the radios -- which
 * `Field.tsx` never got. Without it a treatment overflows at 60 columns instead
 * of folding, and there would be nothing to judge at that width. So the
 * 60-column comparison against the baseline shows two changes, not one; the
 * 80-column comparison isolates the two numbers.
 */
function flatTreatment(measure: Measure): (props: TreatmentProps) => React.ReactElement {
  return function Flat(props: TreatmentProps): React.ReactElement {
    const visible = visibleFields(props.subject.fields, props.showAdvanced)
    return (
      <Shell subject={props.subject}>
        <Notes subject={props.subject} />
        <Rows fields={visible} subject={props.subject} layout={measure(props)} />
        <Controls subject={props.subject} showAdvanced={props.showAdvanced} />
      </Shell>
    )
  }
}

/* ----------------------------------------------------- B: a single panel */

function Panel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      {children}
    </Box>
  )
}

/**
 * One enclosure around the fields, with the header, the notes and the control
 * rows all outside it. The border is what separates what the core user edits
 * from what they only read.
 */
function PanelTreatment(props: TreatmentProps): React.ReactElement {
  const layout = tightLayout(props)
  const visible = visibleFields(props.subject.fields, props.showAdvanced)
  return (
    <Shell subject={props.subject}>
      <Notes subject={props.subject} />
      <Panel>
        <Rows fields={visible} subject={props.subject} layout={layout} />
      </Panel>
      <Controls subject={props.subject} showAdvanced={props.showAdvanced} />
    </Shell>
  )
}

/* --------------------------------------------------- C: grouped panels */

function Group({
  title,
  fields,
  subject,
}: {
  title: string
  fields: FieldSpec[]
  subject: Subject
}): React.ReactElement {
  // Measured per group, which is the honest consequence of two enclosures: the
  // two label columns are two measurements and do not line up with each other.
  const layout: RowLayout = { labelCell: labelCellWidth(fields), hintIndent: TIGHT_HINT_INDENT }
  return (
    <Box flexDirection="column">
      <Text dimColor>{title}</Text>
      <Panel>
        <Rows fields={fields} subject={subject} layout={layout} />
      </Panel>
    </Box>
  )
}

/** Basic fields in one enclosure; the advanced ones get a second on expand. */
function GroupedTreatment({ subject, showAdvanced }: TreatmentProps): React.ReactElement {
  const advanced = advancedFields(subject.fields)
  return (
    <Shell subject={subject}>
      <Notes subject={subject} />
      <Group title={GROUP_BASIC} fields={basicFields(subject.fields)} subject={subject} />
      {showAdvanced && advanced.length > 0 && (
        <Group title={GROUP_ADVANCED} fields={advanced} subject={subject} />
      )}
      <Controls subject={subject} showAdvanced={showAdvanced} />
    </Shell>
  )
}

/**
 * Each group measures its own label column, so a single number cannot describe C.
 * Report the widest one on screen: while collapsed that is the basic group, and on
 * expand it is the advanced group -- and the gap between them is C's defect, so
 * the table has to show the expanded number rather than hide behind the basic one.
 */
function groupedMetrics({ subject, showAdvanced }: TreatmentProps): RowLayout {
  const groups = [basicFields(subject.fields)]
  if (showAdvanced) groups.push(advancedFields(subject.fields))
  const widest = groups
    .filter((fields) => fields.length > 0)
    .reduce((most, fields) => Math.max(most, labelCellWidth(fields)), 0)
  return { labelCell: widest, hintIndent: TIGHT_HINT_INDENT }
}

export const BASELINE: Treatment = {
  id: 'baseline',
  label: 'Baseline — today',
  metrics: () => BASELINE_METRICS,
  render: ({ subject }) => <BaselineRender subject={subject} />,
  chrome: 0,
  evidence: true,
  needsExpandable: false,
}

export const TREATMENTS: Treatment[] = [
  BASELINE,
  {
    id: 'a',
    label: 'A — tightened flat',
    metrics: tightLayout,
    render: flatTreatment(tightLayout),
    chrome: 0,
    evidence: false,
    needsExpandable: false,
  },
  {
    id: 'a2',
    label: 'A2 — tightened flat, stable label column',
    metrics: stableLayout,
    render: flatTreatment(stableLayout),
    chrome: 0,
    evidence: false,
    needsExpandable: true,
  },
  {
    id: 'b',
    label: 'B — single panel',
    metrics: tightLayout,
    render: PanelTreatment,
    chrome: PANEL_CHROME,
    evidence: false,
    needsExpandable: false,
  },
  {
    id: 'c',
    label: 'C — grouped panels',
    metrics: groupedMetrics,
    render: GroupedTreatment,
    chrome: PANEL_CHROME,
    evidence: false,
    needsExpandable: false,
  },
]
