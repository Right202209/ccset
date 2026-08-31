# Review form treatments: recommendation

Issue #9. Three self-consistent visual treatments of the review form Screen, rendered
at 80 and 60 columns so they could be judged by looking. The renders are in
[`review-form-renders.md`](review-form-renders.md); regenerate them with
`npm run proto:review-form`.

This branch is throwaway. Nothing under `scripts/proto/` is imported by `src/`, and the
treatments are not implementations — they are the same elements under three different
enclosures, built so that only what differs between them differs.

## Recommendation: treatment A, tightened flat

**A wins, and the reason is the ticket that comes after it.** ADR 0002 accepts windowing
the review form's rows down to a Viewport, which means cutting rows out of the region and
naming what sits outside it on a count line. A flat list of rows slices anywhere. A
bordered region has to be redrawn around the cut, and the count line then has to be
either inside the border (where it reads as a field) or outside it (where it reads as
detached from the thing it counts). B and C buy an enclosure and pay for it in #16.

The measurements say the same thing more plainly. The symptom this prototype was run to
settle is the hint indent, and A is the treatment that spends nothing to fix it:

| | Hint columns at 80 | Hint columns at 60 |
| --- | --- | --- |
| Baseline (today) | 42 | 22 |
| A — tightened flat | 74 | 54 |
| B — single panel | 70 | 50 |
| C — grouped panels | 70 | 50 |

A recovers 32 columns at 80 and 32 at 60. B and C hand 4 of them straight back to a
border. On the provider form the label column drops from a fixed 30 to a measured 14
collapsed, which is where most of that comes from.

Two further reasons, in order of weight:

- **The border is a Terminal capability question and the flat rows are not.** Issue #10
  is about owning the glyph set. `╭─╮` needs an ASCII fallback and a decision about what
  a box looks like without box-drawing characters; A raises nothing.
- **At 60 columns B and C are indistinguishable on the global form**, which is the form a
  core user is most likely to open first — it has no advanced fields, so C's second panel
  never appears and its "Basic" title labels the only group there is. An enclosure that
  cannot be told apart from the alternative is not earning its cost.

## What each treatment actually did

**A — tightened flat.** Today's layout with two numbers changed: the label column is
measured against the labels on screen, and the hint indent drops from 36 to 4. Every
element keeps its place. The hint stops being aligned under the value column, which is
the one thing given up; at 60 columns, where the alternative is a 22-column hint that
wraps four times, it is not a close call.

**B — single panel.** One rounded enclosure around the fields; header, notes and control
rows outside it. It does separate what the core user edits from what they only read, and
that is real. It costs 4 columns on every row at every width, and the Save row now sits
outside the box it belongs to, which reads as less connected than it does in A.

**C — grouped panels.** Basic fields in one enclosure, advanced fields in a second that
appears on expand. C has one genuine advantage the renders show clearly: because each
group measures its own label column, expanding Advanced does **not** reflow the basic
rows. In A and B the label column goes 14 → 19 on expand and every basic row's value
jumps 5 columns right.

That advantage is bought at a price the renders show just as clearly. The two panels'
value columns do not line up — 14 in the basic group against 19 in the advanced one — and
side by side it looks like a defect rather than a grouping. Two borders is a lot of chrome
for four extra fields, and on a form with no advanced fields C degenerates into B.

## Carry these into #18

1. **Do not re-measure the label column on expand.** A's one visible flaw is the 14 → 19
   jump. Measure across every field the form declares, not only the visible ones. It
   costs 5 columns while collapsed and buys a column that never moves. C's per-group
   measurement was the wrong way to solve the right problem.
2. **Measure display width, not code units.** `labelColumnWidth` in this prototype uses
   `String.length`, which is correct only because English is the only catalog. A CJK label
   is twice its length in columns, and there is a `feat-i18n-chinese` branch. The
   implementation needs a width measurement, not `.length`.
3. **Take the narrow-terminal idiom with you.** The reason none of the three treatments
   overflows at 60 columns is that their rows use `flexGrow`/`flexShrink` with
   `wrap="wrap"` on the value, `flexWrap="wrap"` on the radio row, and fixed
   non-shrinking gutter cells. That is the idiom `4e78536` gave `SelectList` and `Status`.
   `Field.tsx` never got it. See the defect below — it is not optional polish.
4. **Group titles need i18n keys if any grouping survives.** The prototype uses literal
   `'Basic'` / `'Advanced'`, which throwaway code may do and shipped code may not.

## Defects this prototype turned up

Neither is #9's business, but both are real and both are visible in the renders.

**The review form comes apart at 60 columns.** In the baseline render of the global form
at 60 columns, the label wraps inside its fixed 30-column box and the radios break
vertically — `(•)` lands on one line and `On` on the next:

```text
   Disable nonessential      * (•)    ( )     ( )
   traffic                     On     Off     Unmanaged
```

`4e78536` hardened `SelectList` and `Status` for narrow terminals and did not touch
`Field.tsx`. This is what ships today.

**`App.tsx`'s header truncates the application's own name at 60 columns.** The tagline
`Text` is a flex sibling of the title `Text` and shrinks it, so the header reads `ccse`.
Confirmed against the real `App` component, not just the prototype's copy of its header —
it is on the main menu, so it affects every Screen:

```text
 ccse  Writes Claude Code settings files. Activation stays
     yours.
 Agent: Claude Code
```

## How the renders were produced

`npm run proto:review-form` mounts the real component tree through Ink against a stdout
stub reporting a fixed column count, writes each paint into the renders document with
colour stripped, and prints the same paints in colour to the terminal. It also gates
itself: the layout arithmetic is asserted before anything renders, every candidate paint
must fit its column budget, every paint must carry exactly one focus marker, and the
fixture's fake token must never appear unmasked in a paint that gets written to a file.

The subjects are ccset's two real review forms, driven from the real `FieldSpec`s in
`manifest.ts` — the provider form (which has advanced fields, a secret and a required
field) and the global form (which has the choice radios, the longest labels and the
longest hint). Validation errors and the focused row are injected, because the renders are
static and both are elements under judgement.

The baseline is `src/ui/ReviewForm.tsx` mounted unmodified. Its Advanced state is internal
to the component, so it has no static expanded paint and appears collapsed only.
