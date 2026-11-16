# Read the status operation for TUI side panels

Accepted. Glance uses `executeOperation(status)` on Agent selection and after a message, discarding stale refreshes. Views must not duplicate Agent paths/parsing. Optional keyed presentation is TUI-only; CLI results remain structured.

Focused Preview reuses the loaded row, clears on loss of focus/unmount, shows credential presence only and valid URL origins without paths/queries/fragments. This projection is deliberately narrower than arbitrary stored metadata; [Status DTO gaps](../../review.md) still need correction and do not relax the rule.

Side column: ≥100 columns/16 rows; detail strip: 80–99 columns/≥20 rows; otherwise no extras. Pay budgets before painting, preserve content-height/scrollback, and keep errors ahead of warnings when trimming. Both locale catalogs and `verify:side-info`/layout fixtures accompany changes.
