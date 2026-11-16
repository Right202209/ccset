# Product follow-up contracts

[简体中文](zh-CN/product-review-follow-up.zh-CN.md) | English

Unimplemented proposals, not usable commands or a release schedule. P0 01–04 (selectors, short verbs, presets, use/run) landed; [project decisions](project-plan.md#decisions) govern the remaining order. Current operation/option inventory is in [the command contract](milestone-3-non-interactive.md).

| ID | Dependency/contract to specify | Acceptance evidence |
| --- | --- | --- |
| F-05 Declarative apply | Released redacted diff + references + external multi-machine/CI request; user-owned input, secret resolution, Agent patches, all-target preflight and partial failures | Multi-Agent fan-out; dry-run creates nothing; malformed last target prevents every write |
| F-06 Protocol probes | Host confirmation, timeout/auth/protocol distinctions, no redirects/body output; SDK-dependent opencode requires explicit mapping | Isolated mock failures/redirects; no body or secrets; live evidence separately |
| F-07 Backup lifecycle | Script cleanup contract, explicit consent, opt-in rotation cleanup; expiry must preserve intended recovery evidence | Selection/dry-run, denied/mixed removal, rotation/rollback with placeholders |
| F-08 Script lifecycle | Inspect/delete/ignore visibility, destructive consent, active-route policy and whole-file/shared-block semantics; extend ADRs 0007/0019 | Add → inspect → use → delete → cleanup script; refused unsafe deletion; presence-only output |
| F-09 Credential references | Literal/reference input, conflicting sources, unsets/missing variables, native precedence; reconcile Codex and Grok policies | Supported references roundtrip without secret bytes; unsupported shapes fail before writes; no stale inline credential activation |
| F-10 Agent intake | Concrete demand, upstream writable endpoint/credential contract, complete proposal; no mandatory preceding issue | Source-backed format and repeatable fixture/manual evidence; no competitor-count additions |
| F-11 Distribution | Verify registry ownership/release evidence; binary/Homebrew need supply-chain/update/platform plan | Packed install; actual registry pin; native Windows interactive evidence before that claim |
| F-12 Recipes | Released presets/commands; refs/apply only when those features land; isolate upstream run too | Executed SSH/devcontainer/CI recipes, external signals explicitly sourced |
| F-13 User/task docs | Explain shipped verbs/activation/owned files/refusals, bilingual anchors; comparisons require fresh primary sources | Link/search checks and first-switch walkthrough; no draft commands advertised as installed |

Deliver F-08/F-07 before F-09; F-05 waits for its gates. F-06 can progress independently; F-12/F-13 accompany released flows; F-10/F-11 depend on evidence/access. Current TUI-only destruction, ten-backup retention and Claude-only probe remain the behavior until code changes.
