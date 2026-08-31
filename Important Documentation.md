# Important Documentation

Verification and test register for **ccset** (`@droite/ccset`).

Runtime checks are recorded below as they are performed. Each item states what
to check, how, and what a pass looks like; entries without an explicit result
remain pending.

---

## 1. Blocking unknowns

These gate design decisions already written into `PRD.md`. Resolve before building
the dependent part.

| # | Question | Experiment | Blocks |
| --- | --- | --- | --- |
| U1 | Does `apiKeyHelper` supply the **Bearer** credential when `ANTHROPIC_BASE_URL` points at a third party, or only `x-api-key`? | Settings file with `apiKeyHelper` and a third-party `ANTHROPIC_BASE_URL`, no `ANTHROPIC_AUTH_TOKEN`. Run one prompt. | Milestone 2 in full. If it fails, secret-indirection is impossible for the target audience and M2 must be re-scoped. |
| U2 | Does a key in `--settings` **override** the same key in `~/.claude/settings.json`, and does `env` merge per-key or wholesale? | Set `model` in both, differing. Set one `env` var in each. Inspect effective values. | §4.2.3 "leave model blank to inherit global". If merge is wholesale, provider files must restate the global `env` block. |
| U3 | Is `fallbackModel` in settings JSON a `string[]` or a comma-joined string? | Write each form, launch, observe whether it is honoured or rejected. | §4.2.3 Advanced field type. |
| U4 | Does Claude Code prune `~/.claude/backups/` by filename pattern or across the whole directory? | Place a foreign file there, use Claude Code until rotation occurs, check survival. | Confirms §6.5's subdirectory choice. Low risk — the subdirectory is safe either way. |
| U5 | Is the `droite` npm scope owned/creatable by the publisher? | `npm whoami`, then `npm org ls droite` while authenticated. | Publishing at Milestone 1. |

---

## 2. Data-safety tests (highest priority)

The failure mode that matters is destroying a config the user already had.

| # | Test | Pass condition |
| --- | --- | --- |
| D1 | Save global settings against a `settings.json` containing `hooks`, `statusLine`, `enabledPlugins`, `effortLevel`, `tui`, `verbose`. | Every unmanaged key byte-identical afterward, including nesting order-independence. |
| D2 | Toggle proxy **off** after it was on. | `HTTPS_PROXY` and `HTTP_PROXY` are **absent** from the file, not set to `""`. |
| D3 | `settings.json` contains a hand-set `env` var ccset does not manage. | It survives; `env` was merged per-key, not replaced. |
| D4 | Existing `~/.claude.json` (any size). | ccset performs **zero** writes. Verify by mtime and inode before/after. |
| D5 | Absent `~/.claude.json`. | Created with exactly `{"hasCompletedOnboarding": true}`, mode `0600`. |
| D6 | Kill the process mid-write (SIGKILL during save). | Target file is either the complete old content or the complete new content — never truncated. Confirms temp + `rename()`. |
| D7 | Provider file with unmanaged extra keys, then edit via ccset. | Extra keys survive. |
| D8 | Run save twice with no edits. | Second run is byte-identical to the first; backup count grows by at most one per write. |
| D9 | 11+ consecutive writes. | `~/.claude/backups/ccset/` holds exactly 10, oldest pruned. |

---

## 3. Security checklist

Run before any commit, per project rules.

- [ ] No hardcoded secrets anywhere in `src/` or fixtures. Test fixtures use obvious
      placeholders (`sk-TEST-DO-NOT-USE`), never real tokens.
- [ ] Every file ccset creates is `0600` on POSIX — verify with `stat` on
      `settings.json`, `settings.<name>.json`, `~/.claude.json`, and every backup.
- [ ] Token is masked on entry (`ink-text-input` `mask` prop — **verify this prop
      exists in the pinned version**), and masked on display in Status, review
      screen, error messages and stack traces.
- [ ] Masking does not leak length: middle is a fixed-width `•` run.
- [ ] Grep the built bundle and any log output for a test token string after a full
      session including a failed save and a failed connection test. Zero hits.
- [ ] Test-connection never prints the response body.
- [ ] Test-connection shows the destination host and requires confirmation before
      sending.
- [ ] Provider name validation rejects `../`, absolute paths, `local`, `json`, empty
      string, and any name containing a path separator on both POSIX and Windows
      (`\` included).
- [ ] Base URL is validated as `http(s)://` before being used in a fetch — no
      `file://`, no `javascript:`.
- [ ] Backups containing tokens are `0600` and the README documents that rotating a
      token leaves the old one in backups until cleared.

### Windows-specific

- [ ] **`fs.chmod` cannot enforce `0600` on win32** (only the read-only bit; ACLs
      untouched). Confirm the README states this. The `0600` guarantee in §2.2 is
      POSIX-only and must not be claimed generally.

---

## 4. Functional tests

| # | Test | Pass condition |
| --- | --- | --- |
| F1 | Fresh machine, no `~/.claude/` at all. | All parents created, no crash, sensible defaults. |
| F2 | Status against 6+ provider files. | All listed, tokens masked, one copy-ready command each. |
| F3 | One provider file is malformed JSON. | Listed as an error entry; the other providers still render; exit code 4 only if the user chose to act on it. |
| F4 | A `settings.*.json` with no `ANTHROPIC_BASE_URL`. | Listed with a note, not hidden. |
| F5 | Review screen seeding. | Values come from the existing file, **not** template defaults; a config lacking proxy vars is not silently offered proxy vars as if pre-existing. |
| F6 | Free-text model. | `Kiro-5-claude-opus-4-8` accepted verbatim, no coercion to a known alias. |
| F7 | Blank Advanced fields. | Omitted from output entirely — no `null`, no `""`. |
| F8 | Single registered agent. | Agent-selection screen is skipped. |
| F9 | Success message. | Contains absolute path, resulting mode, and a `claude --settings <abs-path>` line that runs as printed. |
| F10 | Exit with unsaved edits / without. | Confirms only in the former case. |

---

## 5. Environment and platform

| # | Test | Pass condition |
| --- | --- | --- |
| E1 | `echo "" \| npx @droite/ccset` (non-TTY). | Clear message, exit code **2**, no ANSI escapes in the pipe. |
| E2 | Node 18, 20, 22. | Runs; global `fetch` available on all three. |
| E3 | `~/.claude/` read-only (chmod 500). | Exit code 3, names the path, no partial state. |
| E4 | Warm start timing. | ≤ 2 s to first paint, excluding `npx` download. |
| E5 | Windows Terminal + PowerShell. | Best-effort: renders, paths resolve under `%USERPROFILE%`. Failures are documented, not release-blocking (§5.2 tier 2). |
| E6 | Narrow terminal (80 cols) and resize during render. | No layout corruption. |

---

## 6. Build and publish

### Release gates

Every npm release must satisfy all of these:

- [ ] `npm run typecheck` and `npm run build` pass.
- [ ] `npm pack` contents are reviewed, then the tarball is installed and its core
      flow is run.
- [ ] Changes involving writes, backups, credentials, or migrations pass the
      relevant data-safety checks in this register.
- [ ] The core flow receives a manual smoke test on macOS and Linux, normally with
      CI covering typecheck, build, pack, and install on both platforms.
- [ ] There is no known data loss, credential exposure, startup failure, or failed
      mandatory release check.

If a general change lacks one platform's manual smoke test, the release notes must
say that the platform was not manually verified. The release must not describe the
missing check as passed. A change to platform-specific paths, permissions, or
terminal behavior remains blocked until it is manually verified on that platform.

Releases are made as needed under SemVer. During `0.x`, UI, CLI, and managed-field
breaking changes are allowed when release notes identify them. A patch must not
intentionally change the meaning of configuration already written. Security and
data-safety fixes normally ship as patches. Only the latest npm version receives
support; release notes record verified environments without creating a long-term
compatibility window.

- [ ] `tsup` emits a single ESM bundle with a `#!/usr/bin/env node` shebang, and the
      output file is executable.
- [ ] **No dynamic `import()` of scanned paths** anywhere — this is why §4.3 uses a
      static registry. A bundle cannot resolve them.
- [ ] `package.json` has `"bin": { "ccset": "./dist/cli.js" }`.
- [ ] `package.json` has `"publishConfig": { "access": "public" }` — **scoped
      packages are private by default and `npm publish` fails without it.**
- [ ] `"engines": { "node": ">=18" }`.
- [ ] `npm pack` contents reviewed: `dist/` and `README.md` only. No `src/`, no
      fixtures, no `.env`, no local settings files.
- [ ] Install from the packed tarball and run once before publishing.

---

## 7. Code-quality gates

Per project rules, enforced on every file touched:

- Functions ≤ 50 lines (excluding blanks); files ≤ 300 lines; nesting ≤ 3;
  positional parameters ≤ 3; cyclomatic complexity ≤ 10 per function.
- No magic numbers. Named constants at minimum for: `MAX_BACKUPS = 10`,
  `FILE_MODE = 0o600`, `DEFAULT_CLEANUP_DAYS = 720`, `DEFAULT_PROXY_URL`,
  `CONNECTION_TIMEOUT_MS`, `MASK_VISIBLE_CHARS = 4`, `EXIT_*` codes.
- `merge.ts` and `ReviewForm.tsx` are the two files most likely to breach the limits.
  Keeping the managed-key manifest as **data** in `manifest.ts` is what keeps both
  small; if either grows past 300 lines, the manifest has probably leaked logic.

---

## 8. Incidental finding from the design review

The review read `~/.claude/settings.any.json` and `~/.claude/settings.mmkg.json` to
determine the real provider-file shape. Both contain live third-party API tokens in
plaintext, and every `~/.claude/settings.*.json` on that machine is mode `0644`
(world-readable).

Actions, unrelated to ccset's code but relevant to the machine it was designed on:

- [ ] Rotate both tokens — they were surfaced into a review transcript.
- [ ] `chmod 600 ~/.claude/settings.*.json`.

This is also the concrete reason `PRD.md` §5.3 mandates `0600` rather than the
original draft's "`0600` or `0644`, depending on system defaults."

---

## 9. Implementation register (code complete)

### 9.0 Runtime prototype smoke test (2026-08-30)

Executed the built CLI with an isolated temporary `CCSET_HOME`, Node PTY, and
`COLUMNS=80 LINES=24`.

- `npm run typecheck`: passed.
- `npm run build`: passed; `dist/cli.js` emitted successfully.
- Main menu: rendered with five actions, detail text, numeric shortcuts, and
  the expected navigation help. A single registered agent skipped agent select.
- Global ReviewForm: rendered seeded defaults, changed markers, field hints,
  Save/Cancel rows, and the proxy toggle explanation without visible overlap.
- Status: rendered state/global/providers/backups sections and action list. The
  empty-provider state and absent files were visible and readable at 80 columns.
- Confirm page: rendered the destructive warning over wrapped lines and placed
  the cursor on `Cancel` by default; numeric selection reached the page.
- Narrow-layout result: no observed label/value overlap or terminal corruption
  in these screens at 80 columns. Long values and copy-ready commands still
  need a fixture-driven check with deliberately oversized URLs/paths.

This was a smoke test only; the data-safety, malformed JSON, masking, and
save/exit scenarios below remain pending unless separately marked.

### 9.0.1 Follow-up narrow-layout check (2026-08-30)

Ran Status at `COLUMNS=80` with an intentionally long `CCSET_HOME` path and a
malformed `settings.bad.json` fixture. Long paths wrapped across lines without
label/value overlap or terminal corruption; the malformed provider remained
visible as an error entry. The menu detail and Status value cells now explicitly
use shrinkable flex regions (`flexGrow`/`flexShrink`) so long unbroken values
have room to wrap. The full long-URL provider fixture is still pending.

After this layout fix, `npm run typecheck`, `npm run build`, and
`git diff --check` were rerun successfully.

Secret masking remains supported by the existing `Field.tsx` implementation
(`ink-text-input` mask on focus and `maskSecret` when blurred), but a complete
interactive token-entry transcript was not captured in this pass. Dirty-exit
and malformed-save confirmation likewise remain manual follow-ups.

The Milestone 1 surface is written: `src/cli.tsx`, `src/ui/App.tsx`,
`useScreens.ts`, `Menu.tsx`, `Status.tsx`, `Views.tsx`, the `src/i18n/en.ts`
catalog, `src/agents/claude-code/save.ts`, and `README.md`.

### 9.1 Static checks already performed

Read-only checks, no build and no execution:

- **i18n completeness, both directions.** Every key-shaped string literal under
  `src/` resolves to an entry in `en.ts`, and every entry in `en.ts` is reachable.
  Both difference sets are empty. The check covered indirect references as well
  as literal `t('…')` calls: `FieldSpec.labelKey`/`helpKey` from `manifest.ts`,
  the keys returned by `core/validate.ts`, `ProbeResult.key`, `CcsetError`
  `messageKey`, and the two template-built families (`prompt.${kind}Line` etc.
  and `` `${action.labelKey}Detail` `` behind `hasKey`).
- **File sizes.** Every file is under the 300-line limit; the largest is
  `agents/claude-code/actions.ts` at 230 lines.
- **Dead-export sweep.** `successMessage` and `WriteReport` moved to `save.ts`
  with no stale references left behind.
- **No secret-shaped literals** anywhere in `src/`, the Markdown, or the JSON.

### 9.2 Design decisions made while finishing, worth knowing about

- **Screen stack with selective reload** (`ui/useScreens.ts`). A frame keeps its
  producing task only when the screen it produced was a `list` or `status` —
  both reads. Going back to a provider list after a save therefore re-runs the
  listing and shows the file that was just written. A `replace()` result
  (a save's success message, a confirm's outcome) never keeps a task, so backing
  out of a message can never re-run the write behind it. **T7 verifies this.**
- **A confirm stacks; it never supersedes.** A save that returns a question
  rather than a result — the malformed-target case below — is pushed on top of
  the form instead of replacing it, and `App.submit` parks the submitted values
  on the form's frame first. Declining therefore returns a form that still holds
  the token the user typed. Without both halves, refusing to overwrite a broken
  file would cost the user their input, which is the outcome the refusal exists
  to prevent. **T11 verifies this.**
- **Malformed-target recovery** (`agents/claude-code/save.ts`). PRD §4.4 exit
  code 4 says "offers to back it up and start fresh; never silently overwrites".
  A save that hits `JsonParseError` now returns a confirm screen instead of
  aborting the process; only on confirmation does `saveGlobal`/`saveProvider`
  take the `startFresh` path, which skips the read and writes over `{}`. The
  backup is taken in both paths, so the unreadable original survives.
- **Confirm screens start on the safe row.** `SelectList` gained an
  `initialIndex`; every confirm and the unsaved-edits prompt point the cursor at
  Cancel, so a stray Enter cannot clear backups or transmit a token.
- **`detect()` is advisory.** A false result renders a note in the main menu
  rather than hiding the agent — ccset can legitimately configure Claude Code
  before it has ever run.
- **Argument parsing runs before the TTY guard**, so `ccset --help` and
  `--version` still work in a pipe and exit 0. Only the interactive path exits 2.

### 9.3 New runtime checks required

| # | Check | Pass condition |
| --- | --- | --- |
| T1 | `import packageJson from '../package.json'` in `cli.tsx`. | `ccset --version` prints the `package.json` version from the built bundle. tsup is expected to inline the JSON; if it emits a bare specifier instead, Node ESM will demand an import attribute — fall back to a constant in `core/constants.ts` and record the drift risk. |
| T2 | `ink-text-input` v6 exposes the `mask` prop used by `ui/Field.tsx`. | Typing into the token field shows `•`, never the characters. **This is the masking-on-entry guarantee in §3; if the prop is gone, the field must not fall back to plain text.** |
| T3 | Several mounted `useInput` consumers at once (App + ReviewForm + TextInput). | Esc reaches App's handler and goes back while a text field has focus; arrow keys still reach the form; no double handling. |
| T4 | Back out of a saved provider into the provider list. | The list re-runs and shows the new or edited file (§9.2 reload rule). |
| T5 | Enter pressed immediately on any confirm screen. | Nothing happens beyond cancelling — the cursor starts on the safe row. |
| T6 | Save against a `settings.json` that is malformed JSON. | Confirm screen appears; declining writes nothing; confirming produces a backup that still holds the malformed original, and a target containing only managed keys. |
| T7 | Esc from a save-success message. | Returns to the screen beneath, and **no second write occurs** — verify by mtime and backup count. |
| T8 | Fatal error path: make `~/.claude` read-only, then save. | Ink unmounts and restores the terminal *before* the message is printed; message on stderr; exit 3; nothing written. |
| T9 | Exit with unsaved edits, via both Esc and the Cancel row. | The prompt appears in both cases and "Keep editing" returns to the form with the edits intact. |
| T10 | Terminal narrower than the 30-column label gutter in `ui/Field.tsx` and the 22-column gutter in `ui/Status.tsx`. | Rows wrap without corrupting the layout (relates to E6). **Partial:** 80-column long-path Status check passed; narrower-than-gutter and long-URL fixture remain pending. |
| T11 | Fill in a provider form against a malformed target, save, then decline the "start fresh" question. | The form comes back with every field as typed, the token included; nothing was written; the backup directory did not grow. |
| T12 | Save a form whose **first invalid field is advanced**, and one whose invalid field sits before an advanced field in the manifest. | The Advanced section expands and the cursor lands on the offending field itself. `ReviewForm.save` now maps through `rowIndexOf` because a manifest index equals a row index only while every advanced field trails the list; `PROVIDER_FIELDS` currently satisfies that, so a regression here would be silent until a manifest interleaves them. |

### 9.4 Not built, by design

Milestone 1 stops here. Not present, and not stubbed: `apiKeyHelper` support
(gated on U1), a second agent module (M2), non-interactive mode (M3), and any
additional i18n catalog. `--agent <id>` is parsed and validated but has only one
legal value while the registry holds one agent.

### 9.5 Build and package gate (2026-08-30)

- `npm run typecheck`: passed.
- `npm run build`: passed; `dist/cli.js` emitted as a single ESM bundle.
- `npm pack --dry-run`: passed; tarball contents are limited to `dist/`, the two
  READMEs, `LICENSE`, and `package.json`.
- `git diff --check`: passed.

External or interactive checks remain pending: D1-D9 fixture-driven write tests,
E1-E6 platform checks, T1-T12 runtime checks, U1-U5 experiments, and a full
tarball install smoke test.

### 9.6 Non-interactive runtime spot checks (2026-08-30)

- `node dist/cli.js --version`: passed, printed `0.1.0`.
- `printf '' | node dist/cli.js`: passed, exited `2` with a clear non-TTY
  message and no ANSI escape sequences.

These checks cover T1 and E1; the remaining runtime scenarios are still pending.

### 9.7 Global settings preservation (2026-08-30)

`npm run verify:global-settings` passed against the real `saveGlobal` path in an
isolated temporary home. The repeatable fixture verifies:

- D1 and D3: unmanaged top-level values and nested objects (`hooks`,
  `statusLine`, `enabledPlugins`, `effortLevel`, `tui`, `verbose`, and a custom
  `env` key) remain structurally identical after managed values change.
- D2: disabling the proxy removes both `env.HTTPS_PROXY` and `env.HTTP_PROXY`;
  neither is retained as an empty string.
- D8: a second save with identical values produces byte-identical target
  content. Its backup is exactly the complete result of the first save.
- The first backup is byte-identical to the original file, every resulting file
  parses as complete JSON, and the target and backups are mode `0600` on POSIX.

The verification uses only generated placeholder values and removes its
temporary home and bundle after completion. `npm run typecheck`, `npm run
build`, and `git diff --check` also passed after adding the fixture.

### 9.8 External platform and Claude Code gates (2026-08-30)

This audit records only evidence available in the current environment. It does
not treat a local build, an installed executable, or a proposed CI workflow as a
substitute for a real platform or provider experiment.

| Gate | Result | Evidence / remaining work |
| --- | --- | --- |
| U1: `apiKeyHelper` on the third-party Bearer path | **Pending** | Claude Code `2.1.251` is installed, and its help describes `apiKeyHelper` for Anthropic API-key authentication. No disposable third-party provider credential was available, so no request was sent and Bearer behavior remains unknown. |
| U2: `--settings` precedence and `env` merge behavior | **Pending** | `claude --settings` is present, but proving effective values requires an isolated real Claude Code run with conflicting global/provider settings. No user settings or credentials were used or changed during this audit. |
| U3: settings-file `fallbackModel` shape | **Pending** | Claude Code help confirms that the CLI flag accepts a comma-separated list, but that does not prove whether settings JSON accepts `string[]` or a string. Both forms still need isolated real runs. |
| U4: Claude Code backup pruning | **Pending** | Testing requires placing a marked foreign file under Claude Code's backup area and waiting for real rotation. The current audit did not mutate `~/.claude/backups/`; ccset's separate `backups/ccset/` directory remains the conservative design. |
| U5: npm scope ownership and publish authentication | **Pending** | `npm whoami` failed with `ENEEDAUTH`. An unauthenticated `npm org ls droite --json` returned `{"droite":"owner"}`, which shows registry-side organization data but does not identify an authenticated publisher or prove this machine can publish `@droite/ccset`. Re-run both commands with the intended publisher logged in before release. |

Runtime compatibility checks used the built `dist/cli.js` on Linux x64. Node
`18.20.8`, `20.19.5`, and `22.23.2` each exposed global `fetch`, printed ccset
version `0.1.0`, and handled non-TTY input with exit code `2`, a clear message,
and zero ANSI escape bytes. This passes that bounded Linux/non-interactive check
for E1 and E2; it is not a full interactive smoke test for every Node version.

Platform status is therefore:

- **Linux x64: partial pass.** The Node matrix above passed, and §9.0 records an
  interactive PTY smoke test in this environment. Real provider behavior covered
  by U1-U3 and the remaining interactive/data-safety scenarios are separate gates.
- **macOS: pending.** No macOS runner or manual terminal was available. The core
  flow has not been evidenced on macOS in this register.
- **Windows/WSL: pending, best-effort.** No Windows Terminal, PowerShell, or WSL
  run was available. The README correctly limits the `0600` guarantee to POSIX
  and labels native Windows best-effort and unverified.

The untracked `.github/workflows/ci.yml` describes Ubuntu jobs for Node 18/20/22,
but it has no GitHub Actions runs and covers neither macOS nor Windows. It is not
counted as evidence. Before an npm release, the maintainer must still record a
macOS core-flow smoke test, authenticate as the intended npm publisher and pass
U5, and either execute U1-U4 or explicitly keep dependent features and claims
blocked. Release notes must name only the environments actually verified.

### 9.9 Provider settings and credential safety (2026-08-30)

`npm run verify:provider-safety` passed against the real provider save, backup,
Status, masking, and connection-error paths in an isolated temporary home:

- D7: nested unmanaged provider keys and a custom nested `env` value survive
  edits unchanged.
- D9: thirteen writes to one provider retain exactly ten backups, while a write
  to a second provider retains its own backup independently.
- The provider files and every retained backup are mode `0600` on POSIX.
- Status contains the fixed-width masked token and never the complete token;
  masks for different token lengths have the same displayed length.
- The focused secret field still passes `MASK_CHAR` to the installed
  `ink-text-input` `mask` prop, and the blurred field uses `maskSecret`.
- A simulated transport exception containing the complete token produces only
  a sanitized probe result; the token is absent from the serialized error path.

The fixture contains only an obvious test token and removes its temporary home
and bundle. `npm run typecheck`, `npm run build`, and `git diff --check` passed
after the verification was added.

### 9.10 Malformed recovery and dirty-exit flows (2026-08-30)

`npm run verify:malformed-dirty` passed through the built CLI in an isolated
Linux PTY and temporary home:

- T6: after the global form opened, the target was replaced externally with
  malformed JSON. Saving displayed the explicit backup-and-start-fresh
  confirmation. Declining left the target byte-identical, created no backup,
  and returned to the form with the changed proxy value intact. Confirming then
  wrote only managed values and preserved the complete malformed original in a
  backup.
- T9: leaving an unchanged form returned directly to the menu. Both Esc and the
  Cancel row displayed the unsaved-edits prompt after a change; Keep editing
  returned to the same form with that change intact, and explicit discard
  returned to the menu.

The PTY check exposed and fixed a state-lifetime defect: rendering the prompt in
place of `ReviewForm` unmounted the form and discarded its local draft. The app
now keeps the form mounted but hidden while the prompt owns input, so declining
the prompt preserves the draft without allowing both controls to handle a key.
The generated fixture and verification bundle are removed after every run.

### 9.11 Status and terminal boundaries (2026-08-30)

`npm run verify:status-terminal` passed against `buildStatus` and the built CLI
using an isolated temporary home:

- Complete, incomplete, and malformed `settings.<name>.json` files are all
  returned in filename order; one malformed file does not hide the others.
- Status includes each absolute provider path and its absolute `claude
  --settings` activation command. The complete token is absent while the
  fixed-width masked token is present.
- A deliberately long provider URL remains complete in the Status data. A
  provider added after the first read appears on the next read, proving that
  reopening Status refreshes the filesystem listing.
- `--version` succeeds without a TTY and matches `package.json`. Empty piped
  input exits `2`, writes a clear terminal error, and emits no ANSI escape byte.

A separate real Ink PTY smoke test entered Status directly from the single-Agent
menu at 40 columns. Long absolute state, settings, and backup paths wrapped
without overlap or terminal corruption; Esc returned to the menu and a second
Esc exited with code `0`. A 28-column main-menu run also wrapped and exited
cleanly. This completes E1, T1, and the narrow-layout and Status/list-refresh
checks scoped by issue #5. The resize-during-render portion of E6 remains a
separate manual platform check; provider editing and dirty-exit flows remain
covered by their separate verification ticket.

### 9.12 Installed release artifact (2026-08-30)

`npm run verify:release-artifact` passed using a newly built tarball installed
into an isolated temporary npm project:

- The tarball contains exactly `dist/cli.js`, `package.json`, `LICENSE`,
  `README.md`, and `README.zh-CN.md`; it contains no source, fixtures, local
  configuration, or environment files.
- The installed package exposes `ccset` as `./dist/cli.js`, declares Node
  `>=18`, and has public scoped-package publish metadata.
- `dist/` contains one ESM bundle. It starts with the Node shebang and retains
  executable permission on POSIX.
- The installed `node_modules/.bin/ccset --version` prints `0.1.0`.
- Launching that installed bin without a TTY exits `2`, prints the clear
  terminal requirement, and emits no ANSI escape bytes.

The tarball, installed project, and verification bundle are removed after the
run. This validates the artifact locally; npm publisher authentication (U5) and
the pending macOS/Windows gates in §9.8 remain separate release prerequisites.

### 9.13 Rendered-paint interface gate (2026-08-31)

`npm run verify:ui-render` passed. It is the first gate that renders: the other
five assert on data and on the CLI boundary, which left every interface change
unverifiable. It mounts the real component tree against an isolated temporary
home through `ink-testing-library` (a devDependency, version `4.0.0`) and drives
it with simulated key input only — no component is called directly.

The drive: numeric shortcut into Providers, numeric shortcut into the provider
review form, two Down keys onto the Auth token row, Esc back to the list, Esc to
the menu, numeric shortcut into Status, Enter onto the clear-backups confirm,
Esc out. 25 Rendered paints were captured.

- The provider token appears in **none** of the 25 paints. The fixed-width
  masked form appears in the review-form paint and the Status paint, and the
  focused field paints one mask character per token character. This is §3's
  "masked on display in Status, review screen" checked at the paint rather than
  at the data.
- No paint carries more than one focus marker, and each of the five visited
  Screens — menu, provider list, review form, Status, confirm — carries exactly
  one. A paint with none stays legal: a message Screen and the busy line have
  nothing for Enter to land on.
- The clear-backups confirm opens on Cancel. The run never confirms it, so the
  gate writes nothing and clears no backup.
- Ink registers its stdin listener from an effect, so a key written on the paint
  that follows mount is never read. The harness re-sends a key until Ink has
  consumed it rather than sleeping for a guessed interval.

Each assertion was proven capable of failing, by introducing a real regression,
confirming the gate went red, and reverting:

| Regression | Gate result |
| --- | --- |
| `Field.tsx` renders an unfocused secret unmasked | red: masked token missing from the review-form paint |
| `Field.tsx` appends the field value to the focused field's hint | red: the token reached a Rendered paint — caught by the all-paints sweep, which the per-Screen assertions passed |
| `SelectList.tsx` prints the focus marker on every row | red: the main menu paint has no single focused row |
| `Views.tsx` points a confirm's cursor at the destructive row | red: a destructive confirm must open on the safe row |

`npm run typecheck` and all six verify gates pass. `verify:release-artifact`
gained one assertion: installing the tarball pulls in no `ink-testing-library`,
so the test renderer cannot reach a user's machine.

No `src/` file changed — `git diff src/` is empty — so this records the
interface as it stands rather than an interface adjusted to be testable.

Scope limits, both deliberate: the test renderer reports a fixed 100 columns and
nothing in `src/ui/` measures the terminal, so ADR 0002's windowed-region
invariants are not yet expressible and are not asserted here. The gate is not
wired into CI, matching the other five.
