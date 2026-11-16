# Important Documentation

Design lessons, release gates and evidence index for **ccset** (`@droite/ccset`). Traced against `b4d1c1f` (0.11.1). **Current source and executable fixtures determine behavior; historical passes and proposals do not.**

[AGENTS.md](AGENTS.md) owns contributor rules and the TDP loop; [architecture](docs/architecture.md) maps implementation; [verification](docs/verification.md) selects checks; [review.md](review.md) owns open safety gaps. [ADR 0021](docs/adr/0021-keep-the-active-register-concise-and-pin-historical-evidence.md) makes active summaries editable while retaining original evidence in Git.

## 1. Blocking unknowns

These are upstream evidence gaps, not missing local implementations. Local fixtures do not establish live compatibility; record upstream versions and effective behavior separately.

| ID | Unverified upstream behavior |
| --- | --- |
| U1 | Claude `apiKeyHelper` authentication with third-party base URLs; credential references remain gated |
| U2 | Claude session `--settings` versus global model/env precedence |
| U3 | Claude effective behavior of the emitted `fallbackModel` array |
| U4 | Claude native backup pruning; ccset already uses its own `backups/ccset` directory |
| U6 | opencode effective JSON/JSONC merge order; ccset edits existing JSONC preferentially |
| U8 | Codex third-party Responses authentication with `requires_openai_auth` |
| U9 | Codex live keyring/file credential precedence; ccset refuses unsupported activation |
| U10 | pi custom models/commented `models.json`; Grok built-in overrides and model suggestions also need live evidence |

## 2. Stable design principles (Constraints)

- **Put policy with its owner.** Agent paths/defaults/fields/messages stay local; core owns reusable format/file safety and Views render data. A second integration proves a seam better than a fixed file-count promise ([architecture](docs/architecture.md#entry-points-and-contracts), [integration guide](docs/adding-an-agent.md)).
- **Make intent explicit.** A Managed patch, whole-Provider deletion, credential switch and session launch are distinct operations. Preserve omitted CLI fields and unmanaged siblings; follow each surface's explicit removal/consent contract ([command contract](docs/milestone-3-non-interactive.md), [Provider lifecycle](docs/user-guide.md#deleting-and-ignoring-providers)).
- **Match freshness to lifetime.** Read on every Edit entry and again before saving. A held draft and the fresh unmanaged disk state serve different purposes; rebuilding a Screen in a fixture can conceal a stale closure ([write pipeline](docs/architecture.md#write-pipeline), [navigation](docs/architecture.md#navigation-terminal-and-language)).
- **Separate safety mechanisms.** Strict parsing/consent decides whether a write is allowed; private staging protects unpublished bytes; exclusive creation protects an absent destination; atomic replacement protects one publication. None supplies the other guarantees ([Codecs and write pipeline](docs/architecture.md#codecs)).
- **Report the state that survived.** Preflight prevents known later-target errors, while I/O can still partially commit. Recovery must inspect the credential commit point and report remaining paths/rollback failures ([Codex switching](docs/milestone-3-non-interactive.md#codex-switching)); current gaps stay in review.md.
- **Bound evidence.** A fixture pass establishes its asserted boundary at one revision/environment. Packaged installs, native terminals and live upstream behavior need their own evidence ([verification](docs/verification.md#manual-runs-and-evidence), [support](SUPPORT.md)).

## 3. Avoid failed approaches (Anti-patterns)

| Prohibition | Reason / durable owner |
| --- | --- |
| Do not parse/reprint TOML or use JSONC `modify()` to promise preservation | Reprinting loses comments/order/alignment; `modify()` rewrote adjacent compact arrays. Use span edits and recheck syntax ([ADR 0003](docs/adr/0003-edit-toml-in-place-rather-than-re-serialising.md), [0004](docs/adr/0004-take-the-jsonc-parser-from-npm-keep-the-editor-in-house.md)). Plain JSON preserves values, not original formatting. |
| Do not locate a JSONC edit with a first-duplicate lookup | The reader uses the last duplicate; editing the first reports success without changing the effective value. [The editor](src/core/jsonc/edit.ts) follows last-wins paths and deletes duplicates so old values cannot reappear. |
| Do not reuse a list-loaded record as every Edit baseline | A retained Screen restored a rotated key in 0.11.0; [the same-Screen fixture](scripts/verify-provider-screens.ts) pins fresh reads. |
| Do not implement create-only as absence-check followed by overwriting rename | A concurrent creator can be overwritten; use [exclusive hard-link publication](src/core/create-file.ts), with no overwriting fallback. |
| Do not always roll back routing after an auth-write exception | The new credential may already have landed; CLI checks that state and reports surviving changes ([failure fixture](scripts/verify-commands-codex-use-failure.ts)). TUI orchestration still has [open gaps](review.md). |
| Do not describe atomic replacement as a transaction, lock or durable flush | Writes are atomic per file; no lock/CAS, cross-file transaction or fsync guarantee exists. Concurrent writes and final backup-name collisions remain [open findings](review.md). |
| Do not promise complete redaction or guaranteed ten-backup retention | URL/unmanaged-metadata leaks remain open; automatic pruning can leave excess backups after unlink failure. Explicit cleanup reports actual removals/failures. |
| Do not pass credentials in argv, raw diagnostics or real-home fixtures | Use placeholder/scratch files, masked TUI input and explicit safe output projections. Scripts accept only `CCSET_TOKEN`/`--token-stdin`; hidden prompting is limited to eligible terminal preset `add`. Backups may retain plaintext keys. |
| Do not equate saved settings or a probe with live compatibility | Saving affects a next start/session. Probes confirm the host, refuse redirects and discard bodies; upstream prompt behavior requires separate evidence. `CCSET_HOME` does not isolate an Agent launched by `run`. |
| Do not verify the forwarder beside the local main tarball | npm can satisfy the pin locally and compare the build with itself. Use the [independent registry install fixture](scripts/verify-release-artifact.ts). Prepared source is not publication evidence. |
| Do not sanitize a whole multiline report or test human output only through JSON | Escaping the joined report turned newlines into literal `\x0a`. [Sanitize each row before joining](src/commands/presets.ts); [assert both output surfaces](scripts/verify-short-presets.ts). |

Own-property traversal blocks `__proto__`; `constructor`/`prototype` are ordinary data keys. Model IDs use Agent-specific validation, not the stricter Provider-ID validator. Python `tomllib` checks the parity corpus; TOML `\e`, leap seconds and year `0000` are intentional separate extension cases.

## 4. Development and verification (SOP)

Follow [AGENTS.md's workflow](AGENTS.md#workflow) and [TDP loop](AGENTS.md#knowledge-base-self-evolution-specification-tdp-loop); select commands from [verification](docs/verification.md#choose-checks-by-scope). Run root fixtures sequentially because they share `.verify/` and can rebuild `dist/`.

For a regression, exercise the actual public transition: rotate → reopen Edit → save from one retained Screen; inject failure before/after auth publication → inspect disk and partial/rollback output; install the packed forwarder independently → inspect registry resolution. Mutation-prove new Agent/data-safety assertions, restore the mutation and rerun. Successful isolated callbacks or package metadata alone missed these failures.

The [fixture map](docs/verification.md#fixture-map) owns coverage and the command inventory. Keep scratch scenarios independent and strip inherited Agent-home/CI settings from PTY children ([harness](scripts/pty-session.ts)); these controls prevent false results rather than change runtime policy.

## 5. Environment and platform

CLI: Node ≥18. Website: separate [package engine/lockfile](pages/package.json), with checks run from `pages/`. POSIX/PTY fixtures need Linux/macOS and `python3`. A no-command invocation with non-TTY stdin exits 2 with ANSI-free text.

[SUPPORT.md](SUPPORT.md) defines macOS/Linux support, WSL/Windows Terminal with PowerShell as best effort, and `cmd.exe` as unsupported. Windows ACLs are unmanaged; WSL Linux permissions do not establish protection on mounted Windows filesystems.

[CLI CI](.github/workflows/ci.yml) runs Node 18/20/22 on Ubuntu/macOS/Windows; Windows skips the POSIX suite. CI definitions/passes, manual platform runs and live Provider checks are distinct evidence. Record the actual OS/Node/Agent/terminal/shell and narrow/resize/core-flow observations.

## 6. Build and publish

Releases require typecheck/build/full sequential `npm test`, packed-artifact inspection/install/core-flow smoke, relevant safety checks and no known data-loss/credential-exposure/startup/mandatory-check failure. Run the root checks separately in this order:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm pack --dry-run
```

Manually smoke macOS/Linux core flow. State any omitted manual run; platform-specific path/permission/terminal changes remain blocked until tested on that platform. A patch must preserve existing configuration meaning; safety fixes normally ship as patches. Only the latest published ccset release receives support.

| Package | Artifact and release route |
| --- | --- |
| [@droite/ccset](package.json) | Single application ESM `dist/cli.js` with shebang, bilingual READMEs/license/package metadata; declared runtime dependencies remain external. Release tag `v<version>`. |
| [ccset forwarder](packages/ccset/package.json) | `cli.js`, bilingual READMEs/license/package metadata; exact already-published scoped dependency verified by independent installation. Release tag `ccset-v<version>`. |

Tarballs exclude source, fixtures and local settings/secrets. [publish.yml](.github/workflows/publish.yml) uses clean, version-matched GitHub Releases, package-specific trusted publishers in `npm-publish` and provenance; [the release guard](scripts/check-release-state.mjs) refuses other contexts. Maintainer bootstrap handles first registration; do not substitute long-lived npm tokens or infer registry availability from a dependency pin.

Website SOP: from `pages/`, run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke`. [Pages deployment](.github/workflows/deploy-pages.yml) checks and publishes `pages/dist/` on `master` push/manual dispatch; root CLI CI does not build it. Repository Markdown is imported directly; do not copy it into the site. Visible changes require desktop/mobile evidence ([site guide](pages/README.md)).

## 7. Code-quality gates

[AGENTS.md](AGENTS.md#style-and-verification) owns style. `verify:code-gates` checks `src/`, `scripts/` and `pages/`: files ≤300 lines, functions ≤50 nonblank lines, complexity ≤10. Manually check nesting ≤3, positional parameters ≤3 and constant ownership. Remove fixed baseline entries; never add exceptions for new violations.

## 8. Trace of landed decisions

[The source trace](docs/reviews/2026-11-16-tdp-trace.md) maps key commits and failed alternatives to current implementation, executable boundaries and durable owners. It records the shift from Claude-shaped core to Agent-owned policy, real Codecs/structured operations, explicit launch, failure-aware recovery and lifetime-aware fixtures.

This consolidation removed provisional module/menu inventories, duplicate scenario lists, rerun diaries, old check counts/line numbers, resolved scope/Codec blockers and workstation chores. Blanket no-launcher/mandatory-`--agent` rules were replaced by [ADR 0020](docs/adr/0020-add-short-commands-presets-and-session-launch.md). The current owners above carry the rules; Git retains the original exploration.

## 9. Implementation register (code complete)

Maintain a compact, editable evidence index through Trace → Distill → Prune. Each summary identifies the conclusion, revision/date, source/fixture, recorded check results and limits; link detailed commands/environments from the PR/CI or a scoped evidence note. Update or remove superseded summaries and keep rules at their durable owners. Routine documentation checks stay in the handoff/PR.

The [original §9.0–§9.78 register][legacy-register] is pinned to `b4d1c1f719eda676a98d9ba90457c2b008628c1b`; inspect it with `git show b4d1c1f:'Important Documentation.md'`. It contains superseded instructions and blockers and is only for tracing history. Existing referenced anchors below remain evidence pointers; the pre-existing §9.79 record is retained verbatim.

### 9.53 Application-security remediation findings (2026-09-24)

[Original §9.53–§9.56 evidence](https://github.com/Right202209/ccset/blob/b4d1c1f719eda676a98d9ba90457c2b008628c1b/Important%20Documentation.md#953-application-security-remediation-findings-2026-09-24). September closure does not close the later [safety findings](review.md).

### 9.63 Failure-oriented CLI/TUI audit (2026-10-01)

[Original audit/results](https://github.com/Right202209/ccset/blob/b4d1c1f719eda676a98d9ba90457c2b008628c1b/Important%20Documentation.md#963-failure-oriented-clitui-audit-2026-10-01); [retrospective](docs/reviews/2026-10-01-resilience-audit.md). Dated blockers and counts are not current instructions.

### 9.78 v0.11.1 published; forwarder pinned to it; the route for the unscoped name (2026-11-13)

[Original publication/bootstrap evidence](https://github.com/Right202209/ccset/blob/b4d1c1f719eda676a98d9ba90457c2b008628c1b/Important%20Documentation.md#978-v0111-published-forwarder-pinned-to-it-the-route-for-the-unscoped-name-2026-11-13). Scoped publication and prepared unscoped forwarding source are separate facts; this edit makes no new registry check.

[legacy-register]: https://github.com/Right202209/ccset/blob/b4d1c1f719eda676a98d9ba90457c2b008628c1b/Important%20Documentation.md#9-implementation-register-code-complete

### 9.79 Website checks for README demo preservation (2026-11-16)

Documentation-only scope on `docs/tdp-documentation` at 0.11.1. The English and
Chinese README demo blocks were restored before Quick Start with their original
public GIF and animation-view links. Linux x86_64, Node.js 26.13.0/npm 12.2.1.

From `pages/`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run smoke` passed. Vitest reported 14 files/76 tests passed and 92.78% line
coverage. The smoke verified three assets, routes, and the gzip budget. Its first
attempt failed because the sandbox refused the local preview port; the authorized
rerun outside the sandbox passed.

No full CLI suite, new browser screenshots, native macOS/Windows checks, or live
Provider requests were run for this documentation-only scope.
