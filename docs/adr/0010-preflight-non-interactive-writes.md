# Preflight non-interactive writes

A Non-interactive command reads and validates every target before its first
write, so a known parse failure cannot leave a multi-file operation half applied.
Invalid targets fail with exit code 4 unless the caller supplies the narrow
`--replace-invalid` permission, in which case each invalid original is backed up
before an empty-base write; ccset does not provide a general `--force` escape hatch.
