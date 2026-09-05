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
| U6 | When both `~/.config/opencode/opencode.json` and `opencode.jsonc` exist, which does opencode load — and does it merge them or pick one? | Write a distinguishing key into each, launch opencode, inspect the effective value. | Answered from source at v1.18.25 (issue #39): both load, merged per key, `.jsonc` last, so the `.jsonc` wins conflicts. The decision that follows — ccset writes the `.jsonc` (issue #46, §9.34) — is implemented; the runtime experiment itself has not been run, so the row stays open. |
| U7 | ~~Can a TOML config be round-tripped without losing comments, key order, and formatting, using a format-preserving parser?~~ **Answered 2026-09-01, see §9.26.** Yes, by editing the document in place rather than re-serialising it (ADR 0003). A corpus of 13 documents — comments, CRLF, no trailing newline, `#` inside strings, quoted and dotted keys, multi-line arrays and strings, inline tables, arrays of tables, literal Windows paths, date-times, radix integers — is byte-identical after an empty write list, and stays so after a managed edit elsewhere in the file. | Take a real `~/.codex/config.toml`, parse and re-emit it unchanged, byte-compare. | Was: a Codex CLI agent, and the `Codec` seam being real rather than notional. Both are now built. |
| U8 | Does a custom `model_providers.<id>` entry with `requires_openai_auth = true` actually authenticate against a third-party endpoint using the credential in `auth.json`? | Point a Codex provider at a real Responses-API-compatible endpoint, switch to it with ccset, run one prompt. | Whether ccset's Codex provider blocks work end to end. The mechanism is read from Codex's own source (`resolve_provider_auth` in `codex-rs/model-provider/src/auth.rs`, v0.152.0) and matches its tests, but no live request has been made. |
| U9 | When `cli_auth_credentials_store = "keyring"`, does Codex ignore `auth.json` entirely? | Set the key, log in, inspect whether `auth.json` is written or read. | Whether ccset's Status warning is a warning or must become a refusal to offer profile switching. |

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

The same failure mode in the second agent's shape — one document, providers as
nested keys — is covered by the O-series:

| # | Test | Pass condition |
| --- | --- | --- |
| O1 | Save a provider block against an `opencode.json` holding `theme`, `keybinds`, `mcp`, a second provider, and `options.headers` inside the edited provider. | Every unmanaged key survives, including a sibling of a managed key four levels deep. |
| O2 | Blank a field; set an int field. | The key is omitted entirely — no `null`, no `""` — and the int is written as a number. |
| O3 | Set `autoupdate` off; set `disabled_providers`. | `false` is a JSON boolean, not `"false"`; the CSV is a JSON array. |
| O4 | Edit the `models` list: keep one id, add one, drop one. | The kept id retains its unmanaged options, the new id appears as `{}`, the dropped id is gone. |
| O5 | Set a managed choice to Unmanaged. | The key is deleted from the file. |
| O6 | 13 consecutive writes. | Exactly 10 backups under `~/.config/opencode/backups/ccset/`, all `0600`; Status shows the masked key and never the whole one. |
| O7 | An `opencode.jsonc` beside the managed file. | The `.jsonc` is the managed target: ccset writes it in place — comments, order and formatting survive — and the legacy `.json` is byte-identical after a save. Status names the `.jsonc` as the managed path and the `.json` as not managed. (Revised by #46; was "names it and warns, never writes".) |
| O8 | Only `opencode.json` exists. | Target, bytes and Status are as before the change: the save lands in the `.json`, no `.jsonc` is created, and no not-managed section appears. |
| O9 | The round trip: values seeded from a `.jsonc`, then saved. | Effective values read back correctly, and every comment written before the save survives it verbatim. |
| O10 | A `.jsonc` that fails the syntax pass. | The same start-fresh confirm a malformed JSON target gets; the broken original survives in the backup. |
| O11 | An empty write list over a corpus of JSONC documents; a managed edit elsewhere in each. | Byte-identical empty round trip; the managed edit leaves every other byte identical. Runs inside `verify:opencode` (verify-opencode-jsonc.ts), the way C1's corpus runs inside `verify:codex`. |

The third agent adds two shapes neither of the others has: a document that is
not JSON, and a credential that lives outside it. Those are the C-series:

| # | Test | Pass condition |
| --- | --- | --- |
| C1 | Read a hand-written `config.toml` and apply an empty write list, over a corpus of 13 documents. | Byte-identical output (U7). Every value reads back with the right type, including radix integers, arrays of tables, and multi-line strings. |
| C2 | Save a provider against a `config.toml` carrying comments, aligned assignments, an array of tables, and `http_headers` inside the edited table. | Comments, alignment, blank lines and key order survive; the edit touches its own value span only; the result is still valid TOML. |
| C3 | Save any ccset-managed provider. | `wire_api = "responses"` and `requires_openai_auth = true` are written as a bare string and a real TOML boolean, and are re-asserted on every save. |
| C4 | Blank a field that is on disk; set an int field. | The key's whole line is removed — not blanked — and the int is written unquoted. |
| C5 | Set a managed global choice to Unmanaged; set one that needs a table that does not exist. | The key is deleted; the missing table is created without disturbing the document around it. |
| C6 | Save a provider with an API key. | The key appears in `~/.codex/auth.<id>.json` at `0600` with `auth_mode: "apikey"`, and **nowhere** in `config.toml`. |
| C7 | Switch to a provider while `auth.json` holds a ChatGPT login. | The old file is copied byte-for-byte to the named profile, backed up, then replaced; `model_provider` is routed; the live file is recognised as matching its profile afterwards. `auth.json` itself is never offered as a switchable profile. |
| C8 | Remove a saved credential. | The sidecar is gone, a second removal reports nothing to do, and the provider block in `config.toml` is untouched. |
| C9 | 13 consecutive writes. | Exactly 10 backups under `~/.codex/backups/ccset/`, all `0600`; Status shows the masked key, never the whole one, and never an adopted OAuth token. |

`verify:codex` also walks every screen the agent can produce and asserts that
every i18n key resolves — including the ones reached indirectly through
`labelKey`, `helpKey`, `detailKey` and a choice's label, which a grep for `t()`
cannot see.

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
| F11 | Save fails against an unusable target after fields were typed. | The failure is a Screen of its own naming the path and required mode; `esc` returns to the form still holding every typed value, token masked; fixing the cause and saving again succeeds without retyping. |
| F12 | A partial backup copy exists (`.ccset-partial.*` from an interrupted backup). | Status lists it with a warning and a count; **Clear ccset backups** removes it together with the finished backups. |

---

## 5. Environment and platform

| # | Test | Pass condition |
| --- | --- | --- |
| E1 | `echo "" \| npx @droite/ccset` (non-TTY). | Clear message, exit code **2**, no ANSI escapes in the pipe. |
| E2 | Node 18, 20, 22. | Runs; global `fetch` available on all three. |
| E3 | `~/.claude/` read-only (chmod 500). | Core raises `error.permission` naming the path and required mode, with no partial state — asserted at the module level by `verify:write-safety`. The interactive app renders the same failure as a recoverable error Screen and keeps the session; see F11 and §9.27. |
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
| T13 | From the first editable row of each review form, press `Ctrl+S` in a real terminal (Linux and macOS). | The form follows the Save row's validation path: valid input writes, while an invalid hidden advanced field expands and receives focus. Enter still advances one row. Automated `verify:review-form` covers the component path; real-terminal evidence: Linux x64 PTY verified 2026-08-31. macOS verification remains pending before claiming the supported-platform check. |
| T14 | Open a three-Frame path at wide and narrow terminal widths under the Unicode and ASCII capabilities. | The header names every Frame when it fits; once wider than the Viewport, it shows an ellipsis followed by the final two titles. Unicode uses `›`, ASCII uses `>`, and the top-level menu has no Frame path. Automated by `npm run verify:header-path`. |

### 9.4 Not built, by design

> **Superseded in part by §9.25 (2026-09-01) and §9.27 (2026-09-01).** The second
> agent and the agent-selection screen are now built; `--agent` has three legal
> values, and the second i18n catalog (`zh-Hans`) has shipped. This entry is left
> as written because §9 is append-only. `apiKeyHelper` and non-interactive mode
> remain unbuilt.

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

### 9.14 Terminal capability: one owner for glyphs and colors (2026-08-31)

`src/ui/terminal.ts` now owns the glyph set and the color set. Before it, `cyan`
appeared in six files and the focus marker `❯` in three, so changing how focus
reads was a scattered edit; both now resolve from one module and no component
names a color. This is a prefactor — no observed behaviour changed with the
Unicode set, which is what the render gate holds it to.

`CCSET_ASCII=1` selects an all-ASCII glyph set (focus `>`, radio `(*)`/`( )`),
following the precedent `CCSET_HOME` set: an environment override read once, at
the boundary. `App` takes the capability as a prop, so the gate selects a set
without mutating `process.env` under a running render.

Two things deliberately stayed out. `MASK_CHAR` is not in the glyph set: it is
load-bearing rather than decorative — `core/mask.ts` builds masked values that an
agent puts into Status *data*, and the agent layer knows nothing about the
terminal. And no monochrome switch was added: Ink already honours `NO_COLOR`, so
a second switch could only disagree with it. The `↑↓ · ←→` characters in the help
lines are catalog strings, not glyphs, and are unchanged.

Those two omissions bound what the flag delivers, and review caught the README
overclaiming past them: `CCSET_ASCII=1` was described as drawing the interface
with an ASCII-only glyph set, which a reader on the `LANG=C` console this flag
exists for would take as a seven-bit interface. It is not one — a paint under the
ASCII set still carries `↑↓ · ←→` from `menu.help`, `status.help` and `form.help`
and `•` from `MASK_CHAR`, so a `\x20-\x7e` assertion over the ASCII run's paints
would go red today. Both READMEs now name the flag's limit instead. Extending the
set to cover the help lines is an i18n-catalog change and the mask is across the
agent seam; neither is in this ticket.

`npm run verify:ui-render` runs the whole drive **twice**, once per glyph set,
and passed: 25 Rendered paints each. The focus-marker count changed from a
substring count to a line-anchored one, because the ASCII marker is `>` and
`settings.<name>.json` puts that character into painted text — only a marker in a
row's gutter means focus. The gate also asserts, without touching
`process.env`, that `CCSET_ASCII=1` resolves to the ASCII set, that an unset
value resolves to the Unicode set, that every ASCII glyph is in `\x20-\x7e`, and
that the two focus markers actually differ.

`scripts/ui-session.ts` was split out of the gate to hold the harness. The gate
had 295 of its 300 permitted lines, and parametrising it by glyph set would have
breached the limit; the split keeps the drive and the invariants in
`verify-ui-render.ts` and puts no assertion about ccset in the harness.

Proven capable of failing, per glyph set — `SelectList.tsx` printing the focus
marker on every row went red on both:

| Glyph set | Gate result |
| --- | --- |
| Unicode | red: the main menu paint has no single focused row (actual 5, expected 1) |
| ASCII | red: same assertion, actual 5 — so the line-anchored count found the five gutter markers and was **not** inflated by the `>` inside `settings.<name>.json` |

`npm run typecheck`, `npm run build`, and all six verify gates pass on Linux x64
/ Node 20.19.5.

The env var was also driven through the built `dist/cli.js` in a real PTY, since
the render gate mounts `App` directly and so never executes `resolveTerminal()`
in `cli.tsx`:

| Environment | Main menu | Choice radio |
| --- | --- | --- |
| unset | `❯` present | `(•)` / `( )` |
| `CCSET_ASCII=1` | `❯` absent, `> 1. Global settings` painted | `(*)` / `( )` |
| `CCSET_ASCII=0` | `❯` present — only `1` switches | `(•)` / `( )` |

### 9.15 Terminal folding closes the seven-bit gap (2026-08-31)

§9.14 recorded `CCSET_ASCII=1` as switching four decorative glyphs and named the
gap that left: a paint still carried `↑↓ · ←→` from the help lines and `•` from
`MASK_CHAR`, so the console the flag exists for still got replacement glyphs.
That gap is now closed. `Terminal` carries a `fold`, identity for the Unicode set
and a punctuation map for the ASCII set, applied at the UI paint boundaries; and
the glyph set carries the `mask` character the secret editor draws with.

`MASK_CHAR` stayed in `core/constants.ts` and `maskSecret()` is unchanged —
signature, visible-character count and fixed-width middle all identical. Its
output is Status *data* an agent assembles, and the agent layer knows nothing
about the terminal, so the fold converts the `•` run at paint time instead. The
fold maps only the characters `en.ts` actually uses and passes everything else
through, so a future non-English catalog is not transliterated.

`verify:ui-render` asserts every Rendered paint of the ASCII run matches
`` `/^[\x20-\x7e\n\r\t]*$/` `` — Ink's line breaks and tabs beside printable
ASCII, and nothing else. `\s` was rejected for that character class because it
admits U+00A0, U+2028 and U+3000, which are exactly what the assertion exists to
catch. The Unicode run is left unrestricted.

Proven capable of failing. Removing the fold from `menu.help` — a paint no other
assertion depends on, so only this one can catch it — gave:

| Glyph set | Gate result |
| --- | --- |
| Unicode | green, 25 paints: the assertion does not fire on the Unicode run |
| ASCII | red: `A paint under the ASCII set carries a character it cannot draw`, and the reported paint showed `↑↓ move · 1-9 jump …` unfolded while the same paint's focus marker was already `>` |

The fold was restored (`git diff --stat` back to its pre-experiment 5/4) and both
runs returned green.

End-to-end through the built artifact, since the render gate mounts `App`
directly and never executes `resolveTerminal()`. `dist/cli.js` driven in a real
PTY, ANSI stripped, every code point above U+007E collected:

| Environment | Code points above U+007E in the paint |
| --- | --- |
| unset | `U+00B7 ·`, `U+2014 —`, `U+2191 ↑`, `U+2193 ↓`, `U+276F ❯` |
| `CCSET_ASCII=1` | none |

Review of the first implementation found four defects, all fixed before this
entry was written:

- `useTerminal()` was called inline in JSX in three places, one of them inside a
  `notes.map()` callback in `FormNotes`, which returns `null` above that map.
  The hook therefore ran zero times on some renders and once per note on others
  — React's "rendered more hooks than during the previous render". Hoisted above
  the early return in all three.
- `FieldValueView` destructured `glyphs` and `fold` and used neither.
- The paint regex had been reused for the per-glyph ASCII check with a `*`
  quantifier, which silently made an **empty** glyph pass. Split into
  `ASCII_GLYPH` (`+`) and `ASCII_PAINT` (`*`).
- The fold's character class was written out a second time beside the map, so
  adding a fold could silently fail to apply. It is now built from the keys.

`npm run typecheck`, `npm run build` and all six gates pass on Linux x64 / Node
20.19.5, run sequentially. Sequentially matters: run in parallel, the gates fail
spuriously, because each one is `tsup --clean` against the shared `dist/` and
`.verify/` directories, so one run empties what another is reading — that
presents as `verify:status-terminal` seeing an empty `--version` and
`verify:release-artifact` finding no tarball. Neither is a regression.

Known limit, accepted: the fold applies to agent-provided values as well as
catalog strings, so under `CCSET_ASCII=1` a value containing one of the folded
characters paints folded. For the copy-ready `claude --settings <path>` line of
F9 that means a path containing, say, an em-dash would print with `--` and would
not run as printed. No such path occurs in any fixture, and the alternative —
folding catalog text but not the masked values that arrive as data — would
reopen the gap this entry closes.

### 9.16 Folding reaches the last paint sites (2026-08-31)

§9.15 applied `fold` at the UI paint boundaries. Review before merge found five
paint sites it had not reached: the header's screen title, application title and
tagline (`App.tsx`), the agent-select title (`Menu.tsx`), a Status line's label
(`Status.tsx` — whose value, note and section title were already folded), the
review form's control-row labels (`ReviewForm.tsx`), and `SelectList`'s empty-list
line. Every one of those catalog strings is seven-bit today, so no paint changed
and the gate was green before the fix as well as after. What changed is the rule:
every paint site folds, rather than every paint site whose string happens to be
ASCII this week.

Proven capable of failing, since a fix that changes no paint has to be shown to
be load-bearing. `app.tagline` was temporarily given an em dash — the header is
painted on every Screen, and no other assertion reads it:

| Header fold | Gate result |
| --- | --- |
| present | green, 25 paints per glyph set |
| removed | Unicode green; ASCII red, `A paint under the ASCII set carries a character it cannot draw` |

Both the fold and the tagline were restored, and `git diff src/i18n/` is empty.

Two paint sites stay unfolded on purpose. The focus and changed gutters come from
the glyph set itself, which the ASCII set already guarantees is `\x20-\x7e`. And
the value inside a focused text editor is the core user's own input — folding what
someone is typing would rewrite it under the cursor, and a secret is masked there
by the glyph set rather than shown.

`npm run typecheck`, `npm run build` and all six verify gates pass on Linux x64 /
Node 20.19.5, run sequentially.

One flake worth recording rather than papering over. `npm run verify:malformed-dirty`
failed on its first run of this session and passed on the four later runs — one
immediately after, three back to back. The failure was in the run's second PTY
session, which timed out after its 5-second budget waiting for the main menu with
**empty** output: the built CLI had painted nothing at all. The first run is the
cold one, spawning `python3`, a `pty.fork()` and a cold `node dist/cli.js`, so the
5-second first-paint budget is the suspect rather than anything in ccset — the
earlier phase of that same run, which exercises the malformed-target confirm and
the backup, had already passed. Left as it is: a longer budget is the fix if it
recurs, but it also buys a slower red.

### 9.17 Viewport-windowed regions (2026-08-31)

`npm run verify:ui-render` now mounts the application with an explicit 12-row,
80-column Viewport. Every captured Rendered paint is asserted to use no more than
12 rows. A separate 13-row menu proves that a long list is cut to four visible
rows plus a count line, Down keeps the focused row inside the window, and shortcut
`1` selects the first visible row rather than the first underlying item. Pressing
a digit outside that visible range is also asserted to do nothing.

The application resolves terminal rows and columns at runtime, falls back to 24
rows and 80 columns when the stream reports no usable dimensions, and subscribes
to the stream's `resize` event. Select lists, review-form rows, and Status rows use
the shared window calculation. Status actions stay below the windowed read-only
region, preserving access to actions while long status output is counted rather
than allowed to run off screen. A 40-column fixture with wrapping list details
proves that columns bound the physical window as well as rows.

### 9.18 Winning review-form treatment (2026-08-31)

Issue #18 applies treatment A2 from `proto/review-form-treatments`: the form
stays a flat row list, its label column measures the widest label across every
declared field (including collapsed advanced fields), and hints start at a
four-column indent. Measuring all fields keeps existing rows fixed when Advanced
is revealed. The measurement uses terminal display width rather than JavaScript
code-unit length.

`verify:review-form` renders the collapsed form at 80 and 60 columns under both
Unicode and ASCII terminal capabilities. It asserts that a hidden advanced label
sets the stable column, the focused hint uses the tightened indent, relevant rows
fit the column budget, and the ASCII paint contains only seven-bit characters.
The existing focus/window scenarios still cover advanced expansion, validation
hints and errors, and Save/Cancel reachability. `verify:ui-render` remains the
full-application physical-width gate for narrow Unicode and ASCII paints.

### 9.19 Frame path header (2026-08-31)

`npm run verify:header-path` drives the real `App` through a three-Frame nested
navigation using numbered key input. At 80 columns the header paints all three
titles. At 50 columns a double-width CJK first title proves terminal display width,
rather than JavaScript string length, triggers the ellipsis and retains the last
two titles. The same drive runs under Unicode and ASCII Terminal capabilities,
asserting `›` and `>` respectively, and checks that the top-level agent menu does
not paint a Frame path. The implementation derives titles from the existing stack;
it introduces no second navigation history.

### 9.20 Windowed Status sections (2026-08-31)

`npm run verify:ui-render` now proves the Status-specific contract at 12-row and
2-row Viewports: the sections region carries its own count line, long values are
expanded into physical display rows before the shared window calculation, and
the selectable action remains visible below that region and can be invoked. The
View still has no write callback for section data; only the existing action item
is selectable. Below seven rows the Status paint drops the application chrome so
the count and action own the available rows; at one row the action takes priority.

### 9.21 Write safety: the writes ccset must not make (2026-09-01)

`npm run verify:write-safety` closes the last unevidenced rows of §2 — D4, D5 and
D6 — and §5's E3. Every check ran against the real modules in an isolated
`mkdtemp` home on Linux x64, Node `26.7.0`.

- **D4.** A `~/.claude.json` of 103 KB, shaped like the live store (37 top-level
  keys, with 400 entries under `projects`), was fingerprinted by inode,
  `mtimeMs`, `ctimeMs`, size and bytes. `inspectState`,
  `createStateIfMissing`, two `saveGlobal` calls, a `saveProvider` call and
  `buildStatus` then ran against that home. Every field of the fingerprint was
  unchanged afterwards: ccset performed zero writes. Repeated with a *malformed*
  state file, `inspectState` reported `parsed: false` without repairing it and
  `createStateIfMissing` returned `created: false` rather than overwriting it.
- **D5.** From absent, the file is created with bytes exactly
  `{\n  "hasCompletedOnboarding": true\n}\n` — one key, no others — at mode
  `0600`. A second call returns `created: false` and leaves the inode and bytes
  untouched.
- **D6.** Twelve forked children each ran a real `saveGlobal` over a 6 MB target
  whose unmanaged blob the save has to preserve, and each was SIGKILLed at a
  staggered delay swept across one uninterrupted save (measured at 145-151 ms).
  Seven kills landed before the `rename()` and five after — the sweep straddles
  the commit point, so the run is not vacuously passing. **In all twelve the
  target parsed whole**, carried the complete unmanaged blob, and held either the
  old or the new `model`; none was truncated. Leftover temp files — none to one per
  sweep, depending which phase the signal lands in — were never at the target path
  and were always mode `0600`, so a crashed write leaves no world-readable token
  behind.
- **E3.** With `~/.claude` at mode `0500`, a save fails with exit code `3` and an
  `error.permission` naming a path and the required mode, on both routes: with no
  target the failure names `settings.json` at the temp write, and with a target
  present it names `backups/ccset` at backup-directory creation. Neither route
  left a partial write — the directory was empty in the first case and the target
  byte-identical in the second. The check is skipped, with the reason printed, on
  win32 and when `uid` is `0`, where the permission bits prove nothing.

Two limits of the method, stated rather than papered over:

1. SIGKILL kills the process, not the page cache, so D6 proves atomicity against
   **process death only**. `writeJsonFileAtomic` does not `fsync` before
   `rename()`, so nothing here speaks to power loss or a machine crash.
2. The kill delays are wall-clock, so which phase a signal lands in varies with
   machine load. The fixture calibrates against one uninterrupted save and
   asserts that both outcomes occurred, which fails loudly rather than silently
   passing if the window ever misses the write.

**Finding: backups are not atomic.** Of nine backups written during the D6 sweep,
one was left **unparseable** — `backup.ts:backupFile` runs `fs.copyFile` straight
to the final destination, so a crash mid-copy leaves a truncated file that is
indistinguishable by name from a good backup. The *target* is safe, which is what
D6 claims, but the backup is the user's only copy of the original when a save goes
wrong, and PRD §6.5 justifies ccset's own backup directory on the grounds that "a
scheme that silently loses backups is worse than none, because it would be relied
upon". Reproduced identically on two consecutive runs. Filed as issue #28; the
count is reported by the gate on every run and becomes an assertion once fixed.

**Finding: `verify:release-artifact` is broken by npm 12.** `npm pack --json`
returned an array up to npm 11 and returns an object keyed by package name in npm
`12.0.2`, so the gate's `packed.length` is `undefined` and it fails at its first
assertion. This is environment drift, not a regression in the artifact: the
tarball itself still contains exactly `LICENSE`, `README.md`, `README.zh-CN.md`,
`dist/cli.js` and `package.json`, verified by hand from the same `npm pack --json`
output. Filed as issue #29. **The other eight gates all pass** on this branch.

### 9.22 Release-artifact gate restored under npm 12 (2026-09-01)

Issue #29. `npm run verify:release-artifact` passes again on npm `12.0.2`. Two
independent npm 12 behaviour changes had broken it, both in the harness rather
than in the artifact:

1. `npm pack --json` reported an array through npm 11 and reports an object keyed
   by package name in npm 12, so `packed.length` was `undefined` and the gate died
   at its first assertion. The parse now accepts either shape; the Node 18/20/22
   matrix CI runs still emits the array form, so both have to keep working.
2. `npm install <tarball>` failed with `EALLOWSCRIPTS`. npm exports every config
   value as an `npm_config_*` variable into the child of an `npm run`, so the
   developer's `~/.npmrc` — which here sets `allow-scripts` — leaked into the
   nested install, and npm 12 rejects that option for a project-scoped install.
   The gate now drops `npm_config_allow_scripts` from the environment it hands to
   the nested npm, so the install behaves like a user's rather than the
   maintainer's.

No assertion was loosened: the tarball is still required to contain exactly
`LICENSE`, `README.md`, `README.zh-CN.md`, `dist/cli.js` and `package.json`, the
bin mapping, engines and `publishConfig` are still checked on the installed copy,
`ink-testing-library` must still be absent, and the installed executable must
still report the right version and exit `2` on piped stdin.

**All nine gates now pass** on Linux x64, Node `26.7.0`, npm `12.0.2`.

### 9.23 Backups made atomic (2026-09-01)

Issue #28, the finding recorded in §9.21. `backupFile` copied straight to the
final destination with `fs.copyFile`, which is not atomic, so a crash partway
through left a truncated file under a real backup name — indistinguishable from a
complete one, and outliving ten good backups, since `pruneBackups` evicts
oldest-first. One of nine backups in the D6 sweep was affected, reproduced on
three consecutive runs.

The copy now lands on a temp name and is renamed into place, the same shape
`writeJsonFileAtomic` already used for the target. The temp prefix is
`.ccset-partial.` and deliberately does **not** match `<basename>.backup.*`, so a
partial copy can never be listed, pruned, counted in Status, or restored as if it
were a finished backup. `clearBackups` was widened to remove those partial copies
too: they hold the same credential as the backup they were becoming, and the
action documented in the README as the way to remove old tokens would otherwise
leave one behind.

`verify:write-safety` now **asserts** `unparseableBackups === 0` rather than
counting it, which is safe to assert because the guarantee no longer depends on
kill timing. Across five runs of the sweep after the fix:

| Run | Backups | Unparseable | Partial copies |
| --- | --- | --- | --- |
| 1 | 9 | 0 | 0 |
| 2 | 8 | 0 | 1 |
| 3 | 9 | 0 | 0 |
| 4 | 9 | 0 | 0 |
| 5 | 8 | 0 | 0 |

Run 2 is the mechanism working: the kill that would previously have truncated a
backup instead left a partial copy under the temp prefix, and the backup count
drops by one because the rename never happened. Before the fix the same sweep
produced a truncated backup on every run.

Scope is unchanged from §9.21: this protects against process death, not power
loss. Neither the backup nor the target is `fsync`ed before its `rename()`.

All nine gates pass on Linux x64, Node `26.7.0`, npm `12.0.2`.

### 9.24 Agent seam: criterion 5 made enforceable (2026-09-01)

PRD §2.2 criterion 5 — "adding an Agent touches exactly two files" — was false
before this change, in five places found by reading `src/core/` against what a
non-Claude agent needs rather than by inspection of the interface.

| Leak | Resolution |
| --- | --- |
| `core/paths.ts` was entirely Claude Code shaped | Moved to `agents/claude-code/paths.ts`. Core keeps `resolveHome`, `backupsDirFor`, and `listNamedFiles`, which takes the naming rule as a callback |
| `backupFile` derived `~/.claude/backups/ccset` | Takes the directory. Claude Code passes the same path as before, so §6.5 and the D9 evidence stand |
| `validateProviderName` baked in `['local','json']` | `makeFileNameValidator(reserved)` and `makeKeyNameValidator(reserved)` |
| `core/constants.ts` held Claude Code defaults and filenames | Moved to `agents/claude-code/constants.ts` |
| `i18n/en.ts` named Claude Code inside generic shell keys | See below |

`src/i18n/en.ts` was the file that made the criterion unreachable: an agent that
ships screens has to name them, so adding one would always have touched a third
file however the keys were namespaced. `Agent` now carries `messages`, merged by
the registry, and registration **throws on a duplicate key** rather than
silently rewriting text the shell already uses. `en.ts` was audited afterwards:
`grep -n "Claude Code\|~/.claude\|ANTHROPIC\|hasCompletedOnboarding" src/i18n/en.ts`
returns nothing.

Two additive fields carry a difference the UI must not guess: `Action.detailKey`
(both agents label a screen "Global settings" while describing different files)
and `WriteReport.activateKey` (an agent whose config loads from a fixed path has
nothing to activate).

A mechanical key-coverage check was run over `src/` after the move — every
literal `t()` key, `labelKey`, `helpKey`, `detailKey`, `activateKey`,
`messageKey` and `problemKey` resolves against the merged catalog. 210 keys
defined, 160 referenced literally; 0 missing. The gap is expected and is the
indirect referencing already noted in `CLAUDE.md`.

**Result: all nine gates passed**, typecheck, build and `git diff --check`
included. Two gates needed edits, both mechanical: six scripts imported Claude
paths from `core/paths.js`, and `verify-status-terminal` asserted the old
`status.noBaseUrl` key. One was a real fixture defect this surfaced —
`verify-header-path` waited on `action.globalDetail`, a detail line its own fake
agent never declared and which only resolved because the key happened to exist
globally. It now waits on the menu label.

### 9.25 Second agent: opencode (2026-09-01)

Milestone 2's "only honest test of criterion 5". Candidates were checked against
what is installed on this machine, not from memory:

| Candidate | Version | Verdict |
| --- | --- | --- |
| Gemini CLI | 0.29.2 | Its settings schema has no base-URL or custom-endpoint concept. Read `dist/src/config/settingsSchema.js` directly; no match for `baseUrl`, `endpoint`, or an OpenAI-compatible block. Does not serve ccset's user. Rejected |
| Codex CLI | 0.147.0 | `~/.codex/config.toml`. The TOML case PRD §4.3 names, and still the right eventual second codec. Deferred: see U7 |
| **opencode** | 1.18.18 | `~/.config/opencode/opencode.json`. Schema fetched from `https://opencode.ai/config.json` (HTTP 200, 38 773 bytes) and read: `provider.<id>.options.baseURL` and `.apiKey`. Chosen |

**Criterion 5 verified, not asserted.** `git diff --stat master -- src/` after
adding the agent shows exactly one file outside `src/agents/opencode/`:

```
 src/registry.ts | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)
```

The structural difference is the point: Claude Code is one file per provider,
opencode is one document with providers as nested keys. Provider discovery is
object keys rather than a glob, a parse failure belongs to the file rather than
to a provider, and unmanaged siblings have to survive four levels deep.

`verify:opencode` covers O1-O7 above and passes. **It was then mutation-tested**,
because a data-safety gate that has never failed has not been tested:

| Deliberate bug | Gate result |
| --- | --- |
| `models` map written wholesale | CAUGHT (O4) |
| Removed model no longer deleted | CAUGHT (O4) |
| Blank field written as `""` | CAUGHT (O2) |
| `options` subtree replaced wholesale | CAUGHT (O1) |

Registering a second agent brought two dead paths to life, and both had fixtures
that assumed one agent. The agent-selection Screen exists only once two agents
are registered (PRD §4.1) and had **never been rendered**; `verify:ui-render`
now drives it and asserts both agents appear under singular focus. `--agent`
had one legal value and now has two; `verify:malformed-dirty` passes it.

**All ten gates pass** on Linux x64, Node `26.7.0`, npm `12.0.2`, together with
typecheck, build and `git diff --check`. Every file is inside the 300-line limit.

**Not verified, and not claimed:** no opencode run was made against a real
third-party endpoint. This is evidence that ccset writes the file correctly, not
that opencode accepts the result. U6 (which of `opencode.json` and
`opencode.jsonc` wins) is open and is why the `.jsonc` file is reported rather
than written. There is deliberately no Test connection for opencode — a custom
provider's wire protocol comes from whichever SDK package the user names, so
there is no endpoint ccset could probe honestly.

### 9.26 Third agent: Codex CLI, and the TOML codec (2026-09-01)

The agent PRD §4.3 named and §9.25 deferred. It needed U7 answered first, so
most of this change is the codec rather than the agent.

**The codec.** `Codec` was `'json'` and is now `'json' | 'toml'`. TOML carries
comments, blank lines and an author's key order, so a parse-and-re-emit round
trip would have deleted all three on the first save and broken "unmanaged keys
survive" for this agent. ccset scans the document for spans instead: setting a
key replaces its value span, adding one inserts a line into the table it belongs
to, deleting one removes a line, and every other byte is copied through. See
ADR 0003 for why this is written here rather than taken from npm.

Two seam changes were needed and are core, not agent, work:

- `readConfigFile`/`writeConfigFile` in `core/config-file.ts` carry the original
  text alongside the parsed object, because a format-preserving write edits the
  document rather than rebuilding it from a parse.
- `JsonParseError` became one case of `ConfigParseError`, which carries the
  wording for its own format. The malformed-target confirm now says "not valid
  TOML" for a TOML target instead of borrowing the JSON line. `EXIT_INVALID_JSON`
  was renamed `EXIT_INVALID_CONFIG`; the value is still `4` per PRD §4.4.

Criterion 5 still holds for the *agent*, and the accounting is worth showing
rather than asserting. `git status --porcelain src/` lists nine paths outside
`src/agents/codex/`, and exactly one of them is an agent change:

| Path | Why |
| --- | --- |
| `src/registry.ts` | The agent change. One import, one array element |
| `src/core/toml/`, `src/core/config-file.ts` | The new codec and the seam that dispatches on it |
| `src/core/copy.ts` | Atomic byte copy, extracted from what `backup.ts` already did inline |
| `src/core/errors.ts` | `ConfigParseError` as the base of `JsonParseError`; `EXIT_INVALID_JSON` → `EXIT_INVALID_CONFIG` |
| `src/core/json-file.ts` | `writeTextAtomic` split out, because a preserving codec writes text rather than data |
| `src/core/save.ts` | Catches the base class, and renders `WriteReport.notes` |
| `src/types.ts` | `Codec` gains `'toml'`; `WriteReport` gains `notes`, because a save that writes two files has to name both |
| `src/i18n/en.ts` | Names a *format*, not an agent: `error.invalidToml`, `confirm.freshTitleToml`, `status.parseErrorToml`, `error.unwritableValue`. The rule that sends an agent's strings to its own `messages.ts` is unaffected — every `codex.*` key is in the module |

None of these would have been needed by a fourth JSON agent. The codec is a
different kind of change and is not claimed as an agent one.

**The credential design, which is the part worth knowing.** Codex does not keep
a third-party API key in `config.toml` at all. Reading `resolve_provider_auth`
in `codex-rs/model-provider/src/auth.rs` at tag `rust-v0.152.0`, a provider's
credential resolves in this order: `env_key` (an environment *variable name*),
then `experimental_bearer_token`, then — only when `requires_openai_auth` is
true — the ambient credential from `auth.json`. The default is `false`, and
there is a test named `custom_provider_does_not_inherit_ambient_auth_headers`
asserting exactly that. So a ccset-managed provider block carries
`requires_openai_auth = true`, and the key goes into a ccset-owned
`~/.codex/auth.<id>.json` sidecar. Switching provider copies that sidecar over
`auth.json` and points `model_provider` at the block.

ccset never read-modify-writes `auth.json`. Codex owns it and rewrites it on
login and token refresh, which is the same hazard that makes `~/.claude.json`
create-only. Activation is a whole-file replace, after a backup, on an explicit
request; adoption of an existing `auth.json` is a byte copy, because it may hold
an OAuth token block ccset does not model and must not reshape.

**Facts read from the Codex source, not from memory** (all at `rust-v0.152.0`,
released 2026-09-01; the schema Codex generates from `ConfigToml` is committed
at `codex-rs/core/config.schema.json` and has 96 top-level keys):

| Fact | Consequence for ccset |
| --- | --- |
| Config is `$CODEX_HOME/config.toml`, default `~/.codex` | The TOML case, and the reason for the codec |
| `wire_api = "chat"` is a hard error; `responses` is the only value | A ccset-written provider only works against an endpoint speaking the OpenAI Responses API. Stated on the provider form, not discovered later |
| Built-in provider ids cannot be overridden | `openai`, `amazon-bedrock`, `amazon-bedrock-runtime`, `ollama`, `lmstudio`, `ollama-chat` are reserved by the id validator |
| `auth.json` is `{auth_mode, OPENAI_API_KEY, tokens, ...}`, written `0600` | The sidecars are plain JSON and reuse ccset's existing atomic-write, backup and masking machinery |
| `cli_auth_credentials_store = "keyring"` bypasses `auth.json` | Status reports it and says switching would change nothing. See U9 |
| Codex resolves its directory from `CODEX_HOME`, default `~/.codex` | Reported, **not followed**. ccset writes under the home the run was given; chasing an inherited variable would take a scratch run's writes out of its scratch home. Status names the mismatch, and the gate asserts both halves — that it is reported, and that nothing was written to the override path |
| `model_reasoning_effort` is a free string, not an enum | A text field with suggestions, never a closed list |

`verify:codex` covers C1-C9 and passes. **It was then mutation-tested**, because
a data-safety gate that has never failed has not been tested:

| Deliberate bug | Gate result |
| --- | --- |
| Deletion skipped (`undefined` treated as no-op) | CAUGHT (C4) |
| Value replaced by rewriting the whole line | CAUGHT (C2 — alignment and trailing comment) |
| Blank field written as `""` | CAUGHT (C4) |
| `requires_openai_auth` written as `false` | CAUGHT (C3) |
| API key also written into `config.toml` | CAUGHT (C6) |
| `auth.json` listed as a switchable profile | CAUGHT (C7) |
| Adoption reshapes the file instead of copying it | CAUGHT (C7 — the OAuth block was lost) |
| An i18n key renamed in `messages.ts` | CAUGHT (screen walk) |
| A screen referencing a key that does not exist | CAUGHT (screen walk) |

Two defects came out of the gates rather than out of review:

- `a = 1 2` was not detected as malformed, because the scanner read `1 2` as one
  bare value. A bare value may now carry interior whitespace only when it is a
  space-separated date-time, which TOML allows.
- The editor compared path segments by joining them, and a quoted TOML key may
  contain a space (`'lit key' = 2`), so `['lit key']` and `['lit', 'key']`
  compared equal — editing either would have rewritten the other's line. The
  separator is now a named `PATH_SEPARATOR` of `\u0000`, with a gate that edits
  both paths in one document and checks the other is untouched. Reverting the
  constant to a space turns it red. (`src/core/merge.ts` joins on `\0` for the
  same reason, written as a literal byte; that predates this change and is why
  git reports it as a binary file.)

**Verified through the shipped bundle, not only `src/`.** A PTY run of
`dist/cli.js --agent codex` against a scratch home walked Providers → the
provider screen → Use, submitted the adopt form, and produced:
`model_provider` routed from `"openai"` to `"router"`; the leading comment,
the aligned `model` assignment and the unmanaged `http_headers` sibling all
intact; the previous ChatGPT `auth.json` byte-identical at `auth.chatgpt.json`;
a backup under `backups/ccset/`; and no credential anywhere on screen.

**All eleven gates pass** on Linux x64, Node `26.7.0`, npm `12.0.2`, together
with typecheck, build and `npm pack --dry-run`. Every file is inside the
300-line limit.

**Not verified, and not claimed:** no Codex run was made against a real
third-party endpoint, so U8 is open — this is evidence that ccset writes the
files correctly, not that Codex authenticates with the result. U9 (whether a
keyring store bypasses `auth.json` completely) is open and is why Status warns
rather than refusing. There is deliberately no Test connection for Codex: the
probe ccset ships is Anthropic-shaped (`/v1/messages`), and a Responses-API
endpoint is a different request it has no honest way to make yet.

### 9.27 Windows CI leg and the built-CLI runtime smoke (2026-09-01)

The CI matrix now runs every leg on `windows-latest` next to `ubuntu-latest`
(Node 18/20/22 each), and every leg gained a runtime smoke of the built
`dist/cli.js` under `shell: bash`, which both runner images provide: `--version`
prints the package version and exits 0, and non-TTY stdin exits `2` with the
plain refusal on stderr and zero ANSI escape bytes — the non-TTY half of the
bounded check §9.8 recorded manually for Linux, now executed continuously per
operating system per Node version. The smoke was exercised locally (Linux x64,
Node `20.19.5`, fresh build) and then mutation-tested: a non-TTY exit of `0`, an
ANSI-escaped refusal, and a broken `--version` each fail the step. CLAUDE.md's
CI paragraph was updated to match.

Not evidenced, and not claimed: no Actions run of this branch exists yet — the
Windows leg first executes on the pull request's own run, and a green leg there
is the earliest point at which any Windows evidence begins to exist. The smoke
drives the non-interactive surface only; an interactive Windows Terminal or
PowerShell run is still outstanding, the §9.8 Windows external gate stays
pending, and the `0600` guarantee remains POSIX-only by design. The verify
fixtures run on Ubuntu and macOS after the CI integration; Windows skips them
because Python's stdlib `pty` does not exist on win32.

### 9.28 CI run 1: the Windows leg executed and passed (2026-09-01)

The first Actions run of PR #44 (run `33552753749`, head `a3a23a6`) completed
green: all six matrix legs succeeded, including the three `windows-latest` legs
at Node 18, 20 and 22 — the first recorded Windows execution of ccset's
toolchain and built CLI. Each leg ran the full sequence: install, typecheck,
build, the runtime smoke of `dist/cli.js` (`--version` prints the package
version; non-TTY stdin exits `2` with the plain refusal and zero ANSI escape
bytes), and `npm pack --dry-run`.

That upgrades part of §9.27's "not evidenced" list: the workflow has now
executed on GitHub, and the smoke's assertions hold on a GitHub-hosted Windows
image, not only on Linux. Still not evidenced: it is one run, on the PR's own
branch, not on master; an interactive Windows Terminal or PowerShell run is
outstanding; the §9.8 Windows external gate stays pending; the `0600` guarantee
remains POSIX-only by design.

### 9.29 Second locale: zh-Hans (2026-09-01)

The additive path PRD §5.5 planned. `src/i18n/zh-Hans.ts` translates the shell
catalog, and every agent ships a `zh-Hans` block beside its `en` block, so
criterion 5's file accounting is unchanged: the `messages` record was already
keyed by locale, and `registerMessages` now merges each locale's entries into
that locale's catalog instead of one global one.

**Selection is explicit, not detected.** `CCSET_LOCALE` joins `CCSET_HOME` and
`CCSET_ASCII` as an environment override read once at the `cli.tsx` boundary:
`resolveLocale()` validates it against the known catalogs and `setLocale()`
switches the active one at the top of `main()`, before `parseArgs`, so `--help`
and the non-TTY refusal resolve in the selected language too. An unset or
unknown value falls back to English; the ambient `LANG` is never consulted.
The value itself is matched leniently — case-insensitively, `_` for `-`, and a
LANG-style codeset suffix like `.UTF-8` tolerated — while a region tag
(`zh-CN`, `zh-TW`) never selects a script catalog.
`t()` falls back to English for a key the active locale has not translated, so
an untranslated key degrades to English text rather than a raw key — and
`verify:i18n-zh` holds the catalogs key-for-key identical, which keeps that
fallback a safety net rather than a silent gap.

**The fold contract held without new code.** `ui/terminal.ts` already said a
non-English catalog "has to pass through untouched rather than be
transliterated"; Chinese does exactly that, which means a seven-bit terminal
cannot draw it. Both READMEs now document that rather than papering over it.

**What ran** (Linux x64, Node `20.19.5`, npm `10.8.2`): the new
`verify:i18n-zh` gate — key-for-key parity of `en` against `zh-Hans` for the
shell and all three agents including placeholder sets, the `resolveLocale`
matrix, `t()`/`hasKey` under `setLocale`, the unknown-locale and duplicate-key
refusals, the en-only fallback, a `UiSession` paint of the agent-select screen
under zh-Hans asserting `选择 Agent`, and `dist/cli.js` spawned with
`CCSET_LOCALE=zh-Hans` (localized non-TTY refusal, exit `2`) and
`CCSET_LOCALE=fr` (English fallback, exit `2`). The gate was mutation-checked:
deleting `menu.exit` from `zh-Hans.ts` turned it red. Typecheck, build,
`verify:codex`, and `verify:ui-render` (both glyph sets) pass unchanged — the
English catalog a user sees by default is untouched.

**Not verified:** an interactive PTY session in Chinese (the paint check mounts
the app under the Unicode glyph set directly) and a manual narrow-terminal pass
in zh-Hans. `string-width` already drives every cut site, but CJK double-width
text at a tight column budget has not been eyeballed.

### 9.30 CI gains macOS, and the verify fixtures run in it (2026-09-01)

The CI workflow now describes a 2×3 matrix — `ubuntu-latest` and `macos-latest`
for Node 18.x, 20.x, and 22.x — with steps typecheck, build, `npm test`, and
`npm pack --dry-run`. The eleven verify fixtures, previously local-only, are
aggregated under one `npm test` script in `package.json` and run as a CI step
on every Ubuntu and macOS matrix job. CLAUDE.md's CI paragraph was rewritten to match; it
previously said the workflow ran on Ubuntu only and that the verify scripts
were not wired into CI.

Actually run in this environment (Linux x64, Node 20.19.5, npm 10.8.2):
`npm test` — all eleven fixtures, exit 0 — plus `npm run typecheck`,
`git diff --check`, and a YAML parse of the workflow confirming the matrix and
step order. Node 18.x stays in the matrix deliberately to match
`engines: >=18`, although 18 is EOL upstream.

Not evidenced, and not claimed: the workflow has never executed on GitHub —
it has no Actions runs on any branch yet. No macOS run of any kind was
performed here, so the §9.8 macOS gate and the §5 manual smoke-test checkbox
stay pending, and no install-from-artifact step exists on either platform.

### 9.31 CI run 1: ink's CI mode muted the PTY gate (2026-09-01)

The first Actions run of PR #42 failed every matrix job at
`verify:malformed-dirty`: the PTY session timed out waiting for the main
screen with zero bytes from the child. Reproduced locally by setting `CI=true`
alone. Root cause: ink 5 asks the `is-in-ci` package, and when it answers yes
the reconciled frames are never written to stdout (`ink/build/ink.js` stores
`lastOutput` and returns), so an interactive screen driven under `CI=true`
renders nothing past the cursor-hide escape. The fixture inherited `CI=true`
from the Actions environment, so the gate failed on Ubuntu too — it was never
macOS-specific.

Fix: the PTY session now strips `CI`, `CONTINUOUS_INTEGRATION`, and every
`CI_` variable from the child environment (`GITHUB_ACTIONS` survives, so
supports-color keeps color on), and the platform gate now admits darwin next
to linux so the gate runs on the macOS leg of the matrix. Only this fixture
drives the built CLI through a PTY; the other ten are unaffected.

Actually run here (Linux x64, Node 20.19.5): the gate passed with
`CI=true GITHUB_ACTIONS=true CI_PROJECT=x` — the exact conditions that failed —
and `npm test` passed all eleven fixtures on a plain environment, typecheck
clean.

Not evidenced, and not claimed: the macOS leg has still never run anywhere; it
first executes in this PR's Actions run, and the darwin platform gate rests on
the portability of Python's stdlib `pty` bridge, not on recorded evidence yet.
---

### 9.32 Error-recovery polish (2026-09-01)

PRD §7 listed "error-recovery polish" without defining it; issue #38 scoped it
from what the code shows rather than inventing work. Three candidates were
weighed; two were real, and the third resolved itself.

**Candidate 1 — a failed save discarded the form. Real, and the substance of
the change.** `runSave` handled a malformed target by asking, but every other
task error — `EACCES`, `ENOSPC`, a vanished directory — went to `onFatal`,
unmounted Ink, and exited with the error's code. A transient failure cost the
user a typed token with no way back. Tasks now recover in-app: a thrown task
returns an error Screen carrying the error's own message (path, mode, parse
position — the §4.4 wording, unchanged) plus a hint that nothing typed was
lost, and `replace()` **stacks** it instead of superseding, exactly as it
already stacks a confirm. `esc` returns to the frame beneath — the form, its
values parked by `App.submit` — so the cause can be fixed and the save retried
in the same session. Deciding "which errors are worth recovering from", as the
issue put it: all of them, inside the interface. A task error means the task
did not happen; no state is lost by showing it, and the exit-code taxonomy
still governs core and the process boundary (start-up, non-TTY, a render-tree
crash through `main().catch`). `onFatal` had no remaining caller, so the prop
and its plumbing in `cli.tsx` and `ui-session.ts` were removed rather than
kept as an unused hatch.

**Candidate 2 — a partial backup was invisible. Real, and the
credential-exposure angle.** #32 made backups atomic by copying to a
`.ccset-partial.*` temp name before the rename; `clearBackups` already removed
such copies, but Status counted finished backups only, so a copy holding the
user's credential sat there unnoticed. A shared `backupStatusSection(dir)` in
`core/backup.ts` now builds the backups section for **all three** agents —
the three copies were otherwise identical, and polishing one would have left
the others behind. When a partial exists, Status adds a `Partial copies` line
in the warn tone and swaps the note to say it holds a credential and that
Clear removes it.

**Candidate 3 — `ValidationError` from `saveProvider` was a fatal. Resolved by
candidate 1, no code.** All three agents re-validate the name at save time as
a belt-and-braces check the form has already passed. As a fatal it was a crash
on an "unreachable" path; as a CcsetError it degrades to an error Screen the
user can leave. Converting it to a crashing assertion would be strictly worse,
so it stays.

(Candidate 4 in the issue — no opencode Test connection — stands as
deliberate, per §9.25/§9.26.)

**Verified by a new gate**, `npm run verify:error-recovery` (F11, F12): it
drives the rendered app through a read-only `~/.claude` — type name, URL and
token, save, assert the error Screen names the path and mode, `esc`, assert
the form still holds the typed name and URL and a masked token, fix the
permission, save again, assert success and the file on disk — and walks
Status with a seeded partial copy, asserting the warning and that Clear
removes both the partial and the finished backup. The opencode and codex
sections are asserted at the module level in the same gate. Skipped under
root or win32 for the permission drive, like E3.

**Behavior change recorded here rather than buried:** exit codes 3 and 4 are
no longer reachable from an interactive run — a task failure ends in a Screen
and the process exits 0 when the user leaves. The §5.6 non-TTY refusal
(exit 2) and start-up failures are untouched, and the codes remain the
taxonomy every `CcsetError` carries. E3's pass condition and the README exit
table were updated to say so. The one observable change to existing flows:
an error-toned message returned by a **confirm** (Codex activation failures)
now stacks above the confirm instead of replacing it, which makes the
question retryable rather than one-shot.

**All twelve gates pass** on Linux x64, Node 20.19.5, together with typecheck,
build and the release-artifact gate. Every touched file is inside the
300-line limit.

### 9.33 Milestone 3: Non-interactive execution (2026-09-04)

Shipped on `feat/m3-non-interactive` (commits `8e93b11`, `6c2b642`, `b9034a0`,
`d893def`, `4262ab6`, `6ac92c8`+`34e09e4`, `1c97578`, `9e738b0`) against issue
#47 and its tracer-bullet children #48–#56. The milestone adds a headless
command mode, `ccset --agent <id> <command>`, over a shared operation seam
(`src/operations/`): a pure parser that normalizes argv against declarations
each agent module owns, opaque `Secret` handling sourced only from
`CCSET_TOKEN` or `--token-stdin`, a plan/apply commit core with per-target
backup, atomic `0600` writes, no-op detection and partial reporting, and a
single-schema JSON envelope (`--json`).

**The command surface.** claude-code: `status`, `global set`, `provider set`,
`state init`. opencode: `status`, `global set`, `provider set` with per-key
`models` merge. codex: `status`, `global set` over the format-preserving TOML
codec, `provider set` asserting the `wire_api`/`requires_openai_auth`
invariants and writing the `auth.<id>.json` sidecar, and `provider use` with
explicit credential-conflict resolution (`--adopt-current-as` /
`--replace-current-auth`), routing-before-auth ordering, and a partial report
naming what already landed. The interactive screens keep their own flows; both
surfaces call the same load, merge, backup and activation primitives.

**Eight gates cover the seam** — `verify:commands`, `verify:commands-status`,
`verify:commands-secret`, `verify:commands-opencode`,
`verify:commands-opencode-provider`, `verify:commands-codex`,
`verify:commands-codex-provider`, `verify:commands-codex-use` — all bundled and
run through `dist/cli.js` with a scratch `CCSET_HOME` (the process seam, not a
reimplementation). Each was shown to fail under deliberate mutations before its
sub-ticket was committed:

| Gate | Mutation evidence |
| --- | --- |
| `verify:commands` | dry-run records, backups, preservation, exit-code mapping |
| `verify:commands-status` | secret-leak, exit-code mapping |
| `verify:commands-secret` | padded-rule acceptance, dropped secret |
| `verify:commands-opencode` | boolean conversion, two-layer secret leak |
| `verify:commands-opencode-provider` | wholesale model-map write, secret leak, unmanaged-sibling loss |
| `verify:commands-codex` | empty-base rebuild (comment loss), string-typed integer, wrong warning code |
| `verify:commands-codex-provider` | live-auth touch, dropped invariant |
| `verify:commands-codex-use` | order swap, conflict bypass, idempotence churn, partial-report loss, dropped adoption |

**Secret absence is asserted, not claimed.** The secret fixtures prove the key
never appears in argv (options that would carry it are usage refusals before
any read), stdout, stderr, the JSON envelope, error findings, or warnings — for
human and `--json` runs alike, on success and refusal paths
(`verify:commands-secret`, `verify:commands-opencode-provider`,
`verify:commands-codex-provider`, `verify:commands-codex-use`). A dry run
creates no backup, so no copy of a secret can hide in the backups directory
either.

**Interactive gates stay green.** The no-subcommand TUI guard still exits `2`
with no ANSI through a pipe (asserted by `verify:status-terminal` and by the
CI runtime smoke on every leg), and the form, malformed-config, viewport and
release-artifact gates are unchanged and passing.

**Platform evidence.** The full suite passes on Linux x64, Node 20.19.5
(2026-09-04, this register). CI (`ci.yml`) runs `npm test` on `ubuntu-latest`
and `macos-latest`; the `windows-latest` leg builds, runs the `--version` /
non-TTY smoke and packs, which follows the standing policy recorded in §9.27 —
the PTY-driven interactive gates have no Windows leg, and the command gates
ride the same suite gate rather than a separate one. POSIX modes are asserted
on every write target (`0600`) by the command gates. Windows Terminal /
PowerShell and WSL interactive scenarios, and a Windows run of the command
suite, remain explicit best-effort gaps, unchanged from §9.28.

**Residual release blockers:** none recorded as of this date.

**Post-review pass (same date).** The two-axis review of the milestone diff
(standards + spec, against master) was run at completion; findings and their
resolution: the launch command is now part of every write result's human
output and JSON envelope (`launchCommand` on `OperationResult`), `--json`
produces its envelope on parse-stage usage and unknown-agent failures too, the
opencode JSONC warning rides on write results and not only on status, the
adopt/replace mutual exclusion is decided before any filesystem read, and a
partial report now names an adoption profile that committed before the failed
live-auth copy. The file- and function-size limits flagged by the standards
axis were restored by splitting the per-agent command and status modules
(`provider-commands.ts`, `provider-use.ts`, `status-present.ts` per agent) and
by deriving the one `MODE_AFTER_WRITE` from `core/constants.ts` everywhere.
Accepted judgement-call debt, recorded rather than silently dropped: the
parser's internal helpers pass four to five same-family parameters, and the
per-field unset/patch coercion loop appears in a small variation per agent
module because each agent owns its own field-to-key mapping.

**Second review round (same date).** A re-review of the completed milestone
against #47 confirmed the contract with four remaining findings, each closed
red-green (the extended fixture was shown failing before the fix): a partial
report now names only paths the commit actually wrote, so a no-op target the
command skipped is never listed as possibly changed (the Codex `provider use`
partial fixture asserts the adopted profile and the absence of the skipped
`config.toml`); a failure envelope names the operation once the parser had
matched a declaration (`CcsetError.command`, attached in `parseCommand`, read
by the failure presenter — `global set --json` with nothing to change reports
`global.set`); `--dry-run` is a declared capability (`dryRunnable`) refused by
commands that do not change state, `status` included, with a distinct usage
message and exit 64; and `--agent` never reads its value from a following
flag, so `--agent --json status` is a usage error 64 with an envelope rather
than unknown-agent 65 (the walk lives once, in `src/commands/globals.ts`,
shared by the parser and the failure fallback, keeping `parser.ts` within the
size standard). Evidence: full `npm test` plus `verify:i18n-zh` and
`npm run typecheck` green on Linux x64; both README option tables updated.

**Standards round (same date).** The remaining findings from the re-review
were closed. The Codex `runProviderSet` was split behind a `preflightProviderSet`
helper, back under the function-size limit; `authMoveRecords` lost its
five-parameter debt (the provider id joined the preflight result and the
dry-run record moved to the caller). `CCSET_TOKEN` is now read once at the
`cli.tsx` boundary like `CCSET_HOME`, `CCSET_ASCII`, and `CCSET_LOCALE`: only
its presence reaches the parser, which is pure against the environment again,
and CLAUDE.md's boundary rule says so. `--proxy` spells its toggle `on|off`
like every other switch — a choice field, with `true`/`false` refused — proven
red-green in `verify:commands` at both the process seam and the operation seam.
The dead `excludeSecrets` branch left the Claude status DTO, the shared
`SWITCH_ON`/`SWITCH_OFF` constants replaced the magic `'1'`/`'0'` comparisons,
and the three identical backup sections collapsed into one builder
(`src/operations/status-sections.ts`). Recorded as accepted: a no-op record
for an absent target reports `mode: '?'` — the honest placeholder `readMode`
documents — rather than a mode nothing will ever have. Evidence: full
`npm test` green on Linux x64 plus `npm run typecheck`.

**Third review round (2026-09-05).** Both review axes ran again over the
updated diff; the findings and their closures: the capability exit code 66 was
documented but never asserted — `verify:commands` now proves at the process
seam that `--agent claude-code provider use` refuses with it, in human output
and in a `--json` envelope that names the agent with `operation: null`. The
two gates over the 300-line file limit (`verify:commands`,
`verify:commands-codex-use`) are back under it, and the CLI spawn harness all
eight command gates each carried now lives once, in `scripts/cli-harness.ts`.
The parser's option readers pass one context object instead of four to five
same-family parameters, closing the positional-parameter debt recorded above
(the ≤ 3 gate is met), and the unused `boolean` command field type left the
parser with its two catalog keys — no declaration used it. `core/errors.ts` no
longer imports the seam: `TargetRecord` moved to `src/core/target.ts` and is
re-exported by `operations/types.ts`, so core→seam is not a direction the
dependency graph has. The secret-absence wording in `src/commands/secret.ts`
and `operations/types.ts` now names only surfaces that exist and are asserted
(argv, output, result objects, error parameters) — ccset writes no logs. The
WSL gap joined the recorded platform best-effort list above, CLAUDE.md's
"Current state" no longer describes the shell as interactive-only, and
AGENTS.md/CLAUDE.md name the two new layers. Still open from the round, by
decision rather than omission: the spec's referenced ADRs 0004–0012 do not
exist as files (the parent issue restates every constraint they would carry),
and the `--adopt-current-as`/`--replace-current-auth` wording in child #55
reads stricter than the parent's "unknown live credential" rule the code
implements — both belong on the tracker, not in this register. Evidence:
`npm run typecheck` and all eight command gates green on Linux x64, Node
20.19.5.
---

### 9.34 The JSONC codec: `opencode.jsonc` becomes the managed target (2026-09-02)

Issue #46, resolving the decision issue #39 carried. The evidence chain: #39
(revised body) → the U6 research note it links (opencode v1.18.25 loads both
configs, merges per key, `.jsonc` last, and seeds a `.jsonc` on fresh
installs) → the #46 spec. The runtime experiment stays open in the U6 row.

**The user-visible change.** When `~/.config/opencode/opencode.jsonc` exists
it is the one file ccset reads and writes — the managed target — and it is
edited in place: comments, key order and formatting survive every save, the
same promise the TOML codec makes for Codex. When only `opencode.json`
exists, nothing changes. The always-on `.jsonc` warning is gone; Status
instead shows a not-managed section only when a legacy `opencode.json` sits
beside a managed `.jsonc`, saying it still loads but loses conflicting keys.
ccset never creates a `.jsonc`, never rewrites a legacy `.json`, and ignores
`config.json`. Reads follow the write target — form seeding, the Providers
list, provider forms and Status read the managed file only; no migration of
legacy content. Backups, atomic writes and masking are unchanged: below the
seam already.

**The codec.** `Codec` was `'json' | 'toml'` and is now `'json' | 'jsonc' |
'toml'`. The parser and the strict syntax pass are npm's `jsonc-parser`
3.3.1 — the parser behind VS Code's settings editor, and the one opencode
itself parses with — the contrast case ADR 0003 anticipated: on maintenance,
provenance and adoption it is everything the TOML patch package was not. Its
patch engine is **not** used, on evidence rather than taste: with formatting
options, `withFormatting` reflows the edited line with `keepLines` forced
false, so an insert reprints a compact sibling array across five lines —
bytes ccset does not own — and without formatting options inserts degrade to
`, "key": value` jammed inline. ADR 0004 records the split: npm supplies the
parse tree and its spans, `src/core/jsonc/` (check, parse, text, format,
edit) supplies the splices under ADR 0003's construction — replace the
value's span, insert or remove one line, one separator comma, containers
emptied along a deleted path collapse exactly as `merge.ts` does for JSON, so
a `.jsonc` target behaves like the `.json` one. Duplicate keys read last-wins
and the last occurrence is the one edited, matching `JSON.parse`.

**Where the code moved.** The opencode module was the only agent bypassing
the codec seam (`readJsonFile`/`writeJsonFileAtomic` directly); its reads and
writes now go through `readConfigFile`/`writeConfigFile` with the selected
target, and target selection exists in exactly one place
(`opencodeTarget` in the agent's `paths.ts`). `config-file.ts` gained the
`jsonc` branch in both directions. The declared managed key set is
unchanged; agent-owned strings were updated with the Status inversion
(`opencode.status.legacyJsonTitle`/`Note` replace the `.jsonc` pair), and the
shell catalog gained nothing — a JSONC file that fails the pass reports
through the existing `error.invalidJson` wording, which is true: it is not
valid JSON either.

**`verify:opencode` covers it** — O1-O6 unchanged, then the codec corpus and
the scenario gates (O7 revised, O8-O10) from `verify-opencode-jsonc.ts` and
`verify-opencode-jsonc-scenarios.ts`, split out of the main fixture the way
`verify-toml-codec.ts` runs inside `verify:codex`. The corpus: leading,
attached and dangling comments; trailing commas; CRLF and no trailing
newline; nested objects; arrays; empty containers; escaped strings; the
seeded `$schema` shape; every key ccset manages. Each document must survive
an empty write list byte for byte, and a managed replace must leave every
other byte identical — asserted byte-exactly against a span computed from
the parse tree, not a hand-written expectation. Idempotence is asserted per
document: a second identical save changes nothing.

**It was then mutation-tested**, as the third-agent entry was:

| Deliberate bug | Gate result |
| --- | --- |
| Target selection ignores the `.jsonc` | CAUGHT (O7 — the block landed in the `.json`) |
| Codec re-serialises from the parse instead of splicing | CAUGHT (U6 corpus — comments lost) |
| Strict pass disabled (`findJsoncProblem` returns null) | CAUGHT (corpus malformed battery) |
| Delete leaves its separator comma | CAUGHT (corpus delete — dangling comma, invalid JSONC) |

**All thirteen verify gates pass** on Linux x64, Node 20.19.5 — the eleven in
the `npm test` chain plus `verify:error-recovery` and `verify:i18n-zh` —
together with typecheck and build. Every touched file is inside the 300-line
limit, and `providerForm` was re-shaped to an options object rather than
breach the three-positional-parameters gate.

One drive-by beyond the issue's scope, recorded because the gate exposed it:
`verify:i18n-zh` was already failing on master — §9.32 added
`status.partials`, `status.partialsNote`, `error.screenTitle` and
`error.screenHint` to the English catalog without their zh-Hans counterparts,
and the gate is not in the `npm test` chain, so nothing caught it. The four
translations were added here (confirmed by stashing this change and re-running
the gate against master).

**Not verified, and not claimed:** the U6 runtime experiment — launching
opencode with distinguishing keys in each file — has not been run; the
research is source-level evidence, and the U6 row stays open until it is.
`tui.json`/`tui.jsonc`, project-level `.opencode` directories, and remote
config are untouched, per the spec's out-of-scope list.

### 9.35 Post-review fix: duplicate keys in the JSONC codec (2026-09-04)

A review pass executed the codec on documents the §9.34 corpus never held and
found the rule stated there — duplicate keys read last-wins and the last
occurrence is the one edited — only half-true in the code: the leaf lookup
took the last duplicate, but the intermediate walk used
`findNodeAtLocation`, which stops at the first. On
`{"a":{"x":1},"a":{"y":2}}` a set of `a.b` landed in the first `a` while
reads resolved the last, so the save silently missed; and a delete of `a.x`
emptied the first `a`, then removed the last one — the live `{"y":2}` was
destroyed. Two smaller probes: an insert spliced in front of a trailing
comment on the last property, relocating the comment onto the new key's
line; and `detectEol` returned CRLF when a single `\r\n` appeared anywhere,
while its comment claimed a majority.

**The fix.** Path resolution now takes the last duplicate at every level
(`lastNodeAtPath` over property nodes; `findNodeAtLocation` is gone from the
editor), so an edit touches exactly the document a read sees. Delete walks
the live chain repeatedly until no occurrence of the key remains — a
shadowed duplicate cannot resurrect the deleted value — and collapses only
containers the delete actually emptied. Insert puts the separator in front
of a trailing comment (reusing the document's own comma when one follows the
comment) and places the new property after it, so the comment never changes
lines. `detectEol` counts line breaks and follows the majority, tie to LF,
which is what its comment now says.

**Coverage.** The corpus gained a duplicate-key document (a shadowed
`model`, duplicate `provider` objects) driven by a tweak path through the
duplicated intermediate, with the replace expectation resolved last-match
like the codec's walk; the read, insert and delete gates gained the probe
cases above with byte-exact expectations — including the byte-faithful
spacing an inline delete leaves behind. Mutation check: reverting the walk
to first-match turns the corpus gate red (CAUGHT — "a replacement in
duplicateKeys disturbed bytes it does not own"). The full `npm test` chain
and typecheck pass on Node 20.19.5, and every touched file stays inside the
300-line limit.
### 9.34 First-run language choice (2026-09-05)

ADR 0004 proposed asking once, interactively, and remembering the answer;
this entry is its implementation. The resolution order lives at the cli.tsx
boundary: `CCSET_LOCALE` when present — empty or unknown included, an explicit
English override that suppresses prompting and persistence, because reading a
durable preference out of a per-invocation statement would turn one scripted
run into a silent permanent switch; otherwise the locale saved by a previous
run; otherwise the first-run prompt; otherwise English. Argument parsing and
the TTY guard run first, so `--help`, `--version` and piped stdin never reach
the settings file. The prompt is a standalone Ink render before App mounts —
`t()` resolves through a module-global locale with no reactive seam, so the
choice must be settled before the app — and it is the one screen whose copy
does not go through the catalogs: bilingual by construction. It runs
regardless of `--agent`. Esc and Ctrl+C take the normal cancel exit (0) and
leave no settings file behind.

The choice lives in `<home>/.ccset/settings.json` (`{"version": 1,
"locale": "..."}`), written by `core/settings.ts` through the same atomic
machinery as agent configs — temp file, rename, 0600, 0700 directory — and
following `CCSET_HOME` like every other path. Anything the file could be
besides a carried locale — missing, malformed, non-object, a non-`1` version,
a missing or unknown tag — is *unchosen*, not an error, and the next
successful choice replaces it. A persist failure after a successful choice is
warned on stderr after the prompt render exits (before the app mounts, so it
is legible) and keeps the choice for this session.

**Verified by a new gate**, `npm run verify:first-run-locale` (ADR 0004),
which drives the built CLI through the PTY bridge: a fresh home sees the
bilingual prompt, chooses zh-Hans by number key, and lands in the localized
agent menu with the file written at 0600 in a 0700 directory; a second run on
the same home is never asked; `CCSET_LOCALE` set, including empty, neither
asks nor persists and beats a conflicting saved value in both directions;
`--help`, `--version` and a piped stdin never prompt; Esc and Ctrl+C each
leave no settings file and exit 0; a read-only settings directory forces the
persist warn — resolved in the locale just chosen — while the choice stays
for the session (skipped under root, like E3); a corrupt, wrong-version and
unknown-locale file each re-ask and are replaced by the next choice.
Mutation-checked per the standing procedure with three representative
mutations — dropping the override-presence guard, accepting any schema
version, and never returning the saved locale — each of which made a distinct
scenario of the gate fail.

The PTY bridge and its `CliSession` moved to `scripts/pty-session.ts` so both
built-CLI gates share one harness, and `verify:malformed-dirty` now seeds a
saved English choice through the shipped `saveLocale` — a fresh home has a
first screen of its own, and that gate walks agent flows, not the prompt.

Incidental, and fixed in passing: the zh-Hans catalog had drifted —
`status.partials`, `status.partialsNote`, `error.screenTitle` and
`error.screenHint` had carried no Chinese since the error screens landed, so
`verify:i18n-zh` was red before this change. The four keys are translated and
the gate is green. `warn.localePersistFailed` is the one new key pair,
resolved in the chosen locale when the warning is written. The PRD §5.5
bullet (still claiming English-only v1) and the README.zh-CN environment
table were amended as the ADR assigned to the implementation PR.

**All twenty-one gates pass** on Linux x64, Node 20.19.5, together with
typecheck and build. Every touched file is inside the 300-line limit.
