# Fail non-interactive writes on a Codex home mismatch

The TUI may report a `CODEX_HOME` mismatch as a warning, but every mutating
Non-interactive command fails before writing when Codex would read a different
directory from the one ccset targets. ccset continues not to follow the variable;
an unattended success report must identify the directory Codex will actually use.
