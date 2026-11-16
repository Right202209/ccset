# Product contract

ccset is a local CLI/TUI for individual developers configuring third-party APIs in Claude Code, opencode, Codex CLI, pi, and Grok Build.

This document describes the implemented scope. Field declarations in `src/agents/<id>/`, [the command contract](docs/milestone-3-non-interactive.md), and executable fixtures determine exact behavior. [The project plan](docs/project-plan.md) holds future work; [ADRs](docs/adr/) record trade-offs.

## User path

1. Select an Agent, or explicitly name one for first-time configuration.
2. Read current global/Provider settings into an editable review form, or submit a CLI Managed patch.
3. Validate, back up existing targets, and save through shared plan/apply.
4. Select the Provider with `use`; for Claude Code, execute the printed session command or invoke `run`.

Saving a Provider and selecting it are separate operations. Selection does not reconfigure an existing Agent session.

## Implemented scope

| Capability | Availability |
| --- | --- |
| Global settings, Provider add/edit, local Status | All five Agents, TUI and CLI |
| `use <id>` / `provider use <id>` | All five; Claude prints a session command, others save next-start defaults |
| `run <id> -- <arguments>` | Claude Code only; shell-free launch with inherited I/O and child exit status |
| `add [id] --preset <id>`, `presets list [search]` | Bundled public data; Agent support varies by preset |
| Provider delete/ignore/unignore, backup cleanup | Confirmed TUI Actions only |
| State initialization | Claude Code only; creates `~/.claude.json` if absent |
| Test connection | Claude Code TUI only; confirmed destination, no redirects or response-body output |
| Interface language | English and Simplified Chinese; explicit CLI/TUI choice |

No daemon, local proxy, protocol translation, telemetry, account/billing management, generic config payload import, or declarative `plan`/`apply` command is implemented. Model suggestions do not certify availability or live API compatibility.

## Required invariants

- Preserve unmanaged configuration leaves at every depth. TOML/JSONC edits also preserve unrelated comments, order, and formatting.
- TUI blank fields delete per their contract; omitted CLI fields preserve existing values. Explicit Provider deletion removes the whole named file/block.
- Re-read targets at save time and on each form entry. Preflight all command targets before writing. Per-file atomicity does not imply a cross-file transaction or protection against concurrent external writers.
- Existing configuration is backed up before replacement/deletion; POSIX files are created at `0600`. CLI no-ops/dry-runs create no backups or writes; ordinary TUI saves may rewrite unchanged targets.
- Malformed Agent targets require explicit replacement consent. Claude's existing live state remains untouched; Codex live auth is replaced whole only on an explicit switch.
- Keep credentials out of command output and raw error text; mask TUI secret fields. Backups can retain plaintext credentials. [Open safety findings](review.md) delimit the gaps in these requirements.
- Keep Agent policy inside its module; reuse core safety and static registration. Detection never runs an Agent or contacts a Provider. Commands never load Ink.
- Preserve terminal scrollback; long regions fit their Viewport. Both locale catalogs accompany user-facing changes.

## Support and verification

CLI Node floor: ≥18. The website has a separate, newer [Node engine](pages/package.json). macOS/Linux are supported; WSL and Windows Terminal/PowerShell are best effort; `cmd.exe` is unsupported. Windows ACLs are not managed.

Select checks in [verification](docs/verification.md); publishing additionally requires [register §6](<Important Documentation.md#6-build-and-publish>). A synthetic fixture, a CI definition, and a live Provider check are different evidence. Pending upstream assumptions live in [register §1](<Important Documentation.md#1-blocking-unknowns>).
