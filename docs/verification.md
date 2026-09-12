# Verification guide

Use this guide to choose checks for a change. [AGENTS.md](../AGENTS.md) defines
the shared workflow; [Important Documentation.md](<../Important Documentation.md>)
holds manual scenarios, release requirements, unknowns, and recorded evidence.

## Choose checks by scope

| Change | Required local checks |
| --- | --- |
| Documentation only | `git diff --check`; check changed links, anchors, examples, and claims against the referenced source. Runtime checks are needed only when a changed instruction or example needs execution to verify it. |
| Runtime TypeScript or verification fixtures | `npm run typecheck`, `npm run build`, `npm run verify:code-gates`, and the relevant fixtures below. |
| Shared writes, codecs, credentials, or behavior used by multiple Agents/surfaces | The runtime checks plus `npm test`; cover the affected manual data-safety scenarios. |
| Dependencies, build configuration, package contents, or test/CI wiring | `npm run typecheck`, `npm run build`, and `npm test`; inspect the artifact and affected CI jobs. |
| TUI layout, navigation, or input | The runtime checks and relevant UI fixtures; manually exercise the changed flow in a real terminal, including narrow/resize behavior when affected. |
| Release | All requirements in the register's §6, including automated fixtures and the applicable platform evidence. |

Run focused fixtures while developing. Before merging runtime or tooling changes,
the full suite must pass locally or in CI on the applicable supported platforms.
A command's inclusion in CI is not a record that a particular run passed.

## Setup and execution

Use Node.js 18+ and install the locked dependencies:

```bash
npm ci
npm run typecheck
npm run build
```

There is no separate lint command or unit-test framework. The tests are executable
TypeScript fixtures under `scripts/`, using assertions and the shipped modules.
Run an individual fixture with its `npm run verify:<name>` command. `npm test`
runs every named `verify:*` fixture in sequence, including locale parity and
error recovery. [package.json](../package.json) is the command inventory; do not
maintain a separate fixture count in entry-point instructions.

**Run fixtures sequentially in a checkout.** Each fixture bundles into `.verify/`
with `--clean` and removes that directory afterward. Concurrent fixtures can
delete each other's bundle. Several also rebuild `dist/`, so do not run a build
alongside a fixture that uses the built CLI.

The npm scripts use POSIX shell syntax. The PTY fixtures require `python3` and
its POSIX `pty` module. Run the full suite on Linux or macOS; native Windows CI
runs the boundary smoke and packaging checks described below. Permission checks
can be skipped by a fixture on root/win32; report those skips as unverified.

## Fixture map

Choose all rows reached by the change, including the other surface when behavior
is shared between a TUI save and a Non-interactive command.

| Command | Covers |
| --- | --- |
| `npm run verify:global-settings` | Claude Code managed writes, unmanaged-key preservation, proxy deletion, no-op re-save, backup bytes and modes |
| `npm run verify:provider-safety` | Claude Code provider preservation, activation command quoting, rotation, masking, secret-free failures |
| `npm run verify:write-safety` | Create-only state, atomic writes under SIGKILL, backup integrity, permission failures |
| `npm run verify:opencode` | Global/provider semantics, per-key models merging, JSONC corpus and target selection, masking and backups |
| `npm run verify:codex` | TOML corpus, provider invariants, Auth profiles, switching/adoption, recovery failures, screen string resolution |
| `npm run verify:ui-render` | Full Ink component flow, focus, masking, Unicode/ASCII paints, short viewports and scrolling |
| `npm run verify:header-path` | Frame titles on push/back and path elision at narrow widths |
| `npm run verify:review-form` | Changed rows, hints, Advanced toggle, `ctrl+s`, long-value cursor visibility |
| `npm run verify:error-recovery` | Failed-save draft retention and partial-backup listing/cleanup |
| `npm run verify:malformed-dirty` | Malformed-target confirmation and unsaved-edit prompts through a real PTY |
| `npm run verify:first-run-locale` | First-use language choice, persistence, overrides, cancellation, help/version/non-TTY boundaries |
| `npm run verify:status-terminal` | Status refresh/scrolling, narrow layout, version and non-TTY behavior |
| `npm run verify:i18n-zh` | English/Chinese key and placeholder parity, locale normalization and CLI language selection |
| `npm run verify:commands` | Parser and operation boundary, exit codes, patch preservation/deletion, dry-run, no-op, recovery and output |
| `npm run verify:commands-status` | Secret-free status payloads, findings, partial-readable parse failures and state creation |
| `npm run verify:commands-secret` | Secret sources/rejections, provider writes, omitted-secret preservation, output masking |
| `npm run verify:commands-opencode` | opencode status/global commands, typed values, nested preservation, JSONC findings |
| `npm run verify:commands-opencode-provider` | Provider patches, per-key models merge, token placement, new-provider validation, malformed recovery |
| `npm run verify:pi` | pi settings/provider saves through the TUI seam, per-member models merging, comment preservation, blank-field omission, external-modification re-read, byte-identical JSONC corpus, backup rotation and modes, detection, `PI_CODING_AGENT_DIR` rule, status masking |
| `npm run verify:pi-screens` | pi screen string resolution: every action run and descended, labels/help/details/choices against the catalog |
| `npm run verify:commands-pi` | pi provider patches, models merge and secret sources (stdin and `CCSET_TOKEN`), unset/dry-run refusals, secret-free status, malformed recovery, dry-run/no-op zero writes, exit codes |
| `npm run verify:commands-pi-use` | pi global patching and provider use writing both startup leaves, off-list model warning, unreadable-models and no-model refusals |
| `npm run verify:commands-codex` | Codex status/global commands, TOML preservation, typed integers, environment findings and replacement backups |
| `npm run verify:commands-codex-provider` | Provider invariants, Auth profile preservation, credential-source refusals, untouched live auth |
| `npm run verify:commands-codex-use` | Switch ordering, adoption/replacement choices, idempotence, environment preconditions, partial failures |
| `npm run verify:code-gates` | TypeScript file/function size and complexity, plus stale or new baseline violations |
| `npm run verify:release-artifact` | Build, pack, temporary install, allowed package contents, executable/shebang and CLI smoke |

All `verify:commands` / `verify:commands-*` scripts build before running and
exercise `dist/cli.js`; some also assert directly against the operation seam.
`verify:malformed-dirty`, `verify:first-run-locale`, `verify:status-terminal`, and
`verify:i18n-zh` also build first. The release-artifact fixture builds internally,
packs and installs the tarball into a temporary project; it does not publish.
Other fixtures import source modules and are bundled for execution by tsup.

Not every `scripts/verify-*.ts` file is independently runnable. Codec corpora and
Codex recovery helpers run inside the Agent fixtures; `verify-viewport.ts` runs
inside `verify:ui-render`. `ui-session.ts` and `ui-assertions.ts` drive component
tests; `pty-session.ts` drives a real terminal; `cli-harness.ts` runs commands with
isolated homes; `kill-harness.ts` supports `verify:write-safety`.

## Add or extend verification

Prefer extending the fixture for the affected behavior. Assert observable
results: file contents and untouched siblings, backups, permissions, exit codes,
secret-free output, or Rendered paints. Exercise the public operation/CLI boundary
when that is the changed contract. Reuse the harnesses instead of recreating
the behavior being tested.

For a bug, show that the regression assertion fails without the fix. A new Agent
or data-safety fixture also needs a deliberate mutation that makes it fail; see
[adding an Agent](adding-an-agent.md#prove-it). Restore the mutation and run the
fixture again before handing off. Documentation-only changes do not need new
runtime assertions.

Wire a new standalone fixture into both a `verify:*` script and the sequential
`test` script in `package.json`, then add its scope to the table above. Keep helper
modules out of the command inventory. Do not expand the code-quality baseline to
make new violations pass.

## Manual runs and evidence

Use a scratch home for every local write scenario. For example, after building,
run this in a real terminal:

```bash
ccset_scratch="$(mktemp -d)"
CCSET_HOME="$ccset_scratch" CCSET_LOCALE=en node dist/cli.js --agent claude-code
```

Inspect only the files under that directory and remove it when finished. Omit
`CCSET_LOCALE` to exercise first-use language selection. Use placeholder tokens
such as `sk-TEST-DO-NOT-USE` for local checks. A piped interactive invocation exits
2 by design; use a real PTY for input/navigation checks.

Fixtures mounting `App` directly bypass `cli.tsx`: supply the scratch home via
`ctx`, the glyph set via `terminal`, and fixed dimensions via `viewport` when
testing layout. Import `src/registry.js` before resolving Agent message keys,
because message registration happens when that module loads.

Record the command/scenario, result, OS, Node version, and terminal/shell or Agent
version when relevant. Append new runtime evidence to the register's §9; leave
old entries as history. Record failed, skipped, and pending checks explicitly.
Routine documentation checks belong in the handoff or PR description. A fixture
with synthetic files does not prove a live Provider request or another platform.

## CI and release

[ci.yml](../.github/workflows/ci.yml) is the CI definition. It currently runs
typecheck, build, a built-CLI smoke, and `npm pack --dry-run` on Ubuntu, macOS,
and Windows with Node 18/20/22. The smoke requires non-empty `--version` output
without ANSI escapes and a non-TTY interactive refusal with exit 2 and no ANSI.
Ubuntu and macOS also run `npm test`; Windows skips the POSIX fixture suite.

Release checks and platform exceptions are defined in the register's §6 and
[SUPPORT.md](../SUPPORT.md). Platform-specific path, permission, or terminal
changes need manual evidence on that platform. Keep those requirements separate
from the checks needed for a local documentation edit.
