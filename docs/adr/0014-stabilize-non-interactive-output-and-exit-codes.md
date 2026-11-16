# Stabilize non-interactive output and exit codes

Accepted intent: localized human lines and additive `schemaVersion: 1` JSON, with one stdout object for ordinary JSON failures. Scripts classify typed errors without parsing translated prose; credential values must be excluded from presentation.

**Implementation difference:** the original `0`–`7` design was not shipped. Current codes are `0`, `1`, `2`, `3`, `4`, `64`, `65`, `66`, defined in `src/core/errors.ts`; the JSON result is top-level, selected by `--json`. [Issue #56](https://github.com/Right202209/ccset/issues/56) tracks design differences. Use [the current contract](../milestone-3-non-interactive.md#output-and-exit-codes), and retain [open projection findings](../../review.md) instead of treating secret-safe intent as complete coverage.
