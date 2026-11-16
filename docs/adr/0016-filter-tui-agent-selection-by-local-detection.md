# Filter TUI Agent selection by local detection

Accepted. Check each registered Agent's lightweight local `detect(ctx)` at startup; display only positives, enter a sole match, and show an explicit-selection hint when empty. Failed detection means unavailable for that launch, not an exposed option. Never execute an Agent or contact a Provider to detect it.

Explicit selection bypasses discovery for first-time configuration. [ADR 0020](0020-add-short-commands-presets-and-session-launch.md) supersedes the original command-selector restriction: scripts remain explicit; stdin+stdout TTY commands may infer a sole match.
