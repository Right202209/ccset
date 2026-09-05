# Repository Guidelines

## Project Structure & Module Organization

This is an ESM TypeScript CLI/TUI built with Ink and React. Runtime code lives
under `src/`:

- `src/core/` contains agent-independent file I/O, validation, merging,
  masking, backups, paths, and error handling.
- `src/operations/` defines the Non-interactive operation seam: a normalized
  request in, a structured result or typed error out, over the shared
  plan/apply commit core.
- `src/commands/` is the CLI adapter for that seam: the pure parser, the
  secret sources, and the human/JSON presenters.
- `src/agents/<id>/` contains integrations for a supported coding agent
  (`claude-code`, `opencode`, and `codex`), including that agent's own paths,
  constants, and user-facing strings.
- `src/ui/` contains Ink screens and reusable form/list components.
- `src/i18n/` contains the shell's message catalogs (`en`, `zh-Hans`) and the
  translation helper. Agent-specific strings live with the agent and are merged
  by the registry.
- `src/cli.tsx` is the CLI entry point; `src/registry.ts` is the static agent
  registry; `src/types.ts` defines shared interfaces.

`README.md` documents user behavior, while `Important Documentation.md` is the
manual verification register. Build output is generated in `dist/` and should
not be edited by hand.

## Build, Test, and Development Commands

Run `npm install` to install dependencies (Node.js 18+ is required). Use
`npm run typecheck` for a no-emit TypeScript check and `npm run build` to bundle
the executable to `dist/cli.js` with tsup. There is no unit-test framework; the
suite is twenty-one executable `npm run verify:*` fixtures in `scripts/`, listed with
what each covers in `CLAUDE.md`. Run the ones your change touches, and verify
remaining interactive scenarios manually against `Important Documentation.md`.

## Coding Style & Naming Conventions

Follow the existing TypeScript style: two-space indentation, no semicolons, and
single-quoted strings. Use `camelCase` for variables/functions, `PascalCase`
for React components and types, and lowercase kebab-case IDs for agent
directories (for example, `src/agents/claude-code`). Keep shared behavior in
`src/core` and prefer existing interfaces and helpers over duplicated logic.

## Testing Guidelines

There is no configured test framework or coverage threshold yet. New behavior
should include focused tests when a framework is introduced; until then,
exercise the relevant TUI flow and filesystem edge cases manually, including
invalid JSON, unmanaged keys, backups, and non-TTY execution.

## Commit & Pull Request Guidelines

Use concise conventional-style subjects such as `feat:`, `fix:`, or `docs:`
followed by an imperative description. Keep commits focused. Pull requests
should explain the user-visible change, list verification commands and manual
scenarios, link the relevant issue or design note, and include terminal output
or screenshots when changing the TUI.

## Adding an Agent

Implement `detect()`, `getActions()` and `messages` in `src/agents/<id>/`,
conforming to the `Agent` interface in `src/types.ts`, then add the module to the
array in `src/registry.ts`. Those are the only two files you should need to
touch; if you need a third, see the guide before working around it.

Keep agent-specific paths, constants, strings and codecs inside that module;
reuse the generic core for merges, atomic writes, masking, and backups. Ship a
verification fixture, and mutate your own code to confirm the fixture fails.

Full walkthrough: [`docs/adding-an-agent.md`](docs/adding-an-agent.md).

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues using the `gh` CLI. See
`docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context domain documentation layout. See
`docs/agents/domain.md`.
