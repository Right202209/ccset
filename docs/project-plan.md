# Project plan

[简体中文](zh-CN/project-plan.zh-CN.md) | English

Maintainer direction, not a release schedule or command reference. [PRD](../PRD.md) describes implemented scope; [follow-up contracts](product-review-follow-up.md) describe unimplemented work. Source/fixtures outrank dated product-review snapshots.

## Current baseline

Five-Agent use, positional/environment selectors, offline presets and explicit Claude run landed in `ceffd80`; TUI deletion/ignore in `831680d`. Fresh Edit reads and deletion navigation landed in `3fdbce1`/`8e1fe11`. Scoped `0.11.1` publication is recorded on 2026-11-13 in [register §9.78](<../Important Documentation.md#978-v0111-published-forwarder-pinned-to-it-the-route-for-the-unscoped-name-2026-11-13>).

The forwarder source pins that published CLI. The last registry check (2026-11-13) still found unscoped `ccset` unregistered; registration/trusted publishing remain external steps, not a new availability claim. Use `@droite/ccset` until independently verified.

`--dry-run` reports intent/targets, not a redacted line diff. No declarative plan/apply, script delete/backup cleanup, general doctor, or restore command exists. Prior “Phase 0 unreleased” blockers and one-off checkout chores are no longer operational guidance.

## Position

**The provider switcher you can audit** is the direction: local managed edits, public fixtures/decisions, explicit refusals and artifact provenance. It does not imply a line diff already exists or that ccset stores no preferences/profiles. [The user guide](user-guide.md#agent-configuration) lists every owned path and current limitations.

Serve terminal/remote developers and people maintaining Agent files directly. SSH/container/CI demand is a hypothesis to test through recipes and external requests, not an established market measurement. Never compete on Agent/preset count or publish unverified competitor figures.

## Delivery order

| Order | Next reviewable outcome | Gate/evidence |
| --- | --- | --- |
| Safety | Close [current output/concurrency/credential/recovery gaps](../review.md) | Failure reproductions and public-boundary regressions |
| Show changes | Shared redacted diff for dry-run/TUI; concise write/refusal evidence | Define redaction before code; adjacent unmanaged-secret fixture, zero-write preview |
| Script lifecycle | Provider inspection/removal and backup cleanup; opt-in cleanup after rotation | Explicit destructive contract/ADR, dry-run, active-route and partial-failure checks |
| Credential references | Agent-native literal/reference contract and precedence | No secret bytes in supported generated files/backups; unsupported shapes refuse before mutation |
| Independent improvements | Protocol probes, released-command recipes, arbitrary-endpoint guided entry, backup restore design | Scoped contracts and isolated mock/task evidence; live checks separately |
| Gated bets | Declarative input, extra distribution, new Agents, Provider outreach | Gates below; no calendar promise |

Diff context can expose other Providers' keys or custom Authorization headers. Redaction must cover unmanaged neighbors, not just secret-typed managed fields. A successful backup cleanup does not rotate a remote key or erase other copies.

## Gated bets

| Proposal | Start only when |
| --- | --- |
| User-owned declarative input/plan/apply | Redacted diff and credential references released; an external user requests multi-machine/CI setup; ADR establishes input ownership and partial-failure policy |
| Single binary/Homebrew | A user needs installation without Node; supply-chain/update/platform plan exists |
| New Agent, including Gemini CLI | Concrete demand and documented writable custom-endpoint/credential contract; complete integration proposal with repeatable evidence |
| Provider setup-guide outreach | General endpoint entry is released and the recipe is verified; external messages need explicit authorization |
| Native Windows verified claim | A real Windows Terminal/PowerShell core-flow run is recorded, beyond CI smoke |

## Decisions

Maintainer decisions from 2026-11-10, with the 2026-11-13 release/bootstrap update. Change them explicitly; do not infer a new product policy from a historical draft.

| ID | Decision |
| --- | --- |
| D1 | Auditability is current positioning; config-as-code remains gated |
| D2 | No sponsors, affiliate links or paid placement in presets/README; same public-data criteria for every contributor |
| D3 | Reserve unscoped ccset as an exact-dependency forwarder; first registration requires the maintainer, later releases use separate tags/trusted publishing |
| D4 | Script lifecycle and backup cleanup precede credential references; declarative apply stays gated |
| D5 | Keep review conclusions under docs/reviews as dated history; original narratives are available in git, figures require fresh primary-source checks |
| D6 | ADR 0012 stands: CODEX_HOME is reported, not followed; CLI writes refuse mismatch, TUI currently warns |
| D7 | Keep Important Documentation.md at root as a concise guide and editable evidence index; apply Trace → Distill → Prune to summaries, with original evidence pinned in Git ([ADR 0021](adr/0021-keep-the-active-register-concise-and-pin-historical-evidence.md)) |

## Signals and limits

No telemetry. Look for external issues/PRs, tested Provider recipes and requests naming remote/CI needs. Old star/download counts are not a current baseline. Five upstream formats and one maintainer make verified scope more valuable than feature count; [support policy](../SUPPORT.md) governs commitments.

## Historical sources

The [switcher review](reviews/2026-11-10-switcher-review.md) emphasized visible edit/refusal contracts; the [config-as-code review](reviews/2026-11-10-config-as-code-review.md) proposed declarative workflows. Neither was an install trial or demand study. Their repeated roadmaps/copy are distilled here and in follow-up contracts. Actual release evidence stays in [register §9](<../Important Documentation.md#9-implementation-register-code-complete>).
