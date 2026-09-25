# Plan: Claude Code Custom Model Mapping

## Goal

Let users map non-Claude model IDs to Claude Code's model slots from ccset's
interactive provider configuration, saving the values to project-level
`.claude/settings.json` without changing global settings.

## Implementation

1. **Resolve the project target.** Add a project directory to the runtime context,
   captured at the CLI boundary, and resolve `<project>/.claude/settings.json`.
   The current Claude Code flows only target `~/.claude/settings.json` and
   `~/.claude/settings.<provider>.json`; do not reuse either path for this write.
2. **Model the mappings.** Declare the five env leaf paths in the Claude Code
   manifest: `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`,
   `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, and
   `CLAUDE_CODE_SUBAGENT_MODEL`. Use free-text fields, preserve IDs such as
   `deepseek-flash[1m]` verbatim, and offer provider model suggestions when
   available. Empty fields remove only their own project-level env key.
3. **Add the TUI flow.** Add a default-off custom-mapping toggle to the provider
   model configuration. When enabled, open a second form for the five slots;
   optionally provide a “copy main model to all slots” action. Warn, without
   blocking, when all known provider model names contain `claude`. Keep the
   existing Claude model selection available when mapping is off.
4. **Save safely.** Re-read the project target at save time and use the existing
   managed-write/commit path. Preserve unrelated settings and env keys, retain
   the malformed-file confirmation and backup behavior, and show the target path
   plus a restart/reload hint after saving.
5. **Ship both locales and focused fixtures.** Add English and Simplified
   Chinese labels, help, warnings, validation, and save messages. Extend Claude
   provider/UI verification for project isolation, each env mapping, blank-field
   removal, sibling preservation, suffix preservation, and the warning state.

## Decisions to settle before implementation

- Confirm project targeting means `<current working directory>/.claude/settings.json`;
  the shared context currently has only a home directory, not a project directory.
- Define whether turning the toggle off removes previously saved project mappings
  or merely hides their editor. Prefer preserving values unless the user chooses
  an explicit clear action.

## Verification scope

Run the Claude provider-safety and UI-render fixtures, plus typecheck/build as
required by `docs/verification.md`. Manually exercise the flow in a scratch
project and verify that no file under the real home is changed.
