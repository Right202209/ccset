# Preflight non-interactive writes

Accepted. Read, overlay, validate and render all ordinary command targets before the first write so a known later parse failure cannot cause a partial application. Rendered output must pass its strict checker too.

Invalid Agent targets fail with 4 unless that command supports explicit `--replace-invalid`; authorized replacement preserves the malformed original in a backup. This is not a general force flag or bypass for environment/credential preconditions. Later I/O failure may still leave partial commits; [the contract](../milestone-3-non-interactive.md) specifies reporting and supported recovery flags.
