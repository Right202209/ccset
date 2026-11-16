# Verification guide

[简体中文](zh-CN/verification.zh-CN.md) | English

[AGENTS.md](../AGENTS.md) owns the workflow. This guide selects checks; [the register](<../Important Documentation.md>) owns manual scenarios, release gates (§6), and dated evidence (§9).

## Choose checks by scope

| Change | Required checks |
| --- | --- |
| Documentation only | Links, anchors, examples, source-backed claims, `git diff --check`; execute changed instructions when needed |
| Runtime TypeScript or fixtures | Root typecheck, build, `verify:code-gates`, affected fixtures |
| Shared writes/Codecs/credentials, dependencies, build, test/CI wiring | Runtime checks plus full `npm test`; inspect affected artifacts/manual safety scenarios |
| TUI input/layout/navigation | Runtime checks, affected UI fixtures, real-terminal flow; narrow/resize checks when affected |
| Website or rendered Markdown | From `pages/`: typecheck, test with coverage, build, smoke; visible UI changes also need desktop/mobile checks and PR screenshots |
| Release | Register §6 and applicable platform evidence |

Before merging runtime/tooling changes, the full suite must pass locally or in CI on applicable supported platforms. A workflow definition is not evidence that a run passed.

## Setup and execution

CLI: Node ≥18; root `npm ci`, `npm run typecheck`, `npm run build`. There is no root lint command or separate unit-test framework: `scripts/` contains executable assertion fixtures. [package.json](../package.json) is the authoritative command inventory; `npm test` runs its named fixtures sequentially.

**Never run fixtures concurrently in one checkout.** They clean the shared `.verify/` directory; several also rebuild `dist/`. Do not build alongside those fixtures. POSIX shell scripts and PTY checks need Linux/macOS and `python3`; report permission skips on root/win32.

Website: separate package/lockfile, with Node `^22.22.2 || ^24.15.0 || >=26`. Run `npm ci` and its checks from `pages/`; see [site SOP](../pages/README.md).

## Fixture map

Run every row reached by the change, including both surfaces when they share behavior. Each name below is an `npm run verify:<name>` suffix. Coverage describes fixture assertions, not a guarantee for arbitrary unmanaged input.

| Fixture | Boundary covered |
| --- | --- |
| `global-settings` | Claude global leaves, preservation, proxy deletion, backups/modes |
| `provider-safety` | Claude Provider preservation, command quoting, key rotation/masking |
| `provider-management` | Five-Agent delete/ignore, Codex route refusal/sidecar, list return and fresh Edit reads |
| `write-safety` | Exclusive create-only publication, SIGKILL atomicity, backups and permission failures |
| `opencode` | Global/Provider saves, model-map merging, JSONC target/editor corpus |
| `codex` | TOML corpus, Provider invariants, Auth profiles, switching/adoption/recovery |
| `pi` | TUI saves, models by-member merge, JSONC preservation, detection/path overrides |
| `grok-build` | TUI saves, TOML preservation, built-in overrides, detection/path overrides |
| `pi-screens`, `grok-build-screens` | Every reachable Screen string and indirect catalog key |
| `ui-render` | Ink flow, discovery, focus, masking, glyphs, short Viewports/scrolling |
| `header-path` | Navigation titles and narrow path elision |
| `layout` | Panel borders/help, side-panel breakpoints, frameless short terminals |
| `side-info` | Read-only Glance/Preview, refresh, SGR mouse input, locale/width/height budgets |
| `review-form` | Changed rows, hints, Advanced toggle, save shortcut, cursor visibility |
| `error-recovery` | Draft/dirty retention, partial commits/rollback, failed backup cleanup/retry |
| `malformed-dirty` | Malformed replacement and unsaved-edit prompts through a PTY |
| `pty-isolation` | PTY children clear inherited Agent-home overrides |
| `first-run-locale` | First-use choice/persistence, overrides, cancel, help/version/non-TTY |
| `status-terminal` | Refresh/scrolling, narrow layout, version/non-TTY boundaries |
| `i18n-zh` | Both catalogs' keys/placeholders, normalization and CLI locale |
| `short-commands` | Selectors/TTY inference, every preset combination, unified use, Claude run/hidden key |
| `commands` | Parser/operation contract, exit codes, patches/unsets, dry-run/no-op/recovery |
| `commands-parser` | Integer normalization and flags refused as values |
| `commands-status` | Status DTO assertions, partial-readable failures, state init |
| `commands-secret` | Secret sources/refusals, omitted-key preservation, output assertions |
| `commands-opencode` | Global/status, typed fields, nested preservation and JSONC findings |
| `commands-opencode-provider` | Provider/model patches, token placement and malformed recovery |
| `commands-pi` | Provider/model patches, secrets, unset, malformed recovery, zero-write plans |
| `commands-pi-use` | Global patches, both startup leaves, off-list warning/no-model refusal |
| `commands-grok-build` | Provider patches, built-in shape, secrets/unsets/replacement/no-op |
| `commands-grok-build-use` | Global/default-model patches, built-in free text, unreadable config |
| `commands-codex` | Global/status, TOML/integers, environment findings and replacement |
| `commands-codex-provider` | Provider/Auth-profile patches, credential preconditions, untouched live auth |
| `commands-codex-use` | Switch order, adoption/restoration/routing, preconditions and partial failure |
| `code-gates` | TypeScript size/complexity in CLI, fixtures, website; baseline ratchet |
| `release-artifact` | Release guards/workflows, pack/install/contents/shebang, scoped and forwarded CLI parity |

`commands` and `commands-*` build and exercise `dist/cli.js`; some also call the operation seam. `short-commands`, `malformed-dirty`, `first-run-locale`, `status-terminal`, and `i18n-zh` build too. Agent/Codec corpora and helpers run inside these named fixtures, not as extra standalone commands.

The artifact fixture builds/packs without publishing. It installs the forwarding package into a **separate** temporary project and resolves its exact scoped dependency from npm. Installing it beside the local CLI tarball can falsely satisfy the pin from the checkout. This fixture needs registry network access; passing it does not prove trusted-publisher setup.

## Add or extend verification

Extend the affected fixture; assert observable file bytes/values, untouched siblings, backups/modes, exit codes, output or Rendered paints. Use `cli-harness.ts`, `ui-session.ts`/`ui-assertions.ts`, `pty-session.ts`, and `kill-harness.ts` rather than duplicating the implementation.

A regression must fail without its fix. New Agent/data-safety fixtures need a deliberate mutation that turns them red, followed by restoration and a passing run; see [Prove it](adding-an-agent.md#prove-it). Register standalone fixtures in both a `verify:*` script and the sequential `test` chain, then update this map. Never add quality-baseline exceptions for new violations.

Direct `App` fixtures bypass the CLI: inject scratch `ctx.home`, terminal glyphs and Viewport; import `src/registry.js` before resolving Agent message keys. Optional visual output: `CCSET_VISUAL=1 npm run verify:side-info`.

## Manual runs and evidence

After building, run in a real terminal with a scratch home:

```bash
ccset_scratch="$(mktemp -d)"
CCSET_HOME="$ccset_scratch" CCSET_LOCALE=en node dist/cli.js --agent claude-code
```

Use placeholder keys; inspect only scratch files. Omit locale to exercise first use. A no-command invocation with non-TTY stdin exits 2. `CCSET_HOME` isolates ccset writes, **not** an upstream Agent launched by `run`; isolate that process separately.

Record commands/scenarios, result, OS/Node and relevant Agent/terminal/shell versions, including failures/skips/pending checks. Append new runtime evidence to register §9; leave prior entries intact. Routine documentation checks belong in the handoff/PR. Synthetic files do not prove live requests or another platform.

## CI and release

[CLI CI](../.github/workflows/ci.yml): Ubuntu/macOS/Windows × Node 18/20/22 run install, typecheck, build, built-CLI version/non-TTY smoke, and pack dry-run. Ubuntu/macOS also run `npm test`; Windows skips POSIX fixtures.

[Site CI](../.github/workflows/pages-ci.yml) checks PRs touching site/docs/root Markdown/workflows. [Pages deployment](../.github/workflows/deploy-pages.yml) repeats checks on every `master` push and manual dispatch, takes the configured base path, and deploys `pages/dist/`. Root CI does not build the site.

[Publishing](../.github/workflows/publish.yml) routes `v<version>` to `@droite/ccset` and `ccset-v<version>` to the forwarder. Both require a clean matching release, package-specific trusted publisher in `npm-publish`, and provenance. Initial package registration is a maintainer bootstrap step; subsequent releases use the workflow. [Register §6](<../Important Documentation.md#6-build-and-publish>) and [SUPPORT.md](../SUPPORT.md) define release/platform requirements.
