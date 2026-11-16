# Code review rules

Review on two axes: **Standards** (documented invariants) and **Spec** (the originating requirement). Grade by data loss, credential exposure and user impact, not line count. [AGENTS.md](../../AGENTS.md) owns contributor rules; [open findings](../../review.md) distinguish existing limitations from resolved history.

## Process

1. Pin base/head or working-tree scope and file list; read supplied issue/PR/comments. A full audit includes source, fixtures, website and affected docs.
2. Read area ADRs and select [scope checks](../verification.md#choose-checks-by-scope). Documentation-only review checks links/examples/claims/diff; do not impose unrelated runtime gates.
3. Trace affected reads/writes through overlay, validation, plan/apply, and every secret to its output sites. Identify each managed field's owner, deletion policy and regression fixture.
4. For a behavior change, identify the assertion that fails when the fix is reverted. Run required checks sequentially and distinguish actual runs, historical evidence, skips and pending work.
5. Report actionable findings with source location, violated contract, concrete trigger/consequence, severity and fixture to extend. A suggested fixture is not proof it currently catches the defect.

## Severity

| Grade | Meaning |
| --- | --- |
| Blocker | Data loss, credential exposure, startup failure, mandatory release-check failure, or unsafe prototype mutation |
| High | Broken safety/behavior contract or ineffective activation; serious gap without demonstrated data loss |
| Medium | Interface/source-of-truth breach, missing regression/locale, wrong exit classification |
| Low | Style/quality violation, stale comment or fixture hygiene |

Blocker/High prevents recommending merge. Fix Medium before merge unless the maintainer records an acceptance rationale; Low may be batched. Unsupported guarantees in documentation are findings too.

## Review checkpoints

| Area | Check |
| --- | --- |
| Managed writes | Leaves, not parent replacement; retained model metadata; undefined deletes, false remains; CLI omissions preserve without TUI defaults |
| Freshness | Every form entry and save re-read; do not reuse list records for persistent Edit; held managed fields still overwrite external same-field edits |
| Planning | Every ordinary command target preflighted; rendered syntax checked; no-op/dry-run create no writes/backups; invalid-authorized state distinguished from absent |
| Publication | Private exclusive stage, backup before replacing config, per-file atomicity; create-only publication cannot overwrite; no claimed locks/CAS/fsync durability |
| Partial failure | All committed paths/backups and rollback failure remain visible, including adoption and post-delete ignore-note failure |
| Codecs | Empty roundtrip/unrelated text preserved in TOML/JSONC; safe scalar-parent/inline/member edits; deliberate TOML extensions outside tomllib parity |
| User keys | Own-property traversal and shared __proto__ guard; constructor/prototype remain ordinary data, not discarded |
| Codex | Effective route stays paired with profile through adopt → fail/retry → remove/recreate → restore; live auth replaces whole; keyring and overriding sources checked at the affected boundary |
| Provider removal | Confirmed TUI, whole named file/block, backup and absent no-op; Codex active route refused, sidecar before table; clears ignore note/closes origin |
| Settings | Locale and all Agents' ignored lists survive known-schema writes; do not claim arbitrary unknown-key retention |
| Secret input/output | Explicit script env/stdin or permitted hidden preset prompt; refusal never prints raw argv; diagnostic DTOs project safe fields, including URL userinfo and unmanaged metadata |
| Probes/launch | Probe confirms actual host, refuses redirects, suppresses body; explicit run uses argument array/no shell, dry-run no launch, child status forwarded |
| Seams | Agent paths/defaults/manifests/messages stay local; no Agent UI import; structured operations, no Ink/Screen callbacks in commands; static registry |
| Overrides | CCSET_* read at CLI boundary; upstream rules Agent-owned, scratch-isolated; CODEX_HOME reported rather than followed, CLI mismatch refused |
| Locale | en/zh-Hans keys/placeholders and indirect labels resolve; import registry in fixtures; covered English/Chinese docs move together |
| TUI | Interior Viewport, visible focus/shortcuts/mouse rows, Unicode/ASCII fit, content-height frame/scrollback; save recovery retains draft/dirty baseline |
| Side info | Read-only status Glance, loaded-row Preview, credential presence and valid origins only; no new View-level Agent file reads |
| Website | Repository Markdown raw imports/registry, both labels, allowlist sanitizer/CSP, separate Node/lockfile, desktop/mobile evidence when UI changes |
| Quality/release | Executable size/complexity ratchet and manual nesting/parameter/constant checks; clean tagged artifact/provenance; actual platform evidence |

Checkpoints are desired invariants, not assertions that every current path enforces them. CLI/TUI Codex orchestration and Status projection still have [documented gaps](../../review.md).

## Report

Lead with the consequence. Group Standards and Spec findings; for each include severity, `file:line`, rule/requirement, trigger and impact, minimal correction, and regression pin. Report no finding when evidence does not support one. Finish with actual commands/results, remaining uncertainty and checks not run. Do not paste credentials, whole settings files, or raw home paths.
