# Keep non-interactive commands independent of TUI screens

Accepted. An explicit subcommand selects a structured operation API; no subcommand retains TUI behavior. Do not expose Screen/Action callbacks as a scripting protocol: navigation, translated text and closures are unstable contracts. CLI/TUI adapters share validation and plan/apply, while commands never load Ink.

The original mandatory `--agent`-only selector is superseded by [ADR 0020](0020-add-short-commands-presets-and-session-launch.md). Scripts still require explicit selection; terminal commands may infer a sole detected Agent under that ADR's conditions.
