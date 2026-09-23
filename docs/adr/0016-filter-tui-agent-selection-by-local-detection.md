# Filter TUI Agent selection by local detection

Status: accepted

The interactive Agent selector must show only registered Agents whose
filesystem-only `detect(ctx)` check succeeds. The App runs those checks in
parallel at startup, selects the sole positive result automatically, and shows
an explicit empty state, naming `ccset --agent <id>`, when none are positive.
Discovery runs even when only one Agent is registered, so an undetected Agent
is never entered implicitly. A failed detection is treated as unavailable for
that launch rather than as a reason to expose the option.

This decision applies to the TUI selector only. An explicit `--agent <id>`
continues to bypass discovery, so a user can deliberately create a first
configuration. Non-interactive commands continue to require an explicit Agent
and never infer a write target from local detection.

Agent modules remain responsible for their detection criteria. Detection stays
local and lightweight: it reads the Agent's known files or directories and
does not execute or contact the target Agent.
