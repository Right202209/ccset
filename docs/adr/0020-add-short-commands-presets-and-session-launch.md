# Add short commands, data presets, and an explicit session launcher

The P0 product review adds `ccset <agent> use <provider>`, `CCSET_AGENT`, and
`add --preset` while retaining `--agent` and the resource-oriented commands.
An explicit CLI selector overrides the environment; conflicting CLI selectors
are refused. Only a terminal with both stdin and stdout attached may infer a
sole locally detected Agent. Scripts without an explicit selector fail with 64
and list detected candidates (or supported IDs when none are detected). This supersedes the selector restrictions in
ADRs 0006 and 0016, while keeping discovery local and read-only.

`use` remains an operation with structured results: Codex, opencode, pi, and
Grok Build save startup defaults; Claude Code validates its Provider file and
prints the session command without changing global configuration. The explicit
Claude Code `run` launcher starts that command with an argument array, without
a shell, and forwards the child exit status. Dry-run never launches a process;
live `run --json` is refused because child output is not a ccset JSON envelope.
The launcher is the narrow exception to the PRD's original no-launcher scope.

Presets are bundled, reviewed JSON data that supply ordinary provider-set
options, never credentials or executable code. Explicit options override preset
defaults; the existing declaration validators and plan/apply core remain the
write boundary. `add` is an explicit application of those defaults, including
to an existing Provider. A terminal-only `add` may ask for a hidden key; scripts
retain ADR 0009's two secret sources and never prompt. Saving does not switch.
