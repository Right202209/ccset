import React from 'react'
import { Box, Text } from 'ink'
import type { FieldSpec, FormScreen } from '../../src/types.js'
import { ReviewForm } from '../../src/ui/ReviewForm.js'
import { Controls, Notes, Row, Shell, type RowLayout } from './elements.js'
import {
  BASELINE_HINT_INDENT,
  BASELINE_LABEL_WIDTH,
  PANEL_CHROME,
  TIGHT_HINT_INDENT,
  labelCellWidth,
  visibleFields,
} from './layout.js'
import type { Subject } from './subjects.js'

/**
 * Three treatments and the baseline they are judged against. Each one is the
 * same elements under a different enclosure and a different pair of layout
 * numbers, so what a reader compares here is only what actually differs.
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

export interface Treatment {
  id: string
  label: string
  /** The two numbers this treatment chooses, for the measurement table. */
  metrics: (props: TreatmentProps) => RowLayout
  render: (props: TreatmentProps) => React.ReactElement
  /** Columns the enclosure takes off a row before the row gets any. */
  chrome: number
  /**
   * The baseline is evidence rather than a candidate: it is what the interface
   * paints today, so it is reported rather than required to fit.
   */
  candidate: boolean
}

function tightLayout({ subject, showAdvanced }: TreatmentProps): RowLayout {
  return {
    labelCell: labelCellWidth(visibleFields(subject.fields, showAdvanced)),
    hintIndent: TIGHT_HINT_INDENT,
  }
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

/* ----------------------------------------------------------- the baseline */

function baselineScreen(subject: Subject): FormScreen {
  return {
    kind: 'form',
    title: subject.title,
    fields: subject.fields,
    values: subject.state.values,
    baseline: subject.state.baseline,
    notes: subject.notes,
    submit: async () => ({ kind: 'message', title: '', lines: [], tone: 'info' }),
  }
}

/**
 * The real `ReviewForm`, unmodified, so nobody has to take the baseline on
 * trust. Two consequences of using the real component: its focus starts on row
 * one rather than on the row the treatments focus, and its Advanced state is
 * internal, so there is no static expanded paint to take. The baseline is
 * therefore shown collapsed only -- its geometry is the point, and the fixed
 * label column and hint indent are visible in every row of it.
 */
function BaselineTreatment({ subject }: TreatmentProps): React.ReactElement {
  return (
    <Shell subject={subject}>
      <ReviewForm
        screen={baselineScreen(subject)}
        onSubmit={() => {}}
        onCancel={() => {}}
        onDirtyChange={() => {}}
      />
    </Shell>
  )
}

/* ------------------------------------------------- A: tightened flat rows */

/**
 * Today's layout with both numbers changed and nothing else: the label column is
 * measured against the labels on screen, and the hint clears the focus gutter
 * instead of clearing the whole label column.
 */
function FlatTreatment(props: TreatmentProps): React.ReactElement {
  const layout = tightLayout(props)
  const visible = visibleFields(props.subject.fields, props.showAdvanced)
  return (
    <Shell subject={props.subject}>
      <Notes subject={props.subject} />
      <Rows fields={visible} subject={props.subject} layout={layout} />
      <Controls subject={props.subject} showAdvanced={props.showAdvanced} />
    </Shell>
  )
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
  const basic = subject.fields.filter((field) => field.advanced !== true)
  const advanced = subject.fields.filter((field) => field.advanced === true)
  return (
    <Shell subject={subject}>
      <Notes subject={subject} />
      <Group title={GROUP_BASIC} fields={basic} subject={subject} />
      {showAdvanced && advanced.length > 0 && (
        <Group title={GROUP_ADVANCED} fields={advanced} subject={subject} />
      )}
      <Controls subject={subject} showAdvanced={showAdvanced} />
    </Shell>
  )
}

/** Groups measure their own label column, so report the one the basic group has. */
function groupedMetrics({ subject }: TreatmentProps): RowLayout {
  const basic = subject.fields.filter((field) => field.advanced !== true)
  return { labelCell: labelCellWidth(basic), hintIndent: TIGHT_HINT_INDENT }
}

export const BASELINE: Treatment = {
  id: 'baseline',
  label: 'Baseline — today',
  metrics: () => ({ labelCell: BASELINE_LABEL_WIDTH, hintIndent: BASELINE_HINT_INDENT }),
  render: BaselineTreatment,
  chrome: 0,
  candidate: false,
}

export const TREATMENTS: Treatment[] = [
  BASELINE,
  {
    id: 'a',
    label: 'A — tightened flat',
    metrics: tightLayout,
    render: FlatTreatment,
    chrome: 0,
    candidate: true,
  },
  {
    id: 'b',
    label: 'B — single panel',
    metrics: tightLayout,
    render: PanelTreatment,
    chrome: PANEL_CHROME,
    candidate: true,
  },
  {
    id: 'c',
    label: 'C — grouped panels',
    metrics: groupedMetrics,
    render: GroupedTreatment,
    chrome: PANEL_CHROME,
    candidate: true,
  },
]
