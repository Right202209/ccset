# Contributing to ccset

[简体中文](docs/zh-CN/CONTRIBUTING.zh-CN.md) | English

Bug fixes, docs, tests, and complete product proposals are welcome. A PR may be the proposal and implementation; a preceding issue is optional. Submission does not oblige acceptance: the maintainer decides scope, merge, and npm release unless explicitly delegated.

## Working on a change

Follow [AGENTS.md](AGENTS.md) and [scope-selected verification](docs/verification.md). Website work uses [its separate SOP](pages/README.md).

## Pull requests

Use [the template](.github/PULL_REQUEST_TEMPLATE.md). Explain the user problem, resulting complete path, scope/maintenance cost, actual checks and pending evidence. Update covered English/Chinese docs. Significant TUI or visible website changes need terminal or desktop/mobile screenshots respectively; behavior changes need repeatable manual scenarios.

[Review rules](docs/agents/code-review.md) grade data-loss and credential risks; unresolved Blocker/High findings stop merging. Draft proposals are welcome; only complete verified changes can merge.

## New agents

An integration must serve a concrete user scenario, have repeatable format/behavior checks, reuse core safety, and preserve startup/interaction quality. Do not bundle the target Agent or execute it for detection/configuration. Explicit session launch is a separate capability.

Ship the module, registry entry, fixtures, bilingual documentation, and executable manual scenarios; see [integration mechanics](docs/adding-an-agent.md). State any shared-core extension and its regression scope. Limited continuing evidence may justify an experimental label; merging creates neither permanent support nor a lifetime maintenance obligation for the contributor.

Provider-specific runtime branches require a general capability or strong evidence of broader need. Presets are public data, subject to [neutral contribution rules](presets/README.md).

## Verification

Use [the guide](docs/verification.md), not a copied command checklist. Runtime/tooling changes need full-suite evidence locally or in CI before merge; run fixtures sequentially. Regressions must fail without the fix. Platform-specific changes need evidence on that platform.

Maintain concise runtime summaries in [register §9](<Important Documentation.md#9-implementation-register-code-complete>) through [Trace → Distill → Prune](AGENTS.md#knowledge-base-self-evolution-specification-tdp-loop). Link detailed results, update superseded summaries and keep original evidence in Git/PR/CI. Documentation-only checks belong in the handoff/PR; release gates remain in §6.

## License

Contributions use the project's MIT License; confirm you have the right to submit them. No CLA or DCO sign-off is required.
