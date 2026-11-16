# Add short commands, data presets, and an explicit session launcher

Accepted. Positional Agent, --agent and CCSET_AGENT share selection: explicit CLI wins over environment, conflicting CLI values fail. Only stdin+stdout TTY commands may infer a sole detected Agent; scripts require explicit selection. This supersedes selector restrictions in ADRs 0006/0016, retaining local read-only discovery.

All-Agent use is structured: Claude validates/prints a session command; others save startup defaults. Explicit Claude run starts an argument array without a shell, inherits I/O and forwards child status. Dry-run never launches; live run --json refuses mixed protocols. This is the narrow exception to the original no-launcher scope.

Presets are bundled reviewed JSON, supplying ordinary provider-set fields without credentials/code. Explicit fields/unsets override defaults; reapplying patches existing Providers. Only terminal human-output, non-dry-run add may prompt for a hidden key. Scripts retain ADR 0009 sources and never prompt. Saving and selection remain separate operations.
