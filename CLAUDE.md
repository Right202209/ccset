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

There is no lint script and no unit-test framework. The test suite is twelve
executable verification fixtures in `scripts/`, each bundled by tsup into a throwaway
`.verify/` directory, run once, then cleaned up. Run one by name — that is the unit of
"running a single test":

| Command | Covers |
| --- | --- |
| `npm run verify:global-settings` | D1-D3, D8: unmanaged-key survival, proxy-off deletion, idempotent re-save, backup content and modes |
| `npm run verify:opencode` | O1-O7 for the second agent: unmanaged siblings four levels deep, blank-omits, delete-on-unmanaged, the per-key `models` merge, masking, backup rotation, and that the `.jsonc` config is reported but never written |
| `npm run verify:codex` | C1-C9 for the third agent, plus the TOML codec and a screen walk. Round-trip fidelity over a 13-document corpus, formatting survival across an edit, the credential sidecars, the switch-and-adopt flow, and that every i18n key the module's screens reach resolves |
| `npm run verify:i18n-zh` | The zh-Hans catalog: key-for-key parity with English for the shell and every agent (placeholders included), `CCSET_LOCALE` resolution and English fallback, the unknown-locale and duplicate-key refusals, a rendered zh-Hans paint, and the localized non-TTY refusal through `dist/cli.js`. Builds first, so the boundary check exercises the shipped binary |
| `npm run verify:provider-safety` | D7, D9: nested unmanaged provider keys, 10-backup pruning per file, masking, token absence from error paths |
| `npm run verify:write-safety` | D4-D6, E3: `~/.claude.json` left untouched, created-when-absent, SIGKILL mid-save, read-only target exits `3` |
| `npm run verify:ui-render` | The interface itself: renders the component tree via `ink-testing-library`, drives the whole scenario once per glyph set, and asserts masked tokens, singular focus, and printable ASCII on every ASCII Rendered paint. Also covers the agent-selection screen and runs the viewport scenarios |
| `npm run verify:header-path` | The header's navigation path: segments accumulate on push, drop on back, and elide from the front when they outrun the terminal width |
| `npm run verify:review-form` | The review form's row treatment: focus, changed markers, hints, Advanced toggle, `ctrl+s` |
| `npm run verify:malformed-dirty` | T6, T9: malformed-target confirm flow and unsaved-edits prompt, driven through a real PTY |
| `npm run verify:error-recovery` | A failed save stays in-app and keeps everything typed (read-only-directory drive, then a fixed retry), and a partial backup copy is surfaced by Status for all three agents and removed by Clear |
| `npm run verify:status-terminal` | Status listing/refresh, narrow-terminal layout, `--version` and non-TTY exit `2` |
| `npm run verify:release-artifact` | Packs a tarball, installs it into a temp project, checks contents/bin/shebang/mode |

`verify:malformed-dirty`, `verify:status-terminal`, `verify:release-artifact`,
and `verify:i18n-zh` build first, so they exercise `dist/cli.js`, not `src/`.
The rest import `src/` directly.

Not every file in `scripts/` is a gate. `ui-session.ts` (mounts `App`, sends keys, reads
Rendered paints back), `ui-assertions.ts`, `verify-viewport.ts`, `kill-harness.ts`,
`verify-toml-codec.ts` and `verify-codex-auth.ts` are modules the gates import —
`verify-viewport.ts` runs inside `verify:ui-render`, `kill-harness.ts` inside
`verify:write-safety`, and the last two inside `verify:codex`. They are split out to
keep each file inside the 300-line limit.

`verify:write-safety` is the one gate that forks itself: its bundle re-enters through
`--kill-child` so the child running under SIGKILL is the shipped `saveGlobal`, not a
reimplementation of it. It calibrates against one uninterrupted save and then asserts
that kills landed on **both** sides of the `rename()`, so a machine too slow or too fast
for the sweep fails loudly instead of passing vacuously.

`verify:codex` reaches the strings through the registry rather than importing the
agent's `messages.ts` alone: `registerMessages` is a load-time side effect of
`src/registry.ts`, so a fixture that skips that import sees every agent key unresolved.

`CCSET_HOME` overrides the home directory (`core/paths.ts:resolveHome`),
`CCSET_ASCII=1` selects the seven-bit terminal capability (`ui/terminal.ts:resolveTerminal`),
and `CCSET_LOCALE` selects the interface locale (`i18n/index.ts:resolveLocale`, applied
through `setLocale` at the top of `main()`). Each is read at the boundary, by `cli.tsx`,
and nowhere else. Every fixture
that goes through the CLI points it at a `mkdtemp` directory; use it for any manual run so
you never write into a real `~/.claude`. The gates that mount `App` directly bypass
`cli.tsx`, so they pass the scratch home in through `ctx`, the glyph set through
`terminal`, and — where terminal size is the thing under test — a fixed size through the
`viewport` prop, which pins `useTerminalViewport` instead of reading `stdout`.
Interactive checks need a PTY — piped stdin exits `2` by design.

CI (`.github/workflows/ci.yml`) runs typecheck, build, the verification fixtures
(`npm test`), and `npm pack --dry-run` on Ubuntu and macOS for Node 18/20/22.
Run the fixtures locally the same way — `npm test`, or one gate with
`npm run verify:<name>`.

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
everything else), `backup.ts` (per-file rotation and the read-only backups Status
section, both taking the directory as an argument),
`copy.ts` (atomic byte copy, used by backups and by moving a credential ccset does not
model), `mask.ts`, `values.ts` (form↔JSON coercions), `save.ts`
(`runSave`/`successMessage`), `validate.ts` (validator *factories* — which names are
reserved is the agent's business), `errors.ts` (the `CcsetError` taxonomy carrying an
i18n key and an exit code), and `paths.ts`, which after the second agent holds only
`resolveHome`, `backupsDirFor`, and `listNamedFiles` — the last taking the agent's
naming rule as a callback.

**The codec seam is real, not notional.** `src/core/config-file.ts` dispatches on
`ConfigFile.codec`: `readConfigFile` returns a `LoadedConfig` carrying `raw` as well as
`data`, and `writeConfigFile` takes that base plus `ManagedWrite[]`. `json` rebuilds the
document from the parsed object; `toml` edits the original text, because a TOML document
carries comments, blank lines and key order that a re-emit would delete (ADR 0003).
`src/core/toml/` is that codec — `scan.ts` records where keys, values and table headers
*are*, `parse.ts` reads a document into a `JsonObject`, `check.ts` is the strict pass
that decides whether ccset may rewrite the file at all, `edit.ts` applies writes by
splicing spans, and `format.ts`/`strings.ts` render the values ccset writes. The scanner
is deliberately tolerant and the checker deliberately strict: an edit must never refuse
to run, but a file that fails the check reaches the user as a confirm.

`JsonParseError` is now one case of `ConfigParseError`, which carries its own
`messageKey` and `titleKey` so a TOML target is described as TOML. `runSave` catches the
base class. The exit code is still `4`; the constant is `EXIT_INVALID_CONFIG`.

Criterion 5 ("adding an agent touches exactly two files") is **enforceable, and was
enforced**: adding opencode changed nothing under `src/` except `src/registry.ts`. The
file that used to break it was `src/i18n/en.ts`, since an agent that ships screens must
name them. An `Agent` now carries `messages`, which the registry merges into the catalog
and which **throws on a duplicate key** rather than silently rewriting shell text.

**`src/agents/claude-code/`** is the first agent, and the reference one. Its shape
is worth knowing:
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
- `paths.ts`, `constants.ts` and `messages.ts` hold everything Claude-Code-specific
  that used to sit in `src/core/` and `src/i18n/`.

**`src/agents/opencode/`** is the second agent, and exists to keep the seam honest.
Same file shape, one structural difference that matters: opencode keeps **every provider
inside one document** (`~/.config/opencode/opencode.json`) as keys under `provider`,
where Claude Code uses one file per provider. So provider discovery is object keys rather
than a glob, `ProviderList` carries the parse failure (a malformed file has no providers,
rather than one bad provider), and `applyManagedWrites` has to preserve unmanaged
siblings four levels deep at `provider.<id>.options.*`.

Three things there are load-bearing:
- **`provider.<id>.models` merges per key.** A model id already on disk is left alone, a
  new one is added as `{}`, one dropped from the list is deleted. Writing the map
  wholesale would discard per-model settings. This needs current disk state, which is why
  `emitProvider` takes the base object — the only emit in the codebase that does.
- **`autoupdate` is written as a real JSON boolean.** The form's domain is strings and
  `"false"` would read as truthy.
- **`opencode.jsonc` is never written.** opencode loads it too and its schema allows
  comments, which cannot survive a `JSON.parse` round-trip. Status reports the file and
  warns the save may not be the config opencode reads. Which file wins is **unverified**
  — see U6 in `Important Documentation.md`.

There is deliberately no Test connection for opencode: a custom provider's wire protocol
comes from whichever SDK package the user names, so there is no endpoint ccset could
probe honestly.

**`src/agents/codex/`** is the third agent, and the first non-JSON one. Three things
about it are load-bearing and are not guessable from the file layout:
- **The API key is not in `config.toml`.** Codex resolves a provider credential as
  `env_key` (an env var *name*) → `experimental_bearer_token` → the ambient `auth.json`,
  and only consults the last when the block carries `requires_openai_auth = true`. ccset
  takes that third path: `auth.ts` keeps one credential per provider in an
  `auth.<id>.json` sidecar, and `providers.ts` writes `requires_openai_auth` from a
  constant on **every** save rather than trusting what is on disk. Drop it and the
  provider block is written successfully and then fails to authenticate.
- **`auth.json` is replaced, never edited.** Codex rewrites it on login and token
  refresh — the same hazard that makes `~/.claude.json` create-only. `activate.ts` does a
  whole-file copy after a backup, and adopting an existing one is a byte copy, because it
  may hold an OAuth token block ccset does not model.
- **A switch is two writes, and `config.toml` goes first.** `saveModelProvider` then the
  credential copy: if the TOML write fails nothing has moved, whereas the reverse order
  could leave Codex routed at the old endpoint with the new key.

`wire_api` has one legal value (`responses`) as of Codex v0.152.0, so it is a constant
rather than a form field, and the provider form says so — the endpoint has to speak the
OpenAI Responses API. There is no Test connection: ccset's probe is Anthropic-shaped.

**`src/registry.ts`** is hand-written and static. No `import()` of a scanned path
anywhere — the published artifact is a bundle and a bundler cannot resolve one. It also
registers each agent's `messages`, which is a **load-time side effect**: anything that
resolves an agent's keys must import this module, or every `codex.*` key degrades to a
visible literal. Adding an agent is one import plus one array element;
`docs/adding-an-agent.md` is the guide, written from doing it.

**`src/ui/`** is a navigation stack, not a router. `useScreens.ts` holds `Frame[]`; three
rules there are load-bearing and easy to break:
- A frame keeps its producing task (`reload`) **only** when the screen it produced was
  a `list` or `status`, because re-running those is a read. Backing out of a save's
  success message must never re-run the write behind it.
- A `confirm` returned by `replace()` **stacks** instead of superseding, and `App.submit`
  parks the submitted values onto the form's frame first. Together these mean declining
  "back up and start fresh" returns a form still holding the token the user typed.
  Refusing a destructive write must not cost the user their input.
- A task that throws returns an error Screen, never a fatal unmount. From
  `open`/`replace` it **stacks**: `esc` goes back to the frame that caused it,
  values intact, and the failure can be fixed and retried in the same session.
  A failed re-read on back takes the reloaded frame's place instead — what
  failed is the read that frame was showing, and stacking would make every esc
  re-trigger the failure. The exit-code taxonomy (`PRD 4.4`) belongs to core
  and the process boundary; inside the interface every task error is
  recoverable.

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

**`src/i18n/`** — every user-facing string resolves through `t()`. The catalog is
`src/i18n/en.ts` (shell vocabulary only — nothing there names an agent) plus each agent's
`messages.ts`, merged by the registry under an agent-id namespace. `t()` returns the key
itself on a miss rather than throwing, so a renamed key degrades to a visible literal
rather than a crash — which is exactly how two fixtures caught the rename in #33. Keys
are also referenced indirectly (`FieldSpec.labelKey`/`helpKey`, `Action.detailKey`,
`WriteReport.activateKey`, `validate.ts` return values, `ProbeResult.key`,
`CcsetError.messageKey`, and template-built families like `prompt.${kind}Line`), so a
mechanical grep for `t('…')` will under-report usage. Two catalogs ship today
(`en`, `zh-Hans`); a new locale is a file in `src/i18n/`, an entry in the `catalogs`
map in `index.ts`, and a `messages` entry per agent. `t()` resolves through the
active locale and falls back to English for a key it has not translated yet, so an
untranslated key degrades to English text rather than a raw key or a crash — and
`verify:i18n-zh` holds both catalogs key-for-key identical so the fallback stays a
safety net, not a silent gap.

## Invariants

These are product guarantees documented in `README.md` and verified in
`Important Documentation.md`. Breaking one is a release blocker, not a bug.

- **Unmanaged keys survive.** Only manifest paths are written; everything else at every
  nesting level passes through. `env` merges per key, never wholesale. For a format that
  carries them, comments, blank lines, alignment and key order survive too — which is why
  TOML is edited in place rather than re-serialised.
- **Off means absent.** Turning the proxy off deletes `HTTP_PROXY`/`HTTPS_PROXY`; a blank
  field omits its key entirely — no `null`, no `""`.
- **Re-read immediately before writing.** Claude Code rewrites `settings.json` while
  ccset is open; a parse from launch time would clobber it.
- **`~/.claude.json` is created only when missing, never rewritten.** It is Claude Code's
  live state store and a read-modify-write there races an active writer.
- **A malformed target is never silently overwritten.** The user is asked; the backup is
  taken on both paths so the unreadable original survives. The question names the format
  the file was supposed to be in.
- **A live credential store is replaced, never merged into.** `~/.codex/auth.json` is
  Codex's, on the same reasoning as `~/.claude.json`: ccset copies a whole file over it on
  an explicit request, after a backup, and never reads-modifies-writes it.
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

Milestone 2, mostly done. Three agents (`claude-code`, `opencode`, `codex`), two
catalogs (`en`, `zh-Hans`), interactive-only. `--agent <id>` has three legal values.

Done in M2: the second agent, the seam work that made criterion 5 literally true,
`docs/adding-an-agent.md`, and the third agent together with the TOML codec that U7
blocked. U7 is answered (ADR 0003, `Important Documentation.md` §9.26).

Not built, and deliberately not stubbed:
- **`apiKeyHelper` support** — still blocked on U1, which needs a real third-party
  credential. Nothing here should pretend otherwise.
- **A live check of the Codex provider path.** U8: the credential mechanism was read out
  of Codex's own source and matches its tests, but no request has been made through a
  ccset-written provider. U9 (whether a keyring credential store bypasses `auth.json`
  entirely) is why Status warns rather than refusing.
- **Non-interactive mode** (M3). The zh-Hans catalog removed the "additional i18n
  catalog" item that used to share this line; a third locale follows the same
  additive path (`src/i18n/` file, `catalogs` entry, `messages` per agent).

ADR 0002's flow-scrolling output with windowed long regions is implemented — see
`src/ui/Viewport.tsx` above. Several external gates in `Important Documentation.md` §9.8
(U1-U5, macOS, Windows) remain pending and block an npm release. M1 was never closed out:
its remaining work is those external gates and the publish itself, not code.
