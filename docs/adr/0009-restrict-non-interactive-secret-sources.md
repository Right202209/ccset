# Restrict non-interactive secret sources

Accepted. Scripts accept a Provider secret only from `CCSET_TOKEN` or explicit `--token-stdin`; both together fail, and stdin is never consumed implicitly. No secret argv, positional or file-source option exists. Omission preserves an existing secret; creation requirements are Agent-owned, so an optional-key Grok override need not supply one.

[ADR 0020](0020-add-short-commands-presets-and-session-launch.md) permits hidden input only for terminal human-output preset add, without dry-run. The [command contract](../milestone-3-non-interactive.md#presets-and-secrets) owns input limits and normalization.
