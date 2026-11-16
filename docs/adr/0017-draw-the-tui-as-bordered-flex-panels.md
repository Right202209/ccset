# Draw the TUI as bordered flex panels inside the flowing output

Accepted. A content-height frame carries branding/key help; the main Panel carries navigation path and Screen tone. Wide terminals may show side Panels, while message Screens retain full width for copyable paths/commands. Glyphs come from terminal capability, including ASCII.

[ADR 0002](0002-flow-scrolling-tui-with-windowed-regions.md) still forbids filling terminal height or clearing scrollback. Compute chrome once and give Views the main Panel interior Viewport; omit chrome below 7 rows/30 columns. Wrapped help is budgeted when height permits.

Narrowing rewraps old paint beyond Ink's recorded erase height, so clear the visible screen before repainting, preserving scrollback. Shared width-fitting provides ASCII ellipsis instead of Ink's forced Unicode truncation. Layout/side-info fixtures pin these consequences.
