# Limit non-interactive capabilities to explicit local operations

Accepted, extended by [ADR 0020](0020-add-short-commands-presets-and-session-launch.md). Commands cover status, managed global/Provider writes, create-only Claude state, all-Agent use, presets and explicit Claude run. This does not promise TUI parity.

Provider deletion/ignore, Auth-profile removal, backup cleanup and credential-bearing probes remain TUI-only until separately specified script safety contracts exist. A proposed destructive command is not authorized by the ordinary set/use contract.
