# Changelog

Release behavior and condensed design history. [Releases](https://github.com/Right202209/ccset/releases)
hold complete release notes; the [verification register](<Important Documentation.md#9-implementation-register-code-complete>)
links original commands, environments, results and limitations from its concise evidence index and fixed Git archive.

## Unreleased

- Consolidate current documentation by subject; replace superseded plans and
  review narratives with summaries and immutable source links.
- Align scope, command reference, installation, and contributor instructions
  with 0.11.1. Preserve accepted decisions, unresolved audit leads, translations,
  existing document paths and original verification evidence in Git. Active rules
  and evidence summaries now follow Trace → Distill → Prune.

## 0.11.1 — 2026-11-13

- Claude Code's retained Provider Screen now reads the file whenever Edit opens.
  A second edit in 0.11.0 could restore pre-save values, including a rotated key.
  If affected, inspect `settings.<id>.json`; the newer key may be in its newest
  backup, taken before the stale save.
- Delete closes the Provider Screen and clears its ignore note, preventing
  accidental recreation and hiding a later Provider with the same ID.
- Codex credential-error message titles resolve the Provider ID.

Write behavior: forms seed from fresh reads; deletion also updates ccset settings.
Non-interactive commands are unchanged. [Release and CI evidence](https://github.com/Right202209/ccset/releases/tag/v0.11.1)
and register §9.77–9.78 cover the fixes and publication with provenance.

## 0.11.0 — 2026-11-13

- Positional Agent selectors and `CCSET_AGENT`; offline OpenRouter/DeepSeek presets
  with nine Agent entries; preset `add` with hidden terminal key input.
- `use` for all five Agents; Claude Code `run` launches without a shell and
  forwards exit status. Dry-run never launches.
- TUI Provider Screens with Edit, Ignore, and confirmed Delete.

Write behavior: preset defaults are explicit patches; Codex `use --model`
commits routing/model together and restores both after failed credential activation.
Delete backs up the whole Claude file or the shared-document Provider block;
Codex removes the saved Auth profile first and refuses deletion of its routed
Provider. Ignore changes only ccset settings. The retained-screen and ignore-note
regressions in this release are fixed in 0.11.1.

[Release](https://github.com/Right202209/ccset/releases/tag/v0.11.0);
register §9.71, §9.73–9.76. Main tags are `v<version>`; the separate, still-unpublished
forwarder uses `ccset-v<version>` and pins the published main version.

## 0.10.0 — 2026-10-05

- Five-Agent CLI/TUI, local Agent discovery, bordered panels, status Glance,
  focused-row Preview, mouse selection, and return to Agent selection.
- Safety work on credential/routing recovery, create-only publication, parsing,
  file preservation, and failed-save handling; refreshed bilingual docs/site.

The [release notes](https://github.com/Right202209/ccset/releases/tag/v0.10.0)
record a rejected initial npm upload and fixture/CI follow-ups (§9.67–9.70).
The package was subsequently available from npm, as recorded in the November
snapshot. Publication does not establish closure of every earlier audit finding.

For these releases, CI exercised Linux/macOS fixtures and Windows boundary/package
checks on Node 18/20/22. Recorded local smokes used Linux/WSL2 and placeholder
credentials. Native macOS/Windows manual sessions and live Provider compatibility
were not established by that evidence.

## Design history

| Original | Retained decision or current owner |
| --- | --- |
| [Original PRD](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/PRD.md) | Claude-first generator, staged Agent/Codec seams, then non-interactive execution. Current scope: [PRD.md](PRD.md); terminology: [CONTEXT.md](CONTEXT.md); durable trade-offs: [ADRs](docs/adr/). |
| [Original M3 plan](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/docs/milestone-3-non-interactive.md) | Structured operations, patch semantics, secret sources, preflight, credential conflicts, JSON/exit contract. [Current contract](docs/milestone-3-non-interactive.md) retains implementation differences; ADR 0020 supersedes selector/launcher/prompt restrictions only. |
| [November plan](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/docs/project-plan.md), [follow-up contracts](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/docs/product-review-follow-up.md) | Superseded Phase 0 status and metrics; D1–D7 and F-05–F-13 now have one owner: [project plan](docs/project-plan.md). |
| [Original register requirements and machine incident](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/Important%20Documentation.md#8-incidental-finding-from-the-design-review) | §1–8 distill lessons and link their durable owners; §9 is an editable evidence index with a fixed Git archive (ADR 0021). Workstation recovery chores were removed from active guidance. |

## Review history

Reports are snapshots, not current specifications. Their IDs are local to each
report; equal IDs in different reports identify different findings. Competitor
figures and market assumptions are historical, unverified inputs.

| Snapshot | Retained consequence |
| --- | --- |
| [September remediation](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/Remediation-Guide.md) | Register §9.53 records closure of its 24 findings; §9.54–9.56 amend that work. [Remediation pointer](Remediation-Guide.md). |
| [Undated runtime audit](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/review.md) | Credential diagnostics, concurrent writes/backups, and Codex identity/recovery leads remain in the [findings ledger](review.md); closure needs a matching regression and later evidence. |
| [2026-10-01 resilience audit](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/docs/reviews/2026-10-01-resilience-audit.md) | Two Blockers/seven Highs at `8680074`; §9.63 records no fixes at audit time. [Retained ledger](docs/reviews/2026-10-01-resilience-audit.md). |
| [Switcher review](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/docs/reviews/2026-11-10-switcher-review.md), [positioning](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/docs/reviews/2026-11-10-switcher-positioning.md), [roadmap](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/docs/reviews/2026-11-10-switcher-roadmap.md), [README draft](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/docs/reviews/2026-11-10-switcher-readme-draft.md) | Narrow switcher, auditable writes, released commands before claims; draft activation/preset assumptions were superseded. D1/D2 and lifecycle priorities are in the plan. |
| [Config-as-code review](https://github.com/Right202209/ccset/blob/03a506330d031e72e844e964ba5297d58d9c4dad/docs/reviews/2026-11-10-config-as-code-review.md) | Declarative apply is gated by released redacted diff, credential references, and external multi-machine/CI demand. It is not current behavior. |

All archive links above pin the pre-consolidation repository revision
`03a506330d031e72e844e964ba5297d58d9c4dad`; Git retains the full originals.
