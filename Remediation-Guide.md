# Remediation Guide for Agents: ccset Security Review Findings

Source: `2026-09-24-044337-application-security.txt` (Standards, Spec, and review transcript). It reports 3 Blockers, 2 Highs, 5 Mediums, and 14 Lows. The environment date is 2026-09-23, so the filename’s 2026-09-24 date is one day in the future; treat the report as a snapshot to verify, not proof that every finding is current.

Freshness conflict: `Important Documentation.md` §9.37 records a routing rollback fix, but the current CLI path applies routing before `authMoveRecords` converts an auth-move failure into a partial-commit error. The TUI has a separate undo path. Verify B-1 at the command boundary; do not close it based on the register entry alone. Reproduce every other finding against the current tree and reconcile it with the verification register before editing. Fix one finding at a time; add a regression test that fails before the fix and passes after. Do not release while a Blocker or High remains open unless it is explicitly downgraded with a recorded reason in the verification register.

## 0. Pre-flight

1. Record the current `git status --short` and preserve all existing changes. The working-tree state quoted in the transcript is historical and does not match this checkout.
2. Read the governing docs before touching code:
   - `AGENTS.md`
   - `CONTEXT.md`
   - `docs/verification.md`
   - `docs/agents/code-review.md`
   - `Important Documentation.md`
   - The relevant entries in `Important Documentation.md` §9, including §9.37 and §9.52
   - The relevant ADR and `docs/user-guide.md` sections for the finding
3. Before running any PTY fixture or `npm test`, verify and fix M-5 so the harness clears inherited Agent-home overrides. Until then, run only checks that do not execute those fixtures.
4. Run baseline gates:
   ```sh
   npm run typecheck
   npm run build
   npm run verify:code-gates
   npm test
   ```
5. Use scratch homes for every manual reproduction. Use placeholder secrets only in tests, probes, and fixtures.
6. Do not create branches or commits unless requested. If a commit is requested, include the finding ID in its subject.

## 1. General fix loop

For each finding:

1. Re-check the reported location and reproduce the issue in a scratch home or isolated fixture. If it is already fixed, verify the existing regression pin and record that evidence instead of reapplying the change.
2. Write or extend a focused regression test and show it fails on the unfixed behavior.
3. Implement the minimal fix.
4. Run the targeted verify script.
5. Run the full gates.
6. Update docs/register if the spec, rule, or guarantee changed.
7. Record actual commands, results, environment, and remaining platform limits in the handoff; append new runtime evidence to `Important Documentation.md` §9.

## 2. Ordered findings

### Blockers

#### B-1 — Failed credential move leaves Codex routing switched

- **Grade:** Blocker
- **Location:** `src/agents/codex/provider-use.ts:137`
- **Rule:** Register 9.37: if moving the credential fails, the previous `model_provider` is put back.
- **Failure:** `provider use new` switches routing in `config.toml`, then writing `auth.json` fails. The command exits 1 and leaves routing on `new`, so Codex’s next run sends the old provider’s key to the new provider’s endpoint. The TUI restores routing (`activate.ts:97`); the command path does not.
- **Current-code check:** `runProviderUse` applies the routing plan before `authMoveRecords`; the latter reports a partial commit when credential activation fails. Test this CLI path separately from the TUI rollback path.
- **Fix:** In the command path, wrap the credential move so that a failure restores the previous `model_provider` before propagating the error. Mirror the TUI rollback. Prefer making routing + credential move transactional.
- **Regression test:** Add a failed-move case to `verify:commands-codex-use`. Inject a deterministic failure at the `auth.json` write/move boundary without relying on a predictable temporary filename. Run `provider use new --json`; assert the expected failure result, that `config.toml` still points to the old provider, that no credential was copied, and that output is secret-free.
- **Verification:** Targeted `verify:commands-codex-use` + full gates.

#### B-2 — TOML insert under scalar parent produces unloadable file

- **Grade:** Blocker
- **Location:** `src/core/toml/edit.ts:66, :110`; `src/operations/commit.ts:89`
- **Rule:** An insert must fit the structure it lands in, and the rendered result must pass the strict checker again.
- **Failure:** A Grok config with a top-level `model = "grok-4"` line is valid TOML. Running `provider set myprov …` exits 0 with `ok:true changed:true`, but the added `[model.myprov]` block makes the file unloadable (`Cannot overwrite a value`). `ccset status` then exits 4.
- **Fix:** In TOML editing, detect insertion under a scalar parent. Either fail before writing or replace safely only when the structure allows it. In `commit.ts` / `planTargets`, re-run the strict checker on rendered bytes before committing. Never report success for a file the checker rejects.
- **Regression test:** Add the codec case to `scripts/verify-toml-codec.ts` and exercise the Grok command boundary in `scripts/verify-commands-grok-build.ts`. Use valid TOML with top-level `model`, assert the command refuses safely without changing bytes or the rendered document remains valid, and add the strict rendered-output check in `planTargets`.
- **Verification:** `npm run verify:codex` runs the TOML codec fixture; `npm run verify:commands-grok-build` covers the public command path. Use Python `tomllib` as an additional oracle when available, then run the full gates.

#### B-3 — JSONC `__proto__` handling bypasses prototype-key guards

- **Grade:** Blocker (explicit rule)
- **Location:** `src/core/jsonc/parse.ts:14`; `src/core/jsonc/edit.ts:91`; `src/agents/opencode/manifest.ts:205`
- **Rule:** `docs/agents/code-review.md`: a reader or writer of user keys that skips `isPrototypeKey` / `ownChild` is a Blocker.
- **Failure:** The JSONC parser treats a `__proto__` key as the object’s prototype. A provider block `{"__proto__":{"options":{"apiKey":…}}}` has no own keys, yet ccset reads `options.apiKey` from it. `--model __proto__` is not validated and writes a key ccset can no longer list or remove. `Object.prototype` itself is not changed.
- **Fix:** Use `isPrototypeKey` / `ownChild` in the JSONC parser, editor, and opencode manifest. Reject `__proto__`, `constructor`, and `prototype` in validators. Ensure all reads use own properties only.
- **Regression test:** Add read/write cases to `scripts/verify-opencode-jsonc.ts` and the provider scenario in `scripts/verify-opencode.ts`. The read must not expose planted `apiKey`; `--model __proto__` must be rejected without creating an unlistable key. Both fixtures run through `npm run verify:opencode`.
- **Note:** If the maintainer downgrades this, record the rationale in the verification register. The rule currently marks it Blocker.

### High

#### H-2 — Secrets passed positionally are printed back

- **Grade:** High
- **Location:** `src/commands/parser.ts:226` (also `:98`, `:118`, `:127`, `:230`)
- **Rule:** `AGENTS.md` and `docs/user-guide.md`: a key is never printed in errors or JSON.
- **Failure:** A key typed as a positional argument, e.g. `provider set myprov sk-…`, is printed back. stderr shows `Unexpected argument: sk-…` and JSON puts it in `error.params.value`. That text can end up in CI logs.
- **Fix:** Redact all usage-error values. Never include raw positional or flag values in error params. Use a placeholder such as `[redacted]`. Ensure the JSON envelope is also redacted.
- **Regression test:** Update `verify-commands-secret.ts:11-15` and the test at `:50-62`. The test currently only checks wording; it must assert the token is absent from stdout, stderr, JSON, and error params. Add cases for positional arg and bad command name. Confirm `--token x` and `--token=x` remain safe.
- **Verification:** Targeted secret fixture + full gates.

#### H-1 — Blank field / `--unset` does not remove inline-table keys

- **Grade:** High
- **Location:** `src/core/toml/edit.ts:246`
- **Rule:** `AGENTS.md:66`: a blank field drops the key; `--unset` removes it.
- **Failure:** When a Grok provider is written as an inline table, `--unset baseUrl` exits 0 with `ok:true` and the file is unchanged byte for byte. Saving in the TUI with every field blank reports success and writes a backup, but `api_key` stays. The user is told a key or endpoint is gone when it isn’t.
- **Fix:** Implement unset for inline tables. Blank fields must remove keys. `changed:false` must be reported only when the key is truly absent. Ensure the TUI save translator maps blank fields to removal for inline tables.
- **Regression test:** Add an inline-table unset case to `verify:commands-grok-build`. Test: write an inline-table provider, run `provider set grok-4 --unset baseUrl --json`, assert exit 0, `changed:true`, key removed, file still valid. Add a TUI blank-field save test.
- **Verification:** Targeted fixture + full gates.

### Medium

#### M-1 — Terminal control codes from config values reach CLI and TUI output

- **Grade:** Medium
- **Location:** `src/commands/present.ts:56`; `src/ui/Status.tsx:150`
- **Rule:** Never trust file content.
- **Failure:** Config values are printed with terminal control codes intact. An escape code in a base URL hid text in plain-text Status and in the TUI Status row. Cursor-movement codes can overwrite the endpoint shown. JSON output only escapes the basic C0 range.
- **Fix:** Sanitize config values before rendering. Strip or escape C0, C1, ESC, OSC, and CSI in CLI and TUI output. Ensure JSON escapes all control characters. Prefer a shared `sanitizeForTerminal` helper.
- **Regression test:** Add a test with a config value containing ESC/OSC/CSI. Assert no raw control characters in human output, TUI snapshot is clean, and JSON output is fully escaped.
- **Pin:** Add CLI assertions to `scripts/verify-commands-status.ts` and TUI assertions to the Status terminal/render fixture; run `npm run verify:commands-status`, `npm run verify:status-terminal`, and `npm run verify:ui-render`.

#### M-2 — Out-of-range `\U` escape passes checker, crashes decoder, wrong exit code

- **Grade:** Medium
- **Location:** `src/core/toml/strings.ts:65`; `value-check.ts:49`
- **Rule:** The exit code matches the error; an invalid file goes down the invalid-file path.
- **Failure:** `name = "\UFFFFFFFF"` passes the checker, which only counts hex digits, and then crashes the decoder. `status` exits 1 (“Unexpected failure”) instead of 4. `--replace-invalid` also exits 1, so the documented recovery path does not work.
- **Fix:** Validate Unicode code point range for `\U` escapes, including surrogate exclusion. Treat as invalid file and exit 4. Ensure `--replace-invalid` can recover.
- **Regression test:** Add the malformed value to `scripts/verify-toml-codec.ts`; add a command-level case to `scripts/verify-commands-codex.ts` asserting exit 4 and successful `--replace-invalid` recovery.
- **Pin:** Run `npm run verify:codex` and `npm run verify:commands-codex`.

#### M-3 — TOML checker diverges from strict TOML 1.0

- **Grade:** Medium
- **Location:** `src/core/toml/check.ts:74` (plus `value-check.ts`, `redefine.ts`)
- **Rule:** The checker accepts exactly what a strict TOML parser accepts (9.37).
- **Failure:** It accepts at least 10 things Python’s `tomllib` rejects: `00`, `0_1`, `1__0`, `+0x1`, `1979-13-45`, duplicate inline keys, a bare CR, a bad escape in a key, a control character in a comment, and `\e`. It also rejects valid TOML: a date-time with a space separator plus an offset, and an `[a.b]` table under each `[[a]]` entry.
- **Fix:** Align the checker with TOML 1.0. Add a comparison corpus against a strict parser. Fix both under-rejection and over-rejection.
- **Regression test:** In `scripts/verify-toml-codec.ts`, add a comparison corpus against Python `tomllib`. For each invalid doc, the checker must reject; for each valid doc, it must accept and round-trip.
- **Pin:** `npm run verify:codex` runs `scripts/verify-toml-codec.ts`.

#### M-4 — Test connection follows redirects to unconfirmed hosts

- **Grade:** Medium
- **Location:** `src/agents/claude-code/test-connection.ts:109`
- **Rule:** `AGENTS.md:79`: the confirmation names the host the request goes to.
- **Failure:** `fetch` follows redirects. The probe can end up at a host the confirmation never named, and a 200 from a server that never got the token is reported as “token accepted”. Node drops the token on cross-origin redirects, but this was only verified on Node 26.8.1; `engines` allows Node 18 and up.
- **Fix:** Use `redirect: 'manual'`. Treat redirects as failure or require a new confirmation for the new host. Ensure no token is sent cross-origin. Update the confirmation to name the final host.
- **Regression test:** Add a cross-host redirect case to `scripts/verify-provider-safety.ts`. Assert redirects do not report success or send the token to an unconfirmed host; test on supported Node versions where available.
- **Pin:** `npm run verify:provider-safety`.

#### M-5 — PTY harness can follow inherited real Agent home variables

- **Grade:** Medium
- **Location:** `scripts/pty-session.ts:64`
- **Rule:** `AGENTS.md:81`: tests never touch a real Agent home.
- **Failure:** The terminal test harness points `HOME` at the scratch directory, so ccset treats scratch as the real home and follows inherited `XDG_CONFIG_HOME`, `PI_CODING_AGENT_DIR`, and `GROK_HOME`. `verify:first-run-locale` already reads the developer’s real directories. The next terminal test that saves through opencode, pi, or Grok would write into them.
- **Fix:** In `terminalEnv`, clear `XDG_CONFIG_HOME`, `PI_CODING_AGENT_DIR`, `GROK_HOME`, and any other agent-specific home overrides. Ensure the scratch home is the only home used.
- **Regression test:** Pass inherited `XDG_CONFIG_HOME`, `PI_CODING_AGENT_DIR`, and `GROK_HOME` values pointing only into scratch sentinel directories; assert the PTY child ignores them and creates no files there. Run `npm run verify:first-run-locale` after the harness fix.
- **Current-code check:** `terminalEnv` spreads `process.env` and currently removes CI and unapproved `CCSET_*` values, but leaves these Agent-home overrides intact.
- **Ordering:** Treat this as a fixture-safety prerequisite; verify it before running any PTY-based regression fixture.
- **Pin:** none.

### Low

| ID | Location | Issue | Fix | Regression test |
|---|---|---|---|---|
| L-1 | `src/core/json-file.ts:102`; `copy.ts:17`; `backup.ts:28` | Temp files `<name>.<pid>.tmp` follow planted symlinks; failed `chmod` ignored. Needs write access to config dir. | Create random temporary files exclusively at mode `0600`; never follow a planted link, surface permission failures, and clean up partials. | Symlink attack test; assert outside file untouched and config not left as symlink. Run `npm run verify:write-safety`. |
| L-2 | `test-connection.ts:87` | `startsWith('127.')` treats `http://127.attacker.example` as local, so no plaintext-HTTP warning. | Parse URL hostname; only true loopback (`127.0.0.0/8`, `::1`, `localhost`) is local. | Test expects plaintext warning for `127.attacker.example`; run `npm run verify:provider-safety`. |
| L-3 | `src/commands/secret.ts:47` | `--token-stdin` in an interactive TTY echoes the typed key and leaves it in scrollback. | Detect TTY; require piped stdin or use hidden input. | TTY/guard test; run `npm run verify:commands-secret`. |
| L-4 | `src/agents/codex/auth.ts:190` | `stageAuthProfile` checks one read but keeps a second read, contradicting its own comment. | Use `readConfigFile(...).raw`. | Change the file between validation and staging; assert the staged bytes are the bytes that were validated. Run `npm run verify:codex` and `npm run verify:commands-codex-use`. |
| L-5 | `toml/edit.ts:30`; `redefine.ts:24` | NUL-joined key paths alias crafted keys with real dotted paths. | Represent key paths as arrays; compare segment by segment. | Crafted key `"model_providers\u0000p\u0000base_url"` vs real path; assert no rewrite in `scripts/verify-toml-codec.ts`; run `npm run verify:codex`. |
| L-6 | `toml/parse.ts:107` | Array-of-tables with subtable loses earlier entries: `[[a]] x=1 [a.b] y=2 [[a]] x=3` reads as `{"a":[{"x":3}]}`. | Correct parser to preserve all entries. | Add the case to `scripts/verify-toml-codec.ts`; run `npm run verify:codex`. |
| L-7 | `redefine.ts:31`; TOML and JSONC readers | Deep dotted keys are O(n²) to check and stack-overflow on read; JSONC nested 100,000 deep overflows. | Add depth limits and bounded/iterative traversal; return clean errors instead of crashing. | Add bounded-depth cases to `scripts/verify-toml-codec.ts` and `scripts/verify-opencode-jsonc.ts`; run `npm run verify:codex` and `npm run verify:opencode`. |
| L-8 | `src/core/validate.ts:31, :49` | Only `__proto__` is rejected; `constructor` and `prototype` are not, contradicting `docs/agents/code-review.md`. | Reject all three. | `npm run verify:provider-safety` and `npm run verify:opencode`. |
| L-9 | `pages/src/markdown/render.ts:31` | Sanitizer allows third-party media/SVG/forms and there is no CSP, despite ADR 0015’s first-party promise. | Remove request-capable markup and attributes; add an enforced CSP where the hosting platform supports it, and keep ADR 0015 accurate. | Sanitizer tests reject external-resource elements/attributes; verify deployed headers if CSP is available. |
| L-10 | `pages/package.json:22` | The report flags `react-router-dom` 6.30.6 for GHSA-wrjc-x8rr-h8h6 and says the affected path is reachable from repository markdown. | Re-check the current lockfile, advisory range, and reachability; upgrade to a patched compatible version, using a major upgrade only if needed. | `npm audit` in `pages/` plus a test for the reachable route/redirect behavior. |
| L-11 | `.github/workflows/deploy-pages.yml:10, :29` | Actions pinned by tag, not SHA; broad `pages: write` / `id-token: write`; checkout token left on disk. | Pin actions by SHA; least privilege per job; `persist-credentials: false`. | CI lint/review. |
| L-12 | `package.json:49` | `prepublishOnly` builds whatever is in the working tree; no clean-tree check or provenance. | Add clean-tree check, build from clean checkout, npm provenance. | `verify:release-artifact`. |
| L-13 | `src/agents/opencode/status-dto.ts:161` | opencode plain-text Status prints `Model ids: [object Object]`. | Format model ids correctly. | `verify:commands-status`. |
| L-14 | `src/core/config-file.ts:90` | `writeConfigFile` is exported, has no callers, and skips backup-first. | Remove dead code or route through `applyPlan`. | `code-gates`. |

## 3. Spec/documentation gaps to update after code fixes

After the corresponding code changes, update or correct:

- Register 9.37: failed credential move restores `model_provider`.
- `docs/agents/code-review.md`: inserts fit their structure and rendered documents pass the strict checker.
- `AGENTS.md:66-67`: blank field / `--unset` removes key, including inline tables.
- `docs/user-guide.md`: keys are never printed in errors or JSON.
- `AGENTS.md:79`: confirmation names the destination host, including after redirects.
- `AGENTS.md:72-74`: `--replace-invalid` recovers malformed files.
- `docs/agents/code-review.md`: prototype-key handling on JSONC paths and validators.
- 9.37 / `redefine.ts:12-14`: date-time with space separator plus offset; `[[array]]` redefinition.
- `opencode/paths.ts:12-16`: fixture isolation guarantee under PTY harness.
- ADR 0015: third-party request guarantee for the site.

## 4. Definition of done per finding

A finding is done only when:

- A regression test exists that fails on the pre-fix tree.
- The fix is minimal and does not introduce unrelated behavior.
- The targeted verify script passes.
- `npm run typecheck`, `npm run build`, `npm run verify:code-gates`, and `npm test` pass.
- `npm audit` is clean or the remaining advisory is triaged and recorded.
- The verification register is updated if the finding is fixed, downgraded, or accepted.
- If a commit is requested, its subject includes the finding ID.

## 5. Release gate

Do not release until:

- All Blockers are fixed or downgraded with a recorded reason.
- All Highs are fixed or downgraded with a recorded reason.
- Medium and Low findings are either fixed or explicitly accepted with rationale.
- Full gates pass.
- CI actions are SHA-pinned and least-privilege.
- Release artifact has a clean-tree check and provenance.

## 6. Review limits to keep in mind

- Two parallel review agents failed on API 401: Agent modules and TUI. Those areas were covered manually, but TUI drafts across navigation and per-Agent form-to-file mapping are only as well tested as existing fixtures.
- No Windows verification was done.
- Token stripping on redirects was verified only on Node 26.8.1; `engines` allows Node 18+.
- TOML reference was Python 3.14 `tomllib`. Agent-native parsers were not run.
- The docs site was reviewed by code reading and `npm audit`, not in a browser.
- Re-verify all line numbers against the current tree before editing.
