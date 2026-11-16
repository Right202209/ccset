# Delete and ignore providers in the interface, not the command tree

Accepted. Delete/ignore/unignore are confirmed TUI Actions. Script destruction remains outside [ADR 0007](0007-limit-m3-non-interactive-capabilities.md) until it has explicit safety contracts.

Delete removes the whole named Provider, including custom keys. Claude's separate file can be removed even when malformed; a shared block requires a parseable document and preserves siblings/unrelated TOML/JSONC text. Back up before removal; absent targets are no-ops. Codex refuses the routed Provider and removes its saved profile before its table, favoring a missing credential over an orphan live key.

Ignore is ccset-owned preference under `<home>/.ccset/settings.json` → ignoredProviders → Agent ID, never Agent configuration. Lists/probes omit ignored entries but offer reveal/unignore. Deletion clears the note to avoid hiding later name reuse and closes its Provider Screen.

Known schema version 1 fields are re-read: locale and every Agent's ignored list survive either writer. **Implementation correction:** the earlier “carry other keys over” statement did not mean arbitrary unknown-key retention; current settings parsing projects known fields only. Failure clearing the note after deletion can omit the completed removal report; see [open follow-up](../../review.md).
