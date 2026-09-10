# Repository guidelines

Shared instructions for contributors and coding assistants. Start here; read the
linked guides when the change reaches their area. `CLAUDE.md` points here too.

## Workflow for a change

1. Inspect `git status` and the relevant code before editing. Preserve unrelated
   local changes. Read the issue or PR and its comments when one is supplied;
   a preceding issue is optional ([CONTRIBUTING.md](CONTRIBUTING.md)).
2. Read [CONTEXT.md](CONTEXT.md) for domain terms, then the relevant specification
   and [ADRs](docs/adr/). State the intended behavior and verification scope.
   Surface conflicts with an accepted decision instead of silently changing it.
3. Make the smallest complete change through the existing interfaces. For a bug,
   reproduce the failure and extend the relevant executable fixture to catch it.
   For new behavior, add focused assertions at the affected public boundary.
4. Run the checks selected by [docs/verification.md](docs/verification.md).
   Review the final diff and run `git diff --check`. Update the affected docs and
   report the actual commands, results, and any checks still pending. Record new
   runtime evidence in `Important Documentation.md` §9, which is append-only.

## Where to work

This is an ESM TypeScript CLI/TUI built with Ink and React.

| Area | Responsibility |
| --- | --- |
| `src/core/` | Agent-independent file I/O, validation, merging, masking, backups, paths, and errors |
| `src/operations/` | Normalized operation requests/results and the shared plan/apply commit core |
| `src/commands/` | CLI parsing, secret sources, human and JSON presentation |
| `src/agents/<id>/` | Each Agent's paths, constants, manifests, actions, commands, and messages |
| `src/ui/` | Ink Views, navigation, forms, lists, and terminal behavior |
| `src/i18n/` | Shell catalogs (`en`, `zh-Hans`) and translation helpers |
| `src/types.ts`, `src/ctx.ts` | Shared interfaces and runtime context |
| `src/cli.tsx`, `src/registry.ts` | Process boundary and static Agent registration |
| `scripts/` | Executable verification fixtures and their harnesses |

`dist/` and `.verify/` are generated output; edit their sources instead.

Read these guides for the corresponding work:

| Change | Read |
| --- | --- |
| Runtime behavior or module boundaries | [Architecture](docs/architecture.md), [PRD.md](PRD.md), relevant ADRs |
| Non-interactive commands | [Command specification](docs/milestone-3-non-interactive.md), [implemented CLI behavior](docs/user-guide.md#cli) |
| New Agent | [Adding an Agent](docs/adding-an-agent.md), [contribution requirements](CONTRIBUTING.md#new-agents) |
| Tests, build, CI, or release evidence | [Verification guide](docs/verification.md), [verification register](<Important Documentation.md>) |
| User-facing behavior | [User guide](docs/user-guide.md), [README.md](README.md), [README.zh-CN.md](README.zh-CN.md) |
| Terms or design decisions | [Domain documentation guide](docs/agents/domain.md) |
| Issue or PR tracking | [Issue tracker](docs/agents/issue-tracker.md), [triage labels](docs/agents/triage-labels.md) |

## Boundaries and guarantees

- Keep Agent-specific paths, defaults, validation rules, and strings inside its
  module. An Agent produces `ActionResult` data; Ink Views render it. New Agents
  reuse the shared core and register in `src/registry.ts`.
- Non-interactive commands use `executeOperation` with structured requests,
  results, and typed errors. Keep Screens and translated text out of that
  contract; command mode must not load Ink. Both surfaces share the commit core.
- Preserve unmanaged keys at every nesting level. Write managed leaves rather
  than replacing parent objects. TOML and JSONC edits preserve unrelated text,
  comments, and formatting.
- Keep deletion semantics explicit: blank TUI fields omit their managed keys;
  omitted command options preserve disk values and `--unset` requests removal.
  A supported boolean `false` remains a boolean, not a deletion.
- Re-read targets at save time. Preflight all command targets before the first
  write. Back up originals and use atomic writes with `0600` on POSIX.
  Non-interactive no-ops and dry-runs must not write or create backups.
- A malformed target requires a TUI confirmation or the command's explicit
  `--replace-invalid` choice. Preserve the malformed original in a backup when
  replacing it.
- `~/.claude.json` is create-only. Codex's live `auth.json` is backed up and
  replaced as a whole on an explicit switch; never merge into it.
- Mask secrets in entry, Status, review, errors, and command output. Commands
  accept secrets only through `CCSET_TOKEN` or explicit `--token-stdin`.
  Test connection requires confirmation naming the destination host and never
  prints the response body.
- Read `CCSET_*` overrides at the CLI boundary and pass them inward. Use a scratch
  `CCSET_HOME` for manual runs and fixtures; never test writes in a real Agent home.
- Ship user-facing string changes in both `en` and `zh-Hans`. Agent strings live
  in the Agent's `messages.ts`; the registry merges them and rejects duplicates.

## Style and quality

Use two spaces, no semicolons, single quotes, and `.js` extensions in relative
TypeScript imports. Use `camelCase` for variables/functions, `PascalCase` for
components/types, and lowercase kebab-case Agent directory IDs. TypeScript is
strict with `noUncheckedIndexedAccess`; narrow indexed values before use.

The executable quality gate checks TypeScript under `src/` and `scripts/`:
files ≤ 300 lines, functions ≤ 50 non-blank lines, complexity ≤ 10. Existing
violations are tracked in `scripts/verify-code-gates.ts`; remove entries when
fixed and do not add exceptions to hide new violations. Review nesting ≤ 3 and
positional parameters ≤ 3 manually. Keep constants with the module that owns
them; only shared constants belong in `src/core/constants.ts`.

## Verification and handoff

Use Node.js 18+ and `npm ci` for a locked install. There is no separate lint or
unit-test framework; the `verify:*` fixtures are the test suite. Use them for
regressions now. The [verification guide](docs/verification.md) maps changes to
checks and distinguishes documentation-only work from runtime changes.

Run fixtures sequentially: they share and clean `.verify/`, and several rebuild
`dist/`. `npm test` runs the complete fixture suite in sequence. CI definitions in
[ci.yml](.github/workflows/ci.yml) describe the platform matrix; local success is
not evidence for another platform or for a live Provider request.

Use concise conventional commit subjects (`feat:`, `fix:`, `docs:`, `test:`).
PRs explain the resulting behavior, link a relevant issue or design note when
available, and list verification evidence. Include terminal screenshots for
significant TUI changes. Follow the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
and the release requirements in `Important Documentation.md` §6.
