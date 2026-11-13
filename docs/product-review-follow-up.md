# November 2026 product review: follow-up dependencies

[简体中文](zh-CN/product-review-follow-up.zh-CN.md) | English

This is maintainer planning, not a committed release schedule. This change
implements P0 01–04. The review's download and competitor figures are supplied
snapshot data, not independently verified measurements. At implementation time,
GitHub About already had positioning copy and the README already had a terminal
GIF; both were retained/refined rather than recreated.

| Review item | Dependency and next reviewable deliverable | Acceptance evidence |
| --- | --- | --- |
| 05 Declarative apply | Build on 03 preset data and 09 credential references. Specify secret resolution, per-Agent patches, all-target preflight, redacted diff, and partial failure before `ccset.toml` parsing. Gated by the project plan; see the order below. | One fixture fans a Provider out to three Agents; dry-run creates nothing; a malformed last target prevents every write. |
| 06 Protocol probes | Reuse destination confirmation, no redirects, and response-body suppression. Define Messages, Responses, and Grok backend requests, timeout/auth/protocol result codes, and an explicit script confirmation naming the host. opencode's SDK-dependent protocol remains unsupported until mapped. | Mock-server contract tests for auth failure, timeout, malformed protocol, redirects, and no body/secret output; live evidence separately. |
| 07 Backup lifecycle | First specify a noninteractive `backups clear` contract over existing cleanup. Coordinate 08 destructive confirmation and 09 credential-source changes. Decide whether rotation cleanup is opt-in and how expiry preserves the last recoverable original; never silently erase recovery evidence during this P0 change. | Age-based selection, dry-run, partial cleanup failures, and rotation/rollback tests with placeholder credentials. |
| 08 Script lifecycle | Reuse status DTOs for list/show and provider-removal helpers for delete. Extend ADRs 0007/0019 with `--yes`, dry-run, active-provider checks for every Agent, ignored-provider visibility, and whole-file versus shared-block behavior. | Script completes add → inspect → use → remove → backup cleanup, with active deletion refused and secret presence only. |
| 09 Credential references | Specify literal versus reference input, `--token-env` conflicts, unsets, missing variables, and Agent-native precedence. Revise Codex's env_key refusal and Grok's unmanaged env_key policy together with their manifests and shared preflight. | All supported reference shapes round-trip without secret bytes; unsupported Agents fail before writing; switching cannot activate stale inline auth. |
| 10 Agent intake | Check demand and Gemini CLI's publicly documented custom-endpoint contract before an integration proposal. Evidence and repeatable fixtures are gates; requiring a preceding external issue conflicts with the current contribution policy and needs an explicit policy decision. | External user scenario plus format fixtures and maintained verification; do not add an Agent solely from a competitor's list. |
| 11 Distribution | Independently verify npm ownership/availability, actual v0.10.0 installability, and Release body before editing publishing claims. Binary/Homebrew packaging needs its own supply-chain, platform, update, and runtime plan. | Clean-machine install and artifact checks; one recorded native Windows interactive session. |
| 12 Preset distribution | Depends on shipped 03 and, for multi-Agent dotfiles, 05/09. Write tested devcontainer, CI, dotfiles and remote-development recipes using released command versions and environment-sourced keys. | Recipe execution in isolated environments; count external usage only once search evidence exists. |
| 13 User/task docs | Use the unified verbs from 02/04 for task recipes; move detailed reference with anchor redirects and bilingual links. A comparison page needs current primary evidence and clear cases where cc-switch is preferable. | Link/search checks, executable examples, and a first-switch walkthrough without reading the long reference. |

Order, decided on 2026-11-10 in the [project plan](project-plan.md): deliver 08
and 07 first, so a script can remove a Provider and clear the backups that still
hold a rotated key; then agree and deliver 09's secret-reference contract. 05 is
gated: it starts only after 09 and a redacted diff are released and an external
user asks for multi-machine or CI setup. Work on 06 independently. 12 follows a
release of presets; 10–11 need external evidence/access; 13 can progress
alongside each shipped flow. The current release's ten-backup retention, TUI-only deletion, and probe
coverage remain the actual behavior until those changes are implemented.
