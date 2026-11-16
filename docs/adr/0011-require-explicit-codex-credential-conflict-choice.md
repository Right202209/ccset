# Require an explicit Codex credential conflict choice

Accepted intent: unattended switching must not silently discard an unrecognized live login. `--adopt-current-as <new-id>` preserves it for later use; `--replace-current-auth` explicitly discards it from the live location. Both back up the live file and cannot be combined.

**Implementation difference:** the original decision compared live auth with the selected profile. Current code compares it with **all** saved profiles; a recognized live credential needs no conflict choice when switching between them. Unmatched live auth requires a choice. [Issue #56](https://github.com/Right202209/ccset/issues/56) tracks the design difference; [current contract](../milestone-3-non-interactive.md#codex-switching) governs usage.
