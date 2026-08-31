# Review form treatments: recommendation

Issue #9. Three self-consistent visual treatments of the review form Screen, rendered
at 80 and 60 columns so they could be judged by looking. The renders are in
[`review-form-renders.md`](review-form-renders.md); regenerate them with
`npm run proto:review-form`.

The primary source is branch `proto/review-form-treatments`, commit `9535670` onward.
This branch is throwaway. Nothing under `scripts/proto/` is imported by `src/`, and the
treatments are not implementations — they are the same elements under different
enclosures, built so that only what differs between them differs.

## Recommendation: A2, tightened flat with a stable label column

**A wins over B and C, and within A the renders pick the stable label column.**

A2 is A with one number chosen differently: the label column is measured across every
field the form declares rather than only the ones on screen. #9 asked for "the label
column sized to the longest visible label", which is A; the renders show that exact
choice reflowing the form on expand, so A2 is on the table as a rendered candidate
rather than as advice. Both are in every provider-form render.

**Why flat beats bordered — the ticket that comes after it.** ADR 0002 accepts windowing
the review form's rows down to a Viewport, which means cutting rows out of the region and
naming what sits outside it on a count line. A flat list of rows slices anywhere. A
bordered region has to be redrawn around the cut, and the count line then has to be
either inside the border (where it reads as a field) or outside it (where it reads as
detached from the thing it counts). B and C buy an enclosure and pay for it in #16.

**Why the stable column beats the visible one.** In A the provider form's label column
measures 14 collapsed and 19 expanded, so opening Advanced shifts every basic row's value
5 columns right — the rows a user was already reading move. A2 measures 19 in both states.
It costs 5 columns of value room while collapsed, which at 60 columns leaves 35 for a value
against A's 40; the longest value either form holds is a 22-column URL, so nothing is lost
to it. A jump the eye has to re-track is worth more than 5 columns of slack.

## The measurements

| | Hint columns at 80 | Hint columns at 60 | Label column, provider form |
| --- | --- | --- | --- |
| Baseline (today) | 42 | 22 | 30 fixed |
| A — tightened flat | 74 | 54 | 14 collapsed, 19 expanded |
| A2 — stable label column | 74 | 54 | 19 in both states |
| B — single panel | 70 | 50 | 14 collapsed, 19 expanded |
| C — grouped panels | 70 | 50 | 14 basic, 19 advanced |

Two things the table settles, and the second corrects a plausible reading of it:

- **The 32 recovered columns are the hint indent, all of them.** A hint's budget is the
  room it sits in less its indent, and the indent drops from 36 to 4. The label column
  does not enter that arithmetic at all. B and C hand 4 of the 32 back to a border.
- **Tightening the label column is a separate win, and a small one on one of the two
  forms.** It moves where a value starts, not where a hint starts. On the provider form
  collapsed it starts a value 16 columns earlier (30 → 14). On the global settings form it
  buys **one** column (30 → 29), because that form's longest label really is 28 characters
  wide. A form whose labels are long gets nothing from measuring them.

## What each treatment actually did

**A — tightened flat.** Today's geometry with both layout numbers changed. Every element
keeps its place. The hint stops being aligned under the value column, which is the one
thing given up; at 60 columns, where the alternative is a 22-column hint that wraps four
times, it is not a close call.

One difference besides the two numbers has to be owned: the prototype's rows carry the
narrow-terminal idiom from `4e78536` — `flexGrow`/`flexShrink` with `wrap` on the value,
`flexWrap` on the radios — which `Field.tsx` never got. Without it a treatment overflows
at 60 columns rather than folding, and there would be nothing to judge at that width. So
the 60-column comparison against the baseline shows two changes at once; the 80-column
comparison isolates the two numbers. See the first defect below.

**A2 — tightened flat, stable label column.** As A, measured across all declared fields.
Rendered for the provider form only: the global form declares no advanced fields, so
there A2 and A are the same paint.

**B — single panel.** One rounded enclosure around the fields; header, notes and control
rows outside it. It does separate what the core user edits from what they only read, and
that is real. It costs 4 columns on every row at every width, and the Save row now sits
outside the box it belongs to, which reads as less connected than it does in A.

**C — grouped panels.** Basic fields in one enclosure, advanced fields in a second that
appears on expand. C solves the reflow problem A2 solves, by a different route: each group
measures its own label column, so expanding Advanced does not move the basic rows.

It pays for that in a way the renders show plainly. The two panels' value columns do not
line up — 14 in the basic group against 19 in the advanced one — and side by side that
looks like a defect rather than a grouping. A2 gets the same stability with one column and
no border. Two borders is also a lot of chrome for four extra fields, and on a form with no
advanced fields C degenerates into B: on the global settings form, at **both** 80 and 60
columns, the only difference between the B and C paints is a `Basic` title line labelling
the only group there is.

**The border is also a Terminal capability question that flat rows are not.** Issue #10 is
about owning the glyph set. `╭─╮` needs an ASCII fallback and a decision about what a box
looks like without box-drawing characters. A and A2 raise nothing.

## Carry these into #18

1. **Take A2's measurement, not A's.** #18's acceptance criteria restate #9's "longest
   visible label". The renders say measure across every declared field instead. That is a
   deliberate departure from the ticket text, made because the paint showed the reflow.
2. **Measure display width, not code units.** `labelColumnWidth` here uses `String.length`,
   correct only because English is the only catalog. A CJK label is twice its length in
   columns and there is a `feat-i18n-chinese` branch. The implementation needs a width
   measurement.
3. **Take the narrow-terminal idiom with you.** It is why none of the treatments overflows
   at 60 columns. Not optional polish — see the first defect.
4. **Group titles would need i18n keys** if any grouping survives. The prototype uses
   literal `'Basic'`/`'Advanced'`, which throwaway code may do and shipped code may not.

## Limits of this prototype

- **The error line is present but hard to judge.** Colour is stripped so a code fence can
  hold a paint, and red is how an error reads as an error. The renders place one on the
  provider form's focused row and one on an unfocused row of the global form, so the
  element and its position are visible; its weight is not. Colour is issue #10.
- **The baseline carries no error.** `ReviewForm` fills errors only after a failed save and
  holds them in internal state, so the baseline paints show hints without errors while the
  treatments show both. Error-line geometry is compared between treatments, not against
  today.
- **The winning argument is partly off-paint.** The ADR 0002 reason A beats B and C is
  reasoning about #16, not something a render shows. The measurements and the B/C
  indistinguishability are on-paint; that argument is not.

## Defects this prototype turned up

Neither is #9's business, but both are real and both are visible in the committed renders.

**The review form comes apart at 60 columns.** In the baseline render of the global form at
60 columns the label wraps inside its fixed 30-column box and the radios break vertically —
`(•)` lands on one line and `On` on the next:

```text
   Disable nonessential      * (•)    ( )     ( )
   traffic                     On     Off     Unmanaged
```

`4e78536` hardened `SelectList` and `Status` for narrow terminals and did not touch
`Field.tsx`. This is what ships today.

**`App.tsx`'s header truncates the application's own name at 60 columns.** The tagline
`Text` is a flex sibling of the title `Text` and shrinks it, so the header reads `ccse`.
Visible in every 60-column paint here, including the baseline ones that mount the real
`ReviewForm`; the header is `App.tsx`'s, so it affects every Screen, not just this one:

```text
 ccse  Writes Claude Code settings files. Activation stays
     yours.
 Edit provider: acme
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

The baseline is `src/ui/ReviewForm.tsx` mounted unmodified, so nobody has to take it on
trust. Its Advanced state is internal to the component, so it has no static expanded paint
and appears collapsed only.
