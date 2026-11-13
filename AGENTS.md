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
   runtime evidence in `Important Documentation.md` §9, which is append-only;
   routine documentation checks belong in the handoff or PR description.

## Where to work

This is an ESM TypeScript CLI/TUI built with Ink and React.

| Area | Responsibility |
| --- | --- |
| `src/core/` | Agent-independent file I/O, Codecs, validation, merging, masking, backups, paths, settings, errors, and shared provider Screens |
| `src/operations/` | Normalized operation requests/results and the shared plan/apply commit core |
| `src/commands/` | CLI parsing, secret sources, human and JSON presentation |
| `src/agents/<id>/` | Each Agent's paths, constants, manifests, actions, commands, and messages |
| `src/ui/` | Ink Views, navigation, forms, lists, and terminal behavior |
| `src/i18n/` | Shell catalogs (`en`, `zh-Hans`) and translation helpers |
| `src/types.ts`, `src/ctx.ts` | Shared interfaces and runtime context |
| `src/cli.tsx`, `src/registry.ts` | Process boundary and static Agent registration |
| `scripts/` | Executable verification fixtures and their harnesses |
| `pages/` | React/Vite website; separate package, lockfile, Node requirements, and checks |
| `packages/ccset/` | Unscoped forwarding npm package; pins a published `@droite/ccset` and is released by its own `ccset-v<version>` tag |

`dist/`, `.verify/`, and `pages/dist/` are generated output; edit their sources
instead.

Read these guides for the corresponding work:

| Change | Read |
| --- | --- |
| Runtime behavior or module boundaries | [Architecture](docs/architecture.md), [PRD.md](PRD.md), relevant ADRs |
| Non-interactive commands | [Command specification](docs/milestone-3-non-interactive.md), [implemented CLI behavior](docs/user-guide.md#cli) |
| Provider deletion or ignored providers | [User guide](docs/user-guide.md#deleting-and-ignoring-providers), [ADR 0019](docs/adr/0019-delete-and-ignore-providers-in-the-interface.md) |
| New Agent | [Coding-assistant workflow (中文)](docs/agents/add-agent-workflow.md), [Adding an Agent](docs/adding-an-agent.md), [contribution requirements](CONTRIBUTING.md#new-agents) |
| Tests, build, CI, or release evidence | [Verification guide](docs/verification.md), [verification register](<Important Documentation.md>) |
| Website (`pages/`) | [Site dev guide](pages/README.md), [ADR 0015](docs/adr/0015-render-the-website-from-the-repository-markdown.md), [verification guide](docs/verification.md) |
| User-facing behavior | [User guide](docs/user-guide.md), [README.md](README.md), [README.zh-CN.md](README.zh-CN.md) |
| Terms or design decisions | [Domain documentation guide](docs/agents/domain.md) |
| Issue or PR tracking | [Issue tracker](docs/agents/issue-tracker.md), [triage labels](docs/agents/triage-labels.md) |
| Reviewing a change, PR, or the whole repository | [Code review rules](docs/agents/code-review.md) |

## Boundaries and guarantees

- Keep Agent-specific paths, defaults, validation rules, and strings inside its
  module. An Agent produces `ActionResult` data; Ink Views render it. New Agents
  reuse the shared core and register statically in `src/registry.ts`; Agent
  modules do not import from `src/ui/`.
- Agent detection is local, read-only, and lightweight; never execute the Agent
  or contact a Provider to detect it. The TUI offers only detected Agents and
  selects a sole match automatically. Explicit `--agent` bypasses discovery for
  first-time configuration. Scripts require an explicit Agent via a positional
  selector, `--agent`, or `CCSET_AGENT`; only a TTY may infer a sole local match
  for commands (ADR 0020).
- Non-interactive commands use `executeOperation` with structured requests,
  results, and typed errors. Keep Screens and translated text out of that
  contract; command mode must not load Ink. Both surfaces share the commit core.
- Preserve unmanaged keys at every nesting level during configuration edits.
  Write managed leaves rather than replacing parent objects. TOML and JSONC
  edits preserve unrelated text, comments, and formatting; a managed leaf inside
  a TOML inline table may expand that table to dotted assignments while
  preserving its siblings. Explicit Provider deletion removes its whole file or
  block, including that Provider's unmanaged keys.
- Keep deletion semantics explicit: blank TUI fields omit their managed keys,
  including leaves inside inline tables; omitted command options preserve disk
  values and `--unset` removes the named leaf while preserving its siblings. A
  supported boolean `false` remains a boolean, not a deletion.
- Re-read targets at save time. Preflight all command targets before the first
  write. Back up originals and use atomic writes with `0600` on POSIX.
  Non-interactive no-ops and dry-runs must not write or create backups.
- Seed a form from a read made when it opens. A Screen that stays open across
  a save, such as a Provider's own Screen, must not hand its form a record
  loaded earlier: every managed field would be written back as it was.
- Replacing a malformed target requires a TUI confirmation or the command's
  explicit `--replace-invalid` choice. Preserve the malformed original in a
  backup when replacing it.
- Provider deletion and ignore changes are confirmed TUI Actions (ADR 0019).
  Reuse `src/core/provider-actions.ts` and `src/core/remove.ts`. Back up before
  deleting; an absent target is a no-op. Whole-file deletion can remove a
  malformed Claude Code Provider, while deleting a block requires a parseable
  shared document and preserves sibling Providers, comments, and formatting.
  A delete also clears the Provider's ignore note and closes its Screen.
- Ignored providers live under `ignoredProviders` in
  `<home>/.ccset/settings.json`, keyed by Agent id. Exclude them from normal
  provider lists and Test-connection targets; the list must offer a way to reveal
  them and stop ignoring them. Settings writers re-read and preserve both the
  locale preference and other Agents' ignored providers.
- `~/.claude.json` is create-only. Codex's live `auth.json` is backed up and
  replaced as a whole on an explicit switch; never merge into it. Codex Provider
  deletion refuses the currently routed Provider and backs up and deletes its
  saved Auth profile before removing the table. Backups can retain credentials.
- Mask secrets in entry, Status, review, errors, and command output. Scripts
  accept secrets only through `CCSET_TOKEN` or explicit `--token-stdin`; terminal
  `add --preset` may ask for hidden input (ADR 0020). Usage
  errors never echo raw values. Test connection requires confirmation naming
  the destination host, refuses redirects rather than contacting an unconfirmed
  host, and never prints the response body.
- Read `CCSET_*` overrides at the CLI boundary and pass them inward. Use a scratch
  `CCSET_HOME` for manual runs and fixtures; never test writes in a real Agent home.
- Ship user-facing string changes in both `en` and `zh-Hans`. Agent strings live
  in the Agent's `messages.ts`; the registry merges them and rejects duplicates.
  Fixtures resolving Agent message keys must import the registry first.
- Keep the TUI frame as tall as its content and preserve terminal scrollback.
  Views use the main Panel's interior Viewport and the shared terminal/text-fit
  helpers. Side-panel Glance data comes from the read-only status operation;
  focused Previews reuse loaded list records. Credential Previews show presence
  only, and base-URL Previews show only a valid origin, omitting paths, queries,
  and fragments.

Update English docs and the corresponding Chinese docs when they cover changed
behavior. Chinese translations live under `docs/zh-CN/` as `<name>.zh-CN.md`;
`README.zh-CN.md` stays at the root. The website renders repository Markdown:
edit those sources and register new viewer documents in
`pages/src/content/registry.ts` with labels in both site catalogs.

## Style and quality

Use two spaces, no semicolons, single quotes, and `.js` extensions in relative
TypeScript imports. Use `camelCase` for variables/functions, `PascalCase` for
components/types, and lowercase kebab-case Agent directory IDs. TypeScript is
strict with `noUncheckedIndexedAccess`; narrow indexed values before use.

The executable quality gate checks TypeScript under `src/`, `scripts/`, and
`pages/`: files ≤ 300 lines, functions ≤ 50 non-blank lines, complexity ≤ 10.
Existing violations are tracked in `scripts/verify-code-gates.ts`; remove
entries when fixed and do not add exceptions to hide new violations. Review
nesting ≤ 3 and positional parameters ≤ 3 manually. Keep constants with the
module that owns them; only shared constants belong in `src/core/constants.ts`.

## Verification and handoff

Use Node.js 18+ and root `npm ci` for the CLI's locked install. The CLI has no
separate lint command or unit-test framework; its `verify:*` fixtures are the
test suite. The [verification guide](docs/verification.md) maps changes to checks.
For documentation-only changes, check links, anchors, examples, and claims and
run `git diff --check`; run runtime checks when changed instructions need execution.

The website uses its own lockfile and the Node engine range in
[pages/package.json](pages/package.json). Run `npm ci`, `npm run typecheck`,
`npm test` (Vitest with coverage), `npm run build`, and `npm run smoke` from
`pages/`. Visible website changes also need desktop and mobile checks and PR
screenshots; see [pages/README.md](pages/README.md).

Run fixtures sequentially: they share and clean `.verify/`, and several rebuild
`dist/`. Root `npm test` runs the complete fixture suite in sequence; the POSIX
PTY fixtures require Linux or macOS and `python3`. CI definitions in
[ci.yml](.github/workflows/ci.yml) describe the platform matrix; local success is
not evidence for another platform or for a live Provider request.

Use concise conventional commit subjects (`feat:`, `fix:`, `docs:`, `test:`).
PRs explain the resulting behavior, link a relevant issue or design note when
available, and list verification evidence. Include terminal screenshots for
significant TUI changes. Follow the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
and the release requirements in `Important Documentation.md` §6.
