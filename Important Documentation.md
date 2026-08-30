# Important Documentation

Verification and test register for **ccset** (`@droite/ccset`).

Nothing in this repository has been executed, built, or installed. Per project
convention, everything requiring runtime confirmation is recorded here instead of
being run. Each item states what to check, how, and what a pass looks like.

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

## 9. Implementation register (code complete, nothing executed)

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
| T10 | Terminal narrower than the 30-column label gutter in `ui/Field.tsx` and the 22-column gutter in `ui/Status.tsx`. | Rows wrap without corrupting the layout (relates to E6). |
| T11 | Fill in a provider form against a malformed target, save, then decline the "start fresh" question. | The form comes back with every field as typed, the token included; nothing was written; the backup directory did not grow. |

### 9.4 Not built, by design

Milestone 1 stops here. Not present, and not stubbed: `apiKeyHelper` support
(gated on U1), a second agent module (M2), non-interactive mode (M3), and any
additional i18n catalog. `--agent <id>` is parsed and validated but has only one
legal value while the registry holds one agent.

