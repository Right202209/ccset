# Failure-oriented CLI/TUI audit — 2026-10-01

Reviewed runtime commit `8680074277c16d1106d62bfdcb286df79350f331`.
The review found **two Blockers and seven High findings** under the repository's
severity rules. The complete existing fixture suite passes, but does not pin
the failure transitions described below. These findings prevent recommending
release or merge of the affected behavior.

## Scope and method

The review covered the CLI/TUI workflows, Agent operations, shared file-safety
code, and their fixtures under `src/` and `scripts/`. Standards and Spec were
reviewed independently against `AGENTS.md`, `CONTEXT.md`, the architecture,
PRD, command specification, implemented user guide, and relevant ADRs.
Website behavior was outside this runtime audit.

The intended behavior is to preserve existing configuration and credentials,
refuse ineffective or unsafe operations before mutation, and expose enough
information to recover when an operation fails after some work has committed.
Probes used temporary homes and placeholder credentials. Concurrent writes were
introduced at deterministic boundaries; permission failures used POSIX modes.
No Agent home outside the scratch directories was modified.

## Standards

### B-1 — Adoption can overwrite an existing saved credential

- **Source:** [auth.ts](../../src/agents/codex/auth.ts), lines 165–168;
  [activate.ts](../../src/agents/codex/activate.ts), lines 43–54 and 154–169.
- **Failure chain:** open the Codex adoption form; another session creates
  `auth.kept.json`; submit `kept`. The snapshot validator accepts the name,
  `adoptLiveAuth` replaces the new profile, and the action reports success.
- **Observed:** the competing credential disappeared. Backups existed for
  `auth.json` and `config.toml`, but none for the overwritten profile.
- **Rule:** re-read targets at save time; every overwrite requires a backup.
- **Handling needed:** publish an adopted profile atomically only if absent.
  Treat a competing creation as a recoverable name conflict and retain the form.
- **Pin:** extend `verify:codex` / `verify-codex-recovery.ts` with a profile
  created after opening the form; assert its original bytes survive.

### B-2 — Create-only onboarding can overwrite Claude's live state

- **Source:** [state.ts](../../src/agents/claude-code/state.ts), lines 66–72.
- **Failure chain:** ccset observes an absent `.claude.json`; Claude creates
  it before ccset's final rename; ccset replaces the newly created document.
- **Observed:** injecting that competing creation immediately before rename
  removed `projects` and history, leaving only `hasCompletedOnboarding`.
  ccset returned `created: true`.
- **Rule:** `~/.claude.json` is create-only and must remain untouched when present.
  The source comment acknowledges the race; there is no accepted exception to
  that guarantee.
- **Handling needed:** publish the completed temporary file without replacement;
  an existing destination must remain intact and produce an unchanged result.
- **Pin:** extend `verify:write-safety` with creation between the absence check
  and publication, asserting byte-identical preservation.

### H-1 — Backup cleanup reports success when deletion fails

- **Source:** [backup.ts](../../src/core/backup.ts), lines 152–160.
- **Failure chain:** a backup directory is readable but not writable; `unlink`
  fails; the error is swallowed and the reported removal count still increases.
  Agent cleanup actions render that count as success.
- **Observed:** with directory mode `0500`, the function returned `1` while
  the credential-bearing backup remained present.
- **Rule:** the documented cleanup outcome in verification register F12.
- **Handling needed:** count successful deletions, retain failed paths and
  reasons, and present partial cleanup with a retry route.
- **Pin:** extend `verify:error-recovery` with denied and mixed-success deletions;
  assert both remaining files and the displayed outcome.

### H-2 — Failed-save recovery loses the unsaved-edits guard

- **Source:** [App.tsx](../../src/ui/App.tsx), lines 75–82;
  [useReviewForm.ts](../../src/ui/useReviewForm.ts), lines 113–117.
- **Failure chain:** enter a Provider and token; saving fails on permissions;
  return to the preserved form; press Esc. Submission replaced `screen.values`
  with the draft, and the dirty comparison now treats that draft as unchanged.
- **Observed:** no discard prompt appeared; navigation returned to the Provider
  list; the Provider file had never been saved.
- **Rule:** failed saves retain user input; unsaved edits require confirmation.
- **Handling needed:** keep the retained draft separate from the baseline used
  for unsaved-edit detection, and clear dirty state only after a successful save
  or explicit discard.
- **Pin:** extend `verify:error-recovery` with failed save → back → Esc, as well
  as its existing failed save → back → retry case.

### H-3 — The TUI hides which files a partial commit changed

- **Source:** [useScreens.ts](../../src/ui/useScreens.ts), lines 48–57.
- **Failure chain:** an operation commits its first target and fails on the
  next. `PartialCommitError` retains committed target records, but the TUI
  renders only the cause and optional rollback error.
- **Observed:** a presentation probe containing a committed `config.toml` and
  a failed `auth.acme.json` showed the failed path, but omitted the changed path,
  its backup, and the partial-operation warning. The CLI has a partial-path
  presenter; the TUI does not use the same information.
- **Rule:** multi-target failures must name already-written paths as partial.
- **Handling needed:** carry committed paths, backups, and rollback outcomes
  through both presenters so users can inspect, restore, or retry knowingly.
- **Pin:** extend `verify:error-recovery` with a real multi-target failure and
  assertions on the resulting error Screen.

## Spec

### H-4 — Command adoption does not preserve the route needed to switch back

- **Source:** [provider-use.ts](../../src/agents/codex/provider-use.ts),
  lines 186–195 and 227.
- **Requirement:** the user guide promises adoption keeps a “new, switchable
  profile.” The TUI records adopted routing for this purpose.
- **Failure chain:** switch `legacy` → `router` using
  `--adopt-current-as saved`; then use `saved`. The command saves auth bytes
  without routing metadata and subsequently treats the profile name as a
  Provider ID.
- **Observed:** both operations succeeded, but `model_provider = "saved"`
  referenced no `[model_providers.saved]` table. The prior `legacy` route was
  not restored.
- **Handling needed:** persist the original routing alongside adoption and
  restore that pairing through either surface; validate the effective route.
- **Pin:** extend `verify:commands-codex-use` with adoption → restore round trips,
  including a nondefault original Provider and a restore from the TUI.

### H-5 — Codex saves do not enforce the home-mismatch refusal

- **Source:** [commands.ts](../../src/agents/codex/commands.ts), lines 97–110;
  [provider-commands.ts](../../src/agents/codex/provider-commands.ts), lines 113–120.
- **Requirement:** ADR 0012 says “every mutating Non-interactive command fails
  before writing” when Codex reads a different directory.
- **Observed:** with mismatched `CODEX_HOME`, `global.set` changed the target
  with no warning; `provider.set` changed it with only a warning. The refusal
  exists in `provider.use` alone.
- **Consequence:** automation receives success for configuration Codex will
  ignore, and backups/writes occur despite the required precondition.
- **Handling needed:** enforce the home precondition in every command mutation
  before planning or applying writes.
- **Pin:** extend `verify:commands-codex` and `verify:commands-codex-provider`;
  assert refusal, unchanged bytes, and no new backups.

### H-6 — TUI activation bypasses the keyring precondition

- **Source:** [activate.ts](../../src/agents/codex/activate.ts), line 86 onward.
- **Requirement:** the user guide says keyring mode must not offer a switch
  that changes nothing; ADR 0013 requires provider use to fail before writing
  when `auth.json` is ineffective.
- **Observed:** with `cli_auth_credentials_store = "keyring"`, `openActivate`
  offered confirmation; confirming changed routing and auth bytes and returned
  a success message.
- **Consequence:** the endpoint can change while Codex retains its effective
  keyring credential, leaving the user with a success report for an ineffective
  or mismatched switch.
- **Handling needed:** share the activation precondition across surfaces and
  recheck it at confirmation time, including restoration.
- **Pin:** extend `verify-codex-recovery.ts` with keyring activation/restoration
  and a keyring setting changed while confirmation is open.

### H-7 — Pi validates the patch instead of the complete resulting state

- **Source:** [providers.ts](../../src/agents/pi/providers.ts), lines 166–173.
- **Requirement:** its documented invariant rejects “deleting the last api
  value while keeping models”; verification register §9.41 also records the
  requirement that custom-model blocks carry `api`.
- **Failure chain:** a Provider already has models and a protocol; remove `api`
  without changing the models. The validator returns early because the patch
  contains no models-array write.
- **Observed:** `provider.set` with `--unset api` succeeded while
  `models: [{ "id": "m1" }]` survived without a protocol. An unchanged TUI
  model list reaches the same early return.
- **Handling needed:** validate the fully merged Provider, including existing
  models and their effective protocol, before any write.
- **Pin:** extend `verify:commands-pi` and `verify:pi` with protocol removal while
  models remain, covering omitted and unchanged model inputs.

## Engineering priorities

1. Put non-overwrite guarantees at the final filesystem publication step.
   A validation snapshot cannot enforce them against another writer.
2. Share preconditions and validate the resulting state across CLI and TUI.
   A partial patch and a successful filesystem write do not prove usable config.
3. Preserve recovery facts through the entire handling chain: cause → committed
   changes → rollback outcome → retained draft → accurate user action.
4. Extend fixtures around transitions: open → external change → submit;
   failure → back → cancel/retry; adoption → restore; and partial cleanup.
   Existing assertions pass while these transitions remain unprotected.

## Verification and limits

Environment: Linux x86_64, Node.js `26.10.0`, npm `12.1.0`.

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm run verify:code-gates` | Passed: 265 files, 10 baseline exceptions |
| `timeout 180s npm test` in the original sandbox | Timed out, exit 124, in the Codex fixture's Python oracle subprocess |
| `timeout 240s npm test` after sandbox removal | Passed, exit 0, including the release-artifact fixture |
| `node /tmp/ccset-standards-probe.mjs` | Reproduced B-1, B-2, H-1 |
| `node /tmp/ccset-review-root/draft-probe.mjs` | Reproduced H-2 through the existing Ink harness and a real permission failure |
| `node /tmp/ccset-review-root/partial-probe.mjs` | Reproduced H-3's presentation loss using an injected typed partial error |
| `node /tmp/ccset-spec-audit.mjs` | Reproduced H-4 through H-7 through operations and TUI Actions |
| `git diff --check` and report link checks | Passed |

The temporary probes bundled unchanged source with esbuild and are review
evidence, not permanent regression fixtures. Their observable steps and the
fixtures that should pin fixes are documented above. No runtime fix was made.

The oracle stall also occurred with a minimal synchronous Python stdin probe
inside the sandbox; its successful unrestricted suite rerun gives no basis to
classify it as a production TOML-parser defect. Known command-contract deviations
already disclosed at the top of the M3 specification and the explicitly
unverified power-loss durability were not reported as new defects.

No live Provider requests, real Codex/pi startup, Windows/macOS runs, manual
terminal smoke, or website checks were performed. File outcomes and returned
operation results are confirmed; live Agent effects are inferred from the
documented contracts. The existing untracked `bun.lock` was preserved.

Summary by axis: Standards — 2 Blockers, 3 High; worst: irreversible credential
or live-state overwrite. Spec — 4 High; worst: adoption cannot restore its
original routing and can report a successful switch to an undefined Provider.
