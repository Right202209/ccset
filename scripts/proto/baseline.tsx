import React from 'react'
import type { FormScreen } from '../../src/types.js'
import { ReviewForm } from '../../src/ui/ReviewForm.js'
import { Shell } from './elements.js'
import { BASELINE_HINT_INDENT, BASELINE_LABEL_WIDTH } from './layout.js'
import type { Subject } from './subjects.js'

/**
 * The baseline: what the interface paints today. It lives apart from the three
 * candidates because it is not one of them -- it is the real `src/ui/ReviewForm`
 * mounted unmodified, so nobody has to take the comparison on trust, and none of
 * the prototype's own layout code runs inside it.
 *
 * Prototype code for issue #9.
 */

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
 * Two consequences of using the real component: its focus starts on row one
 * rather than on the row the treatments focus, and its Advanced state is internal,
 * so there is no static expanded paint to take. The baseline is therefore shown
 * collapsed only -- its geometry is the point, and the fixed label column and
 * hint indent are visible in every row of it.
 */
export function BaselineRender({ subject }: { subject: Subject }): React.ReactElement {
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

/** The two numbers `Field.tsx` hardcodes, reported for the measurement table. */
export const BASELINE_METRICS = {
  labelCell: BASELINE_LABEL_WIDTH,
  hintIndent: BASELINE_HINT_INDENT,
}
