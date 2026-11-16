# Repository guidelines

Shared instructions for contributors and coding assistants; `CLAUDE.md` points here.

## Workflow

1. Inspect `git status` and the relevant source; preserve unrelated changes. Read a supplied issue/PR and its comments. A preceding issue is optional.
2. Read [CONTEXT.md](CONTEXT.md) and the area guide below. State intended behavior and verification scope; surface conflicts with an ADR.
3. Make the smallest complete change through existing interfaces. Reproduce bugs and extend the affected executable fixture; assert new behavior at its public boundary.
4. Run [scope-selected checks](docs/verification.md), review the diff, and run `git diff --check`. Update covered English/Chinese docs and report actual commands, results, and pending checks.

Current behavior comes from source and executable fixtures. Plans are not implemented features; dated register entries are historical evidence, not instructions.

## Read on demand

| Change | Guide |
| --- | --- |
| Runtime or module boundaries | [Architecture](docs/architecture.md), [PRD](PRD.md), relevant [ADRs](docs/adr/) |
| Commands | [Current command contract](docs/milestone-3-non-interactive.md), [CLI reference](docs/user-guide.md#cli) |
| Provider deletion/ignore | [User guide](docs/user-guide.md#deleting-and-ignoring-providers), [ADR 0019](docs/adr/0019-delete-and-ignore-providers-in-the-interface.md) |
| New Agent | [Integration guide](docs/adding-an-agent.md), [coding-assistant SOP](docs/agents/add-agent-workflow.md), [contribution criteria](CONTRIBUTING.md#new-agents) |
| Tests, CI, releases | [Verification](docs/verification.md), [release gates](<Important Documentation.md#6-build-and-publish>) |
| Website | [pages/README.md](pages/README.md), [ADR 0015](docs/adr/0015-render-the-website-from-the-repository-markdown.md) |
| User-facing behavior | [User guide](docs/user-guide.md), [README](README.md), [Chinese README](README.zh-CN.md) |
| Terms/decisions | [Domain documentation](docs/agents/domain.md) |
| Tracking/review | [Issue workflow](docs/agents/issue-tracker.md), [labels](docs/agents/triage-labels.md), [review rules](docs/agents/code-review.md) |

## Ownership

ESM TypeScript CLI/TUI, with React and Ink.

| Area | Owns |
| --- | --- |
| `src/cli.tsx`, `src/registry.ts` | Process boundary, static Agent registration |
| `src/core/` | File safety, Codecs, merging, masking, settings, shared provider Screens |
| `src/operations/` | Structured request/result contract and shared plan/apply core |
| `src/commands/` | Parsing, selectors, presets, secret input, human/JSON output, session launch |
| `src/agents/<id>/` | Agent paths, defaults, manifests, validation, actions, commands, messages |
| `src/ui/` | Views, navigation, forms, terminal layout/input |
| `src/i18n/`, `src/types.ts`, `src/ctx.ts` | Shell catalogs, shared types/context |
| `scripts/` | Executable verification fixtures and harnesses |
| `pages/` | React/Vite website with its own package and lockfile |
| `packages/ccset/` | Forwarding npm package with an exact published CLI dependency |

Edit sources; `dist/`, `.verify/`, and `pages/dist/` are generated.

## Constraints

- Agents return `ActionResult` data; Views render it. Agent modules never import `src/ui/`. Register imports statically; do not dynamically discover modules.
- Detection is local, read-only, lightweight, and never executes an Agent or contacts a Provider. TUI selection offers detected Agents and enters a sole match. Explicit selection permits first-time configuration. Scripts require a positional selector, `--agent`, or `CCSET_AGENT`; only stdin+stdout TTY commands may infer a sole match (ADR 0020).
- Commands use `executeOperation` and structured requests/results/typed errors. Do not drive Screen callbacks or load Ink in command mode. TUI and CLI share plan/apply.
- Write managed leaves; preserve unmanaged siblings at every depth. TOML/JSONC edits preserve unrelated bytes. Inline TOML tables may expand to dotted assignments. Explicit Provider deletion removes its entire file/block, including custom keys.
- Blank/Unmanaged TUI fields delete according to their field contract. Omitted CLI options preserve disk values; `--unset` removes a named field. `undefined` means deletion; supported boolean `false` remains a value.
- Re-read at save time and seed each form when it opens. A persistent Provider Screen must re-read on every Edit entry. Preflight all command targets before the first write. Atomic replacement is per file; report partial commits and rollback failures.
- Back up existing targets before configuration replacement/deletion; publish private temporary files at POSIX `0600`. Create-only publication must refuse an existing destination. CLI no-ops and dry-runs create neither writes nor backups; ordinary TUI saves may back up unchanged files.
- Replace malformed Agent targets only after TUI confirmation or a supported command's `--replace-invalid`; preserve the original backup. This option never bypasses other preconditions.
- Delete/ignore/unignore are confirmed TUI Actions using `core/provider-actions.ts` and `core/remove.ts`. An absent delete target is a no-op. Shared-block deletion needs a parseable document. Successful deletion clears its ignore note and closes its Screen.
- Ignore notes live in `<home>/.ccset/settings.json`, keyed by Agent under `ignoredProviders`. Normal lists/probes omit ignored Providers but offer reveal/unignore. Settings writers preserve the locale and other Agents' ignore lists.
- `~/.claude.json` is create-only. Codex live `auth.json` is backed up and replaced whole on explicit switching; never merge it. Codex Provider deletion refuses the routed Provider and backs up/removes its Auth profile before its table.
- Mask secret fields in TUI entry/display; omit them from command results/errors. Scripts accept only `CCSET_TOKEN` or explicit `--token-stdin`; terminal preset `add` may use a hidden prompt. Refusals never echo raw arguments. Probes confirm the host, refuse redirects, and discard response bodies.
- Read `CCSET_*` at the CLI boundary and pass values inward. Test writes use scratch homes and placeholder keys. `CCSET_HOME` does not isolate an upstream Agent launched by `run`.
- Ship shell and Agent string changes in both `en` and `zh-Hans`. Agent catalogs belong in `messages.ts`; registry merging rejects duplicate keys. Fixtures resolving Agent keys import the registry first.
- Preserve terminal scrollback and keep the frame at content height. Views receive the main Panel's interior Viewport and use shared terminal/text-fit helpers. Glance reuses read-only status; focused Previews reuse list records, show secret presence only, and show valid URL origins without paths/queries/fragments.

## Style and verification

Two spaces, no semicolons, single quotes, `.js` relative TypeScript imports; `camelCase` variables/functions, `PascalCase` components/types, kebab-case Agent IDs. Narrow indexed values under strict `noUncheckedIndexedAccess`. Constants stay with their owner.

`verify:code-gates` checks `src/`, `scripts/`, and `pages/`: files ≤ 300 lines, functions ≤ 50 non-blank lines, complexity ≤ 10. Manually check nesting ≤ 3 and positional parameters ≤ 3. Remove fixed baseline entries; never add exceptions for new violations.

- CLI: Node ≥18, root `npm ci`. `verify:*` fixtures are the test suite; there is no root lint command or unit-test framework. Run fixtures sequentially: they share/clean `.verify/` and several rebuild `dist/`. Full PTY checks need Linux/macOS and `python3`.
- Website: use the exact Node engine in [pages/package.json](pages/package.json). From `pages/`: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke`. Visible UI changes need desktop/mobile checks and PR screenshots.
- Documentation only: check links, anchors, examples, and source-backed claims; `git diff --check`. Execute changed instructions when needed. The website imports repository Markdown: do not duplicate it under `pages/`. New viewer documents need registry entries and both catalog labels.
- Chinese docs use `docs/zh-CN/<name>.zh-CN.md`; `README.zh-CN.md` stays at root.
- Append new runtime evidence to [register §9](<Important Documentation.md#9-implementation-register-code-complete>); keep prior entries unchanged. Routine documentation checks belong in the handoff/PR.
- Use concise conventional commit subjects and the [PR template](.github/PULL_REQUEST_TEMPLATE.md). Significant TUI changes need terminal screenshots. Release authority and requirements follow [CONTRIBUTING.md](CONTRIBUTING.md) and register §6.
