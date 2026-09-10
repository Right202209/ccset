# Contributing to ccset

ccset accepts bug fixes, documentation, tests, and product changes from external
contributors. A pull request may be both the proposal and the implementation; a
preceding issue is optional.

Submitting an implementation does not create an obligation to merge it. The
maintainer may decline a technically correct change because of product scope,
complexity, security risk, or long-term maintenance cost. Final merge and npm
release authority stays with the maintainer unless explicitly delegated.

## Working on a change

Follow the shared workflow in [AGENTS.md](AGENTS.md): inspect the affected code
and decisions, identify the intended behavior, implement through the existing
interfaces, verify the change, and report the evidence. The
[architecture guide](docs/architecture.md) explains the runtime boundaries; the
[verification guide](docs/verification.md) maps change areas to executable checks.

## Pull requests

A product-changing pull request must:

- explain the user problem and the proposed scope change;
- implement the complete user path, without demo-only gaps in the main flow;
- pass the verification checks relevant to the change;
- update English documentation and update Chinese documentation when it covers the
  changed behavior;
- include terminal screenshots for significant TUI changes; and
- describe executable manual verification scenarios.

Implementation proposals are triaged like issues. Draft pull requests are welcome
when the direction is still being demonstrated, but only complete changes are
eligible to merge.

## New agents

A new Agent integration must:

- address a concrete user scenario rather than exist only to demonstrate
  extensibility;
- have a repeatable way to verify its configuration format and behavior;
- reuse the file safety, merging, backup, masking, and error handling in `src/core`,
  or explain why the core must be extended;
- avoid bundling or executing the target Agent;
- avoid materially degrading startup time or interaction for existing users; and
- include executable manual verification scenarios.

An integration that cannot be continuously verified may be marked experimental.
Experimental integrations can be changed, downgraded, or removed. A contributor
delivers the initial implementation and evidence; merging does not create a
permanent support promise or require that contributor to maintain it forever.

Provider-specific product branches are not accepted by default. A capability tied
to one named Provider should enter the core only when it can be expressed as a
general user-facing capability or has strong evidence of broader need.

## Verification

For runtime or tooling changes, start with:

```bash
npm run typecheck
npm run build
```

Run the relevant `verify:*` fixtures and code-quality gate listed in the
[verification guide](docs/verification.md). Shared behavior, dependencies, build,
or test/CI changes also require `npm test`. Fixtures share output directories, so
run them sequentially. The full suite must pass locally or in CI before merging
runtime or tooling changes.

For documentation-only changes, check the diff, links, examples, and factual
claims; typecheck/build are needed only when a changed example or instruction
requires them. Extend the existing assertion fixtures for behavior changes and
bug regressions; no separate test framework is required.

Use [Important Documentation.md](<Important Documentation.md>) for the affected
manual data-safety and interactive scenarios. Platform-specific paths,
permissions, and terminal behavior require evidence on that platform. Report
commands, environments, results, and pending checks; append new runtime evidence
to the register's §9 without rewriting earlier entries. Release requirements are
in §6, separate from the verification needed for an individual change.

## License

By contributing, you agree that your contribution is licensed under this project's
MIT License and confirm that you have the right to submit it. The project does not
require a CLA or DCO sign-off.
