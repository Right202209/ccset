# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` holds the repository conventions (structure, style, commit/PR format,
how to add an agent) and applies here too. This file adds the architecture and the
invariants that are not visible from any single file.

## Commands

```bash
npm install                      # Node 18+
npm run typecheck                # tsc --noEmit over src/, scripts/, tsup.config.ts
npm run build                     # tsup -> dist/cli.js, single ESM bundle + shebang
```

There is no lint script and no unit-test framework. The test suite is nine
executable verification fixtures in `scripts/`, each bundled by tsup into a throwaway
`.verify/` directory, run once, then cleaned up. Run one by name — that is the unit of
"running a single test":

| Command | Covers |
| --- | --- |
| `npm run verify:global-settings` | D1-D3, D8: unmanaged-key survival, proxy-off deletion, idempotent re-save, backup content and modes |
| `npm run verify:provider-safety` | D7, D9: nested unmanaged provider keys, 10-backup pruning per file, masking, token absence from error paths |
| `npm run verify:write-safety` | D4-D6, E3: `~/.claude.json` left untouched, created-when-absent, SIGKILL mid-save, read-only target exits `3` |
| `npm run verify:ui-render` | The interface itself: renders the component tree via `ink-testing-library`, drives the whole scenario once per glyph set, and asserts masked tokens, singular focus, and printable ASCII on every ASCII Rendered paint. Also runs the viewport scenarios |
| `npm run verify:header-path` | The header's navigation path: segments accumulate on push, drop on back, and elide from the front when they outrun the terminal width |
| `npm run verify:review-form` | The review form's row treatment: focus, changed markers, hints, Advanced toggle, `ctrl+s` |
| `npm run verify:malformed-dirty` | T6, T9: malformed-target confirm flow and unsaved-edits prompt, driven through a real PTY |
| `npm run verify:status-terminal` | Status listing/refresh, narrow-terminal layout, `--version` and non-TTY exit `2` |
| `npm run verify:release-artifact` | Packs a tarball, installs it into a temp project, checks contents/bin/shebang/mode |

`verify:malformed-dirty`, `verify:status-terminal`, and `verify:release-artifact` build
first, so they exercise `dist/cli.js`, not `src/`. The rest import `src/` directly.

Not every file in `scripts/` is a gate. `ui-session.ts` (mounts `App`, sends keys, reads
Rendered paints back), `ui-assertions.ts`, `verify-viewport.ts`, and `kill-harness.ts`
are modules the gates import — `verify-viewport.ts` has no npm script of its own and runs
inside `verify:ui-render`, and `kill-harness.ts` runs inside `verify:write-safety`. They
are split out to keep each file inside the 300-line limit.

`verify:write-safety` is the one gate that forks itself: its bundle re-enters through
`--kill-child` so the child running under SIGKILL is the shipped `saveGlobal`, not a
reimplementation of it. It calibrates against one uninterrupted save and then asserts
that kills landed on **both** sides of the `rename()`, so a machine too slow or too fast
for the sweep fails loudly instead of passing vacuously.

`CCSET_HOME` overrides the home directory (`core/paths.ts:resolveHome`), and
`CCSET_ASCII=1` selects the seven-bit terminal capability (`ui/terminal.ts:resolveTerminal`).
Both are read at the boundary, by `cli.tsx`, and nowhere else. Every fixture
that goes through the CLI points it at a `mkdtemp` directory; use it for any manual run so
you never write into a real `~/.claude`. The gates that mount `App` directly bypass
`cli.tsx`, so they pass the scratch home in through `ctx`, the glyph set through
`terminal`, and — where terminal size is the thing under test — a fixed size through the
`viewport` prop, which pins `useTerminalViewport` instead of reading `stdout`.
Interactive checks need a PTY — piped stdin exits `2` by design.

CI (`.github/workflows/ci.yml`) runs typecheck, build, and `npm pack --dry-run` on
Ubuntu for Node 18/20/22 only. The verify scripts are not wired into CI; run them locally.

`gh` is not on `PATH`; it is unpacked at `~/gh/gh_2.76.2_linux_amd64/bin/gh`. Issues are
the tracker — see `docs/agents/issue-tracker.md`.

## Architecture

Three layers with one data contract between them.

**`src/types.ts` is the seam.** An agent module returns an `ActionResult` — one of
`form`, `list`, `status`, `confirm`, `message` — and the UI renders only those five
shapes. The UI has no knowledge of Claude Code, and an agent has no knowledge of Ink.
Adding an agent means writing a module that produces these screens; it never means
touching `src/ui/`.

**`src/core/`** is agent-agnostic and is where safety lives: `json-file.ts` (atomic
temp+rename writes, `0600`, parse errors), `merge.ts` (apply managed writes, preserve
everything else), `backup.ts` (per-file rotation), `mask.ts`, `paths.ts`, `validate.ts`,
`errors.ts` (the `CcsetError` taxonomy carrying an i18n key and an exit code).

**`src/agents/claude-code/`** is the only agent. Its shape is worth knowing:
- `manifest.ts` is **data only** — every managed key of Claude Code's settings files,
  declared once. Both the review form and the writer are driven from it. If Claude Code
  changes its settings shape, this file is the blast radius. Logic leaking in here is
  what makes the other files breach the size limits.
- `global.ts` / `providers.ts` each expose `seed*` (disk JSON → `FormValues`) and
  `emit*` (`FormValues` → `ManagedWrite[]`) plus a `save*`. A `ManagedWrite` with
  `value: undefined` means **delete** — that is a correctness requirement, not an
  optimisation (see Invariants). `values.ts` holds the coercions both directions share;
  `textOrUndefined`/`intOrUndefined`/`csvOrUndefined` are where "blank means omit" is
  actually implemented.
- `state.ts` owns `~/.claude.json`: `inspectState` reads it, `createStateIfMissing`
  writes it only when absent. Nothing here ever updates it — see Invariants.
- `save.ts` wraps a save so a `JsonParseError` becomes a confirm screen instead of a
  crash.
- `actions.ts` assembles the four menu actions; `status.ts` builds the read-only view;
  `test-connection.ts` is the only outbound network path.

**`src/registry.ts`** is hand-written and static. No `import()` of a scanned path
anywhere — the published artifact is a bundle and a bundler cannot resolve one.

**`src/ui/`** is a navigation stack, not a router. `useScreens.ts` holds `Frame[]`; two
rules there are load-bearing and easy to break:
- A frame keeps its producing task (`reload`) **only** when the screen it produced was
  a `list` or `status`, because re-running those is a read. Backing out of a save's
  success message must never re-run the write behind it.
- A `confirm` returned by `replace()` **stacks** instead of superseding, and `App.submit`
  parks the submitted values onto the form's frame first. Together these mean declining
  "back up and start fresh" returns a form still holding the token the user typed.
  Refusing a destructive write must not cost the user their input.

Frame titles are user-visible: the header paints them as the navigation path, eliding
from the front when the path outruns the terminal width. A screen's `title` is a
breadcrumb, not just a heading.

Confirm screens and the unsaved-edits prompt start their cursor on the safe row
(`SelectList` `initialIndex`), so a stray Enter cannot clear backups or send a token.
The prompt renders with the form still mounted but hidden (`display: none`), because
unmounting it discards the draft.

Three more UI modules each own one thing, and owning it in one place is the point:
- `terminal.ts` — the glyph set, the color set, the busy frames, and `fold()`, which
  rewrites the catalog's non-ASCII characters for a seven-bit terminal. Every paint site
  folds; a new user-facing string that skips `fold()` breaks the ASCII gate.
- `Viewport.tsx` — terminal size (`useTerminalViewport`, which re-reads on `stdout`
  `resize`), plus `windowAround()` and `WindowRegion`, which cut a long region down to a
  row budget and print the `Showing x-y of n` count. This is ADR 0002's windowing, and it
  is implemented: `SelectList`, `Status`, and `ReviewForm` all draw through it. A region
  that renders its items directly will overflow a short terminal.
- `keymap.ts` — the key bindings per screen kind and the help line built from them. It
  self-checks at module load (duplicate key, missing i18n key → throw at startup), so a
  keymap mistake fails immediately rather than painting a wrong footer.

`useReviewForm.ts` holds the form's whole state machine — rows, the Advanced toggle,
validation, the row window, and `ctrl+s` — leaving `ReviewForm.tsx` as paint only.

**`src/i18n/`** — every user-facing string resolves through `t()` against
`src/i18n/en.ts`. `t()` returns the key itself on a miss rather than throwing. Keys are
also referenced indirectly (`FieldSpec.labelKey`/`helpKey`, `validate.ts` return values,
`ProbeResult.key`, `CcsetError.messageKey`, and template-built families like
`prompt.${kind}Line`), so a mechanical grep for `t('…')` will under-report usage. English
is the only catalog; a second one is a new file plus one line in `index.ts`.

## Invariants

These are product guarantees documented in `README.md` and verified in
`Important Documentation.md`. Breaking one is a release blocker, not a bug.

- **Unmanaged keys survive.** Only manifest paths are written; everything else at every
  nesting level passes through. `env` merges per key, never wholesale.
- **Off means absent.** Turning the proxy off deletes `HTTP_PROXY`/`HTTPS_PROXY`; a blank
  field omits its key entirely — no `null`, no `""`.
- **Re-read immediately before writing.** Claude Code rewrites `settings.json` while
  ccset is open; a parse from launch time would clobber it.
- **`~/.claude.json` is created only when missing, never rewritten.** It is Claude Code's
  live state store and a read-modify-write there races an active writer.
- **A malformed target is never silently overwritten.** The user is asked; the backup is
  taken on both paths so the unreadable original survives.
- **Writes are atomic and `0600` on POSIX.** `chmod` failure is swallowed because win32
  cannot honour it — the guarantee is documented as POSIX-only, never claimed generally.
- **Tokens are masked everywhere** — entry, Status, review, and error messages. OS error
  text is discarded rather than forwarded, which is what keeps that rule simple. A token
  leaves the machine only through Test connection, after a confirmation that names the
  host; the response body is never read.

## Code-quality gates

Enforced on every file touched (`Important Documentation.md` §7): functions ≤ 50 lines,
files ≤ 300 lines, nesting ≤ 3, positional parameters ≤ 3, cyclomatic complexity ≤ 10.
No magic numbers — named constants live in `src/core/constants.ts`.

Style: no semicolons, single quotes, two-space indent. TypeScript is strict with
`noUncheckedIndexedAccess`, so index access is `T | undefined` and must be narrowed.
Module resolution is `Bundler`, but source imports still carry the `.js` extension
(`'./paths.js'` from a `.ts` file) — match that.

## Documentation map

- `PRD.md` — the specification. Code comments cite it by section (`PRD 4.3`); keep doing
  that when the reason for a decision lives there.
- `Important Documentation.md` — the verification register. Every runtime check is
  recorded here with its result, and §9 is append-only history. **Record what you
  actually ran**; a passing local build is not evidence for a platform gate.
- `CONTEXT.md` — the glossary. Use its terms (Screen vs View, Frame vs rendered paint,
  Viewport, Agent vs Provider) and avoid the synonyms it lists under `_Avoid_`.
- `docs/adr/` — accepted decisions. Read the ADR covering an area before changing it and
  surface conflicts rather than overriding silently.
- `README.md` / `README.zh-CN.md` — user-facing behaviour. A behaviour change updates
  the English doc, and the Chinese doc when it covers the changed behaviour.

## Current state

Milestone 1. One agent (`claude-code`), one catalog (`en`), interactive-only. Not built
and deliberately not stubbed: `apiKeyHelper` support (blocked on U1), a second agent,
non-interactive mode. `--agent <id>` is parsed and validated but has one legal value.

ADR 0002's flow-scrolling output with windowed long regions is implemented — see
`src/ui/Viewport.tsx` above. Several external gates in `Important Documentation.md` §9.8
(U1-U5, macOS, Windows) remain pending and block an npm release.
