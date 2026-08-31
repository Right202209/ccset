import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  checkFits,
  checkLayout,
  checkSecretMasked,
  checkSingleFocus,
  plain,
  widestLine,
} from './proto/checks.js'
import { hintBudget, screenColumns } from './proto/layout.js'
import { paintAt } from './proto/paint.js'
import { SUBJECTS, hasAdvanced, type Subject } from './proto/subjects.js'
import { TREATMENTS, type Treatment } from './proto/treatments.js'

/**
 * Issue #9: three visual treatments of the review form, rendered at 80 and 60
 * columns so they can be judged by looking rather than argued about on paper.
 *
 * Writes `docs/prototypes/review-form-renders.md` and prints the same paints in
 * colour to stdout, because a markdown code fence cannot carry them. The written
 * recommendation lives beside it, hand-written, in
 * `docs/prototypes/review-form-treatments.md`.
 *
 * Throwaway prototype code -- nothing in `src/` imports any of it.
 */

const WIDTHS = [80, 60]
const OUT_PATH = path.join('docs', 'prototypes', 'review-form-renders.md')
const FENCE = '```text'

interface Case {
  subject: Subject
  treatment: Treatment
  showAdvanced: boolean
  columns: number
}

interface Rendered {
  paint: string
  widest: number
  fits: boolean
}

function states(subject: Subject): boolean[] {
  return hasAdvanced(subject) ? [false, true] : [false]
}

function stateLabel(subject: Subject, showAdvanced: boolean): string {
  if (!hasAdvanced(subject)) return 'no advanced fields'
  return showAdvanced ? 'advanced expanded' : 'advanced collapsed'
}

function keyOf(item: Case): string {
  return [item.subject.id, String(item.showAdvanced), String(item.columns), item.treatment.id].join(
    '/',
  )
}

function labelOf(item: Case): string {
  const state = stateLabel(item.subject, item.showAdvanced)
  return `${item.subject.label} · ${state} · ${item.columns} columns · ${item.treatment.label}`
}

/** The baseline has no static expanded paint, so it appears collapsed only. */
function casesFor(subject: Subject, showAdvanced: boolean, columns: number): Case[] {
  const usable = TREATMENTS.filter((treatment) => treatment.candidate || !showAdvanced)
  return usable.map((treatment) => ({ subject, treatment, showAdvanced, columns }))
}

function buildCases(): Case[] {
  const cases: Case[] = []
  for (const subject of SUBJECTS) {
    for (const showAdvanced of states(subject)) {
      for (const columns of WIDTHS) {
        cases.push(...casesFor(subject, showAdvanced, columns))
      }
    }
  }
  return cases
}

/* ----------------------------------------------------------------- render */

async function renderCase(item: Case): Promise<Rendered> {
  const label = labelOf(item)
  const props = { subject: item.subject, showAdvanced: item.showAdvanced }
  const coloured = await paintAt(item.columns, item.treatment.render(props))
  checkSingleFocus(label, coloured)
  if (item.subject.secret !== undefined) {
    checkSecretMasked(label, coloured, item.subject.secret)
  }
  // A candidate that overflows is not a candidate. The baseline is measured
  // instead, because what it does at 60 columns is part of the evidence.
  if (item.treatment.candidate) checkFits(label, coloured, item.columns)
  process.stdout.write(`\n\x1b[1m${label}\x1b[0m\n${coloured}\n`)
  const widest = widestLine(coloured)
  return { paint: plain(coloured), widest, fits: widest <= item.columns }
}

async function renderAll(cases: Case[]): Promise<Map<string, Rendered>> {
  const painted = new Map<string, Rendered>()
  for (const item of cases) {
    painted.set(keyOf(item), await renderCase(item))
  }
  return painted
}

/* -------------------------------------------------------------- write out */

function measurementRow(item: Case, rendered: Rendered): string {
  const layout = item.treatment.metrics({
    subject: item.subject,
    showAdvanced: item.showAdvanced,
  })
  const room = screenColumns(item.columns) - item.treatment.chrome
  const cells = [
    item.treatment.label,
    item.subject.label,
    stateLabel(item.subject, item.showAdvanced),
    String(item.columns),
    String(layout.labelCell),
    String(layout.hintIndent),
    String(hintBudget(room, layout.hintIndent)),
    String(rendered.widest),
    rendered.fits ? 'yes' : '**no**',
  ]
  return `| ${cells.join(' | ')} |`
}

function measurementTable(cases: Case[], painted: Map<string, Rendered>): string[] {
  const head = [
    '| Treatment | Form | State | Cols | Label col | Hint indent | Hint cols | Widest | Fits |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ]
  const rows = cases.flatMap((item) => {
    const rendered = painted.get(keyOf(item))
    return rendered === undefined ? [] : [measurementRow(item, rendered)]
  })
  return [...head, ...rows, '']
}

function paintBlocks(subject: Subject, showAdvanced: boolean, painted: Map<string, Rendered>): string[] {
  const out: string[] = []
  for (const columns of WIDTHS) {
    out.push(`### ${columns} columns`, '')
    for (const item of casesFor(subject, showAdvanced, columns)) {
      const rendered = painted.get(keyOf(item))
      if (rendered === undefined) continue
      out.push(`#### ${item.treatment.label}`, '', FENCE, rendered.paint, '```', '')
    }
  }
  return out
}

function preamble(): string[] {
  return [
    '<!-- Generated by `npm run proto:review-form`. Do not edit by hand. -->',
    '',
    '# Review form: three visual treatments, rendered',
    '',
    'Issue #9. Every paint below comes from the real component tree, rendered through',
    'Ink at a fixed terminal width, with the colour codes stripped so a code fence can',
    'hold them. Colour is a separate axis and belongs to issue #10; what is on trial',
    'here is layout.',
    '',
    'The baseline is `src/ui/ReviewForm.tsx` as it stands, mounted unmodified. Its',
    'Advanced state is internal to the component, so it has no static expanded paint',
    'and appears collapsed only. Its focus starts on row one, where each treatment',
    'focuses the row that carries a hint and an error at once.',
    '',
    'The written recommendation is in `review-form-treatments.md`.',
    '',
    '## Measurements',
    '',
    '`Hint cols` is what a hint has left after the App padding, the enclosure and the',
    'indent are taken off. `Widest` is the longest line the paint actually produced.',
    '',
  ]
}

function document(cases: Case[], painted: Map<string, Rendered>): string {
  const lines = [...preamble(), ...measurementTable(cases, painted)]
  for (const subject of SUBJECTS) {
    for (const showAdvanced of states(subject)) {
      lines.push(`## ${subject.label} — ${stateLabel(subject, showAdvanced)}`, '')
      lines.push(...paintBlocks(subject, showAdvanced, painted))
    }
  }
  return `${lines.join('\n')}\n`
}

async function main(): Promise<void> {
  checkLayout()
  const cases = buildCases()
  const painted = await renderAll(cases)
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, document(cases, painted))
  process.stdout.write(`\n${cases.length} paints written to ${OUT_PATH}\n`)
}

await main()
