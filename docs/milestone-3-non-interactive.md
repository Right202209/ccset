# Command contract

[简体中文](zh-CN/milestone-3-non-interactive.zh-CN.md) | English

Current implementation, including ADR 0020. The historical M3 plan is in git history; [issue #56](https://github.com/Right202209/ccset/issues/56) tracks its remaining design differences. This reference uses the shipped parser, output shape, and exit codes; it does not authorize changing runtime behavior to match the old plan.

Sources: [parser](../src/commands/parser.ts), [option reader](../src/commands/parser-options.ts), [Agent declarations](../src/agents/), [operation types](../src/operations/types.ts), [JSON envelope](../src/commands/json.ts), [exit codes](../src/core/errors.ts).

## Invocation and command tree

```text
ccset [--agent <agent>]                      # TUI
ccset <agent> status [--json]
ccset <agent> global set <field-options>
ccset <agent> provider set <provider-id> <field-options>
ccset <agent> use <provider-id>               # alias: provider use
ccset <agent> run <provider-id> -- <arguments>
ccset <agent> add [provider-id] --preset <preset-id>
ccset presets list [search] [--json]
ccset --agent claude-code state init
ccset --help | --version
```

Agents: `claude-code`, `opencode`, `codex`, `pi`, `grok-build`. The positional selector and `--agent` are equivalent; an explicit CLI selector wins over `CCSET_AGENT`, and conflicting CLI selectors fail with 64. Without a selector, only stdin+stdout TTY commands may infer a sole detected Agent. Other commands require selection; `presets list` is Agent-independent and can be filtered with one.

All five serve status/global/provider set/use. Only Claude Code serves `run` and `state init`. Provider delete/ignore, backup cleanup, and probes are TUI-only. Unsupported Agent commands return 66.

`use` validates and prints a session command for Claude Code; other Agents save next-start selection. `run` spawns installed Claude Code without a shell, inherits I/O, and returns its exit status (128 + signal number on signal termination). Only `run` accepts passthrough after `--`; `use` and dry-run never spawn.

## Managed patches and options

Supplied fields change, omitted fields preserve disk, and `--unset <fieldId>` explicitly removes an optional field. TUI defaults never fill omitted command fields. Required-field validation is Agent-owned. New Claude/opencode/pi Providers require endpoint and secret; Codex also requires `--display-name` (a readable saved key can satisfy its secret requirement). Grok overrides may omit key/endpoint.

Scalar field options need non-empty values; duplicate scalar fields, invalid choices, unknown options, and setting plus unsetting one field fail. Lists repeat their option rather than accepting CSV. opencode/pi models retain unmanaged data for retained IDs.

Use declaration `id` for unsets, not option spelling: `--unset smallModel`, `--unset modelProvider`, `--unset models`. A set operation with no patch, unset, or secret fails; no generic config-path, payload, or input-file option exists.

| Agent | `global set` options | `provider set` options |
| --- | --- | --- |
| Claude Code | `--proxy on\|off`, `--proxy-url`, `--disable-nonessential-traffic on\|off`, `--attribution-header on\|off`, `--disable-installation-checks on\|off`, `--enable-tool-search on\|off`, `--cleanup-period-days`, `--model` | `--base-url`, `--model`, repeatable `--fallback-model`, `--default-opus-model`, `--default-sonnet-model`, `--default-haiku-model` |
| opencode | `--model`, `--small-model`, `--share manual\|auto\|disabled`, `--autoupdate on\|off\|notify`, `--username`, repeatable `--disabled-provider` | `--display-name`, `--base-url`, `--npm`, repeatable `--model`, `--timeout` |
| Codex | `--model`, `--model-provider`, `--reasoning-effort`, `--approval-policy on-request\|never`, `--sandbox-mode read-only\|workspace-write\|danger-full-access`, `--verbosity low\|medium\|high`, `--context-window` | `--display-name`, `--base-url`, `--request-max-retries`, `--stream-max-retries`, `--stream-idle-timeout-ms` |
| pi | `--provider`, `--model`, `--thinking-level` | `--base-url`, `--api`, repeatable `--model` |
| Grok Build | `--model` | `--model`, `--base-url`, `--name`, `--api-backend` |

Exact bounds, choices, and unset eligibility come from each declaration/manifest. Claude `--proxy off` removes both proxy variables; `--unset proxyUrl` removes their URL, while the virtual `proxy` switch cannot be unset. Codex reasserts `wire_api = "responses"` and `requires_openai_auth = true`; these are not CLI options.

`use --model` is supported by opencode, Codex, and pi. opencode requires a listed, enabled Provider/model; pi defaults to the first declared model and needs explicit `--model` for a model-less override. Grok `use` writes only `models.default`; dotted built-in IDs can be selected through `global set --model`.

| Modifier | Contract |
| --- | --- |
| `--json` | One stdout JSON envelope for an ordinary command; live `run` refuses it |
| `--dry-run` | Validate/plan without writes, directories, or backups; status refuses it |
| `--replace-invalid` | Supported on global/provider set and pi/Grok use; backs up reconstructible invalid originals. Refused on status/state init/run and Claude/opencode/Codex use |
| `--token-stdin` | Explicit stdin secret source for provider writes/preset add |

Codex CLI provider set cannot replace an unreadable saved Auth profile, even with `--replace-invalid`; its routing document may be reconstructed.

## Presets and secrets

`add` expands bundled preset data to provider-set options. Explicit fields/unsets override defaults, including when reapplying to an existing Provider. Omitted ID uses the preset ID, with `-ccset` when reserved. Saving does not select the Provider. Codex model suggestions appear in the returned `nextCommand`, not a Provider save.

Scripts accept exactly one of `CCSET_TOKEN` and `--token-stdin`. Stdin is read only explicitly, refuses a TTY, accepts at most 64 KiB of valid UTF-8, and removes at most one final LF/CRLF/CR. Input must be non-empty, NUL-free, single-line, and without surrounding whitespace; environment input uses the same checks without newline removal.

Only preset `add` with stdin+stdout TTYs, human output, and no dry-run may ask for a hidden key. Scripts/JSON/dry-run require an explicit source. Invalid options fail before secret consumption or writes. Never put a real secret in argv or an inline shell-history example.

## Codex switching

- A live auth file unmatched by **any** saved profile requires exactly one of `--adopt-current-as <new-id>` or `--replace-current-auth`. Both back up the live file.
- Adoption publishes a new profile only if absent and records its original route. An unnecessary adoption request is refused.
- The selected profile and effective route must be readable/valid. Keyring mode and mismatched `CODEX_HOME` refuse CLI switching before mutation.
- Routing commits before whole-file auth replacement. On auth failure, the CLI checks whether replacement landed, restores changed routing/model leaves when appropriate, and reports remaining committed paths plus rollback failure.
- TUI activation has separate orchestration; [open follow-ups](../review.md) delimit its differences. Do not infer full surface parity from the shared commit core.

## Output and exit codes

Human reports are localized lines: successes/warnings on stdout, failures on stderr. JSON uses top-level `schemaVersion: 1`, `agent`, `operation`, `ok`, and `exitCode`; successful results also carry `changed`, `dryRun`, `targets`, `warnings`, and optional `data`/`launchCommand`/`activation`/`nextCommand`. Ignore unknown additive fields.

Target records contain absolute `path`, `mode`, `changed`, and `backupPath` (`null` when absent). `partial` is an array of changed paths, not a boolean. Failures use `error.code`/`params` and optional `error.rollback`; status parse failures preserve readable `data` and `errors` with `ok: false`, exit 4. Ordinary JSON command failures leave stderr empty.

Credential fields use presence flags whose names are Agent-specific (`tokenPresent`, `apiKeyPresent`, etc.). Arbitrary unmanaged content is not automatically safe to export; existing projection gaps remain in the safety follow-up.

| Exit | Meaning |
| --- | --- |
| 0 | Success, including warnings or no-op |
| 1 | Runtime/I/O error, validation refusal, or ineffective-environment conflict |
| 2 | TUI invoked without stdin TTY |
| 3 | Target permission failure |
| 4 | Existing target parse failure; status can include partial-readable data |
| 64 | Usage/selector/field/secret-source error |
| 65 | Unknown Agent |
| 66 | Command unsupported by the selected Agent |

Verification selection lives in [verification.md](verification.md). Exact observable assertions belong in the `verify:commands*` and `verify:short-commands` fixtures.
