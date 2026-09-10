# Keep non-interactive commands independent of TUI screens

Non-interactive mode exposes stable, domain-oriented commands rather than a
protocol for driving `Action` and `Screen` objects. The TUI and command API are
separate adapters over the same validation and write operations, because the
navigation model, translated presentation text, and callback closures in a
Screen are not a durable scripting contract. Invocation mode is structural:
running ccset without a subcommand keeps the existing TUI behavior, while an
explicit subcommand selects the non-interactive command API; there is no
`--non-interactive` mode flag. Non-interactive commands retain the existing
global `--agent <id>` selector instead of placing an Agent id in the command
path, so common operations share one resource-oriented command tree. The
selector is mandatory for every non-interactive command; installation detection
never chooses a script's write target implicitly.
