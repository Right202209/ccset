# Milestone 3 Non-Interactive Mode

Status: accepted design; implementation landed, conformance closeout pending
([issue #56](https://github.com/Right202209/ccset/issues/56)).

This document preserves the accepted design. The current implementation differs
in parts of the command contract: it uses `--json` and exit codes `64`–`66`, and
Codex requires a replacement choice only for a live credential that matches no
saved Auth profile. These differences remain part of the conformance closeout;
see the [user guide](user-guide.md#cli) for the implemented CLI behavior.

This is the executable product contract for Milestone 3. It is intentionally
separate from the TUI model: `Action` and `Screen` remain interactive concepts,
while this document defines the stable command API used by scripts and CI.

The durable trade-offs behind this contract are recorded in ADRs
[0006](adr/0006-keep-non-interactive-commands-independent-of-tui-screens.md),
[0007](adr/0007-limit-m3-non-interactive-capabilities.md),
[0008](adr/0008-use-patch-semantics-for-non-interactive-writes.md),
[0009](adr/0009-restrict-non-interactive-secret-sources.md),
[0010](adr/0010-preflight-non-interactive-writes.md),
[0011](adr/0011-require-explicit-codex-credential-conflict-choice.md),
[0012](adr/0012-fail-non-interactive-writes-on-codex-home-mismatch.md),
[0013](adr/0013-treat-codex-keyring-as-a-use-precondition.md), and
[0014](adr/0014-stabilize-non-interactive-output-and-exit-codes.md).

## Purpose and boundary

Milestone 3 adds local deployment and inspection commands whose state-changing
choices can all be supplied explicitly. It does not promise parity with every TUI
menu action.

Included operations:

- read local state with `status`;
- apply global and Provider Managed patches;
- create the Claude Code state file only when it is absent;
- switch a Codex Provider and its live Auth profile when the caller resolves any
  credential conflict explicitly.

Excluded operations:

- credential-bearing network probes;
- clearing backups;
- removing an Auth profile;
- other destructive maintenance that needs a separate safety contract.

## Invocation and command tree

Running ccset without a subcommand keeps the existing TUI behavior. An explicit
subcommand selects non-interactive execution; there is no `--non-interactive`
flag. The TUI path still requires a TTY, while an explicit command does not.

Every non-interactive command requires an explicit `--agent <id>`. Installation
detection never chooses a script's target. Provider identity is always a
positional Provider ID, even when an Agent calls it a name internally.

```text
ccset --agent <id> status
ccset --agent <id> global set [options]
ccset --agent <id> provider set <provider-id> [options]
ccset --agent codex provider use <provider-id> [options]
ccset --agent claude-code state init
```

No aliases such as `show`, `configure`, or `apply` are part of Milestone 3.

Common output and safety modifiers are placed before the subcommand in canonical
examples:

```text
--output human|json
--dry-run
--replace-invalid
```

Help and version handling completes before the TTY guard. The common modifiers
are meaningful only with an explicit subcommand; using one without a subcommand
is a usage error rather than an attempt to configure the TUI.

`--replace-invalid` is valid only on operations that can reconstruct a target from
the command's values. `state init` never replaces an existing state file. The
Codex `provider use` command can replace an invalid routing document only when the
selected Auth profile itself is readable; it cannot reconstruct a missing or
invalid saved profile without a new `provider set`.

`status` accepts `--output` but not mutation modifiers. `--dry-run` still performs
all the same preconditions as its real counterpart, including an explicit Codex
conflict choice when one would be required.

## Agent capability matrix

| Command | Claude Code | opencode | Codex CLI | pi |
| --- | --- | --- | --- | --- |
| `status` | yes | yes | yes | yes |
| `global set` | yes | yes | yes | yes |
| `provider set` | yes | yes | yes | yes |
| `provider use` | no | no | yes | yes |
| `state init` | yes | no | no | no |

A command that is valid in the grammar but absent from the selected Agent's
capability declaration returns exit code `7`; it is not silently mapped to a
different operation.

## Input contract

### Managed patches

`global set` and `provider set` apply a Managed patch:

- supplied fields change;
- omitted fields retain their current on-disk values;
- a new target starts from an empty document, not from TUI template defaults;
- a new Provider must receive the fields required for a valid configuration;
- an invocation with no field change, no `--unset`, and no Secret source is a usage
  error rather than an implicit rewrite.

The CLI does not accept generic configuration paths, `--set key=value`, JSON/TOML
payloads, or an input file. This keeps the public contract independent of a
serialization format and prevents an old script from replacing fields it does not
know about.

### Field options

Field options are stable kebab-case names. The following table is the M3 baseline;
options not listed for an Agent are rejected.

| Agent and command | Options |
| --- | --- |
| Claude Code `global set` | `--proxy-enabled true|false`, `--proxy-url <url>`, `--disable-nonessential-traffic on|off`, `--attribution-header on|off`, `--disable-installation-checks on|off`, `--enable-tool-search on|off`, `--cleanup-period-days <positive-int>`, `--model <text>` |
| Claude Code `provider set` | `--base-url <url>`, `--model <text>`, `--fallback-model <model>` (repeatable), `--default-opus-model <text>`, `--default-sonnet-model <text>`, `--default-haiku-model <text>` |
| opencode `global set` | `--model <text>`, `--small-model <text>`, `--share manual|auto|disabled`, `--autoupdate on|off|notify`, `--username <text>`, `--disabled-provider <provider-id>` (repeatable) |
| opencode `provider set` | `--display-name <text>`, `--base-url <url>`, `--npm <package>`, `--models <model-id>` (repeatable), `--timeout <positive-int>` |
| Codex `global set` | `--model <text>`, `--model-provider <provider-id>`, `--reasoning-effort <text>`, `--approval-policy on-request|never`, `--sandbox-mode read-only|workspace-write|danger-full-access`, `--verbosity low|medium|high`, `--context-window <positive-int>` |
| Codex `provider set` | `--display-name <text>`, `--base-url <url>`, `--request-max-retries <positive-int>`, `--stream-max-retries <positive-int>`, `--stream-idle-timeout-ms <positive-int>` |

`wire_api`, `requires_openai_auth`, and other Codex invariants remain Agent-owned
fixed writes and are not CLI options. Claude's proxy fields are coupled: the
resulting state must have a URL when enabled, and `--proxy-enabled false` removes
both proxy variables. `--unset proxy-url` is the only `--unset` form for the proxy;
`--proxy-enabled false` is an explicit switch value that also removes both. Unsetting
the virtual `proxy-enabled` field is rejected. Setting `--proxy-url` while the
resulting switch is disabled is a usage error; enabling a previously empty proxy
requires a URL in the existing state or in the same invocation.

Scalar options always carry an explicit value. Booleans are `true` or `false`,
choices use the semantic values shown above, and integers are decimal positive
integers. Commander-style `--no-*`, presence-means-true flags, empty values, and
the TUI `unmanaged` sentinel are not part of the contract. Duplicate scalar
options and unknown option names are usage errors.

Option parsing is completed before any filesystem read. A syntactically invalid
invocation therefore cannot consume a secret, create a directory, or create a
backup.

Multi-value options are repeatable rather than CSV strings. Repeating an option
supplies the complete new list; omitting it preserves the existing list, and
`--unset <field>` removes it. opencode `--models` still merges model IDs one by
one, preserving unmanaged settings inside an existing model object.

### Explicit removal

Optional, non-secret fields are removed only with repeatable `--unset <field>`:

```text
ccset --agent codex global set --unset model --unset verbosity
```

Assigning and unsetting the same field in one invocation is an error. Provider IDs,
required fields, and secrets cannot be unset. There are no `--clear-*` aliases and
an empty string never means removal.

### Secret sources

A Provider secret has no value-bearing CLI option. It may come from exactly one of:

```sh
CCSET_TOKEN='...' ccset --agent codex provider set acme --base-url https://api.example.com
printf '%s' "$TOKEN" | ccset --agent codex provider set acme --token-stdin --base-url https://api.example.com
```

The rules are:

- `CCSET_TOKEN` and explicit `--token-stdin` are the only sources;
- `--token`, `--api-key`, positional secrets, and secret-file options do not exist;
- both sources together are an error, with no precedence rule;
- stdin is never consumed implicitly and `--token-stdin` on a TTY is a usage error;
- omitting both sources preserves an existing secret, but a new Provider (or a
  Provider with no saved secret) fails without one;
- provider-set secret input never activates a Provider.

stdin is read to EOF with a 64 KiB limit. At most one final LF and its optional
preceding CR are removed. The resulting value must be non-empty, valid UTF-8,
NUL-free, single-line, and free of leading or trailing whitespace. `CCSET_TOKEN`
uses the same validation without line-ending removal. Errors identify only the
source and reason; no secret, masked or otherwise, reaches output, logs, stack
traces, or process arguments. In practice, inject `CCSET_TOKEN` through a CI
secret store or an already-exported environment rather than typing a literal value
in an inline shell assignment that could enter shell history.

### Invalid targets and Codex conflicts

All targets of an operation are read and validated before its first write. An
invalid existing target returns `4` by default. `--replace-invalid` explicitly
permits a backup followed by an empty-base write for reconstructible targets; it
does not bypass field validation, permissions, or other preconditions.

Codex `provider use` treats a live `auth.json` that is not byte-identical to the
selected Auth profile as a safety conflict. The caller must choose exactly one of:

```text
--adopt-current-as <provider-id>
--replace-current-auth
```

The first keeps the live bytes under a new, non-existing Auth profile; the second
replaces them without adoption. Both paths back up the live file. A readable
already-active profile needs neither option; both options together are an error.

Codex writes fail before mutation when `CODEX_HOME` resolves to a different
directory from ccset's target. `status` may report the mismatch as a warning. When
`cli_auth_credentials_store = "keyring"`, `provider set` may save a reusable Auth
profile with a warning, but `provider use` fails before writing because `auth.json`
is not the effective credential source.

`state init` creates `~/.claude.json` only when it is absent. An existing valid file
is an unchanged success; an existing invalid file remains untouched and returns
exit `4`.

## Output contract

Non-interactive execution never mounts Ink, emits ANSI control sequences, or shows
a progress spinner.

### Human output

Human output is line-oriented. Successful writes name every changed absolute path,
the resulting mode, any backup path, the activation or launch command, and warnings.
An unchanged operation says `changed: false` and does not claim that a backup was
made. Human text continues to use the i18n catalog. Secrets are never printed,
including masked previews; status reports only whether a secret is present.

Successes and warnings go to stdout. Errors go to stderr and contain a translated
message without a stack trace or secret-bearing OS text.

### JSON output

`--output json` emits exactly one JSON object to stdout for both success and failure;
stderr remains empty for ordinary command errors. The schema is additive after
`schemaVersion: 1`; consumers must ignore unknown fields.

Success envelope:

```json
{
  "schemaVersion": 1,
  "ok": true,
  "exitCode": 0,
  "agent": "codex",
  "operation": "provider.set",
  "changed": true,
  "data": {
    "targets": [
      { "path": "/home/example/.codex/config.toml", "mode": "0600", "backupPath": null }
    ],
    "activationCommand": "codex"
  },
  "warnings": []
}
```

Failure envelope:

```json
{
  "schemaVersion": 1,
  "ok": false,
  "exitCode": 4,
  "agent": "codex",
  "operation": "provider.use",
  "error": { "code": "invalidConfig", "params": { "path": "/home/example/.codex/config.toml", "position": "line 4, column 2" } }
}
```

JSON uses stable operation IDs, warning/error codes, native booleans and numbers,
absolute paths, and `null` for an absent backup. It contains no translated labels,
raw secret values, masked secrets, or response bodies; non-secret values such as
URLs, models, and enum settings may be represented in structured status data.
Status represents credential fields as `secretPresent: true|false` and carries
parseable data plus warning codes. A partial runtime failure includes
`partial: true` and the paths already committed.

The numeric `exitCode` in the envelope always matches the process exit status.
When `status` returns `4` for an unparseable target, the envelope has `ok: false`,
the corresponding error object, and the readable portions of `data` rather than
discarding the inspection result.

`status` returns exit `4` when any inspected target is unparseable, while still
returning all sections it could read. Ordinary findings such as a missing Base URL,
keyring mode, or a `CODEX_HOME` warning do not change its success code.

## Exit codes

| Code | Name | Meaning |
| --- | --- | --- |
| `0` | `EXIT_OK` | Completed successfully, with warnings or without changes allowed |
| `1` | `EXIT_RUNTIME` | Unclassified runtime or I/O failure; a mid-commit multi-file failure is reported as `partial` |
| `2` | `EXIT_NOT_TTY` | Only the no-subcommand TUI was invoked without a TTY |
| `3` | `EXIT_PERMISSION` | Permission denied on a target path |
| `4` | `EXIT_INVALID_CONFIG` | An existing target could not be parsed; `status` may still return its partial report |
| `5` | `EXIT_USAGE` | Invalid command/option/field/value, missing Agent or required input, duplicate scalar, or Secret source error |
| `6` | `EXIT_CONFLICT` | A safety conflict requires an explicit choice, currently Codex live Auth replacement |
| `7` | `EXIT_UNSUPPORTED` | The selected Agent lacks the command or an Agent precondition makes it ineffective, such as keyring or `CODEX_HOME` mismatch |

Exit `0` is also used for an idempotent no-op and for non-fatal warnings. Signals
retain the platform's normal termination behavior and are not part of this table.

## Write and reuse architecture

The implementation should preserve a deep boundary between presentation and domain
operations:

1. Add an Agent-owned non-interactive command declaration containing command IDs,
   field option metadata, and handlers. The registry remains static; adding an
   Agent still changes its module and the registry line, not the parser's list of
   hard-coded Agent paths.
2. Introduce a structured `CommandInput`/`OperationResult` layer. A command handler
   receives the disk-only patch, `unset` set, secret value (if any), recovery policy,
   and dry-run flag, then returns raw paths, changed targets, warnings, and error
   codes. It never returns a `Screen` or translated sentence.
   Command field declarations may reference the existing manifest validators and
   field IDs; they must not duplicate validation rules in the parser.
3. Split each Agent's current save path into `read -> seed/overlay -> validate ->
   plan -> apply`. Agent code keeps field mapping, coupled fields, codecs, and
   multi-file rules; `src/core` keeps merge, backup, atomic write, modes, and the
   preflight/commit primitives.
4. Make the TUI submit callbacks call the same plan/apply operations. `runSave()`
   remains the TUI adapter for its malformed-config confirm Screen. The CLI passes
   the already-decided recovery policy and never calls `Action.run`.
5. Extract raw status DTOs beside the existing translated `StatusSection` views;
   the TUI presenter translates them, while JSON serializes the DTOs directly.
   Likewise, replace translated `WriteReport.notes` in the shared boundary with
   warning/error codes and parameters, then let both presenters render them.
6. Extract Codex's private activation work into the operation layer and let
   `openActivate()` wrap it in its existing confirm/form Screens. Preflight the
   routing document, selected profile, keyring setting, and home path before any
   rename or copy.

There is no cross-file filesystem transaction. The operation prepares all rendered
contents and backups first, commits in the Agent's documented order, and reports
`partial: true` with the affected paths if an unexpected failure occurs after a
commit begins. A no-op compares the planned managed result (and any sidecar bytes)
with disk and skips backup and write entirely. `--dry-run` performs the same read,
validation, and plan steps but never creates a backup or changes a file.

## Implementation sequence

1. Add the exit-code constants, command input/result DTOs, secret reader, option
   validation (including Commander error interception), and human/JSON presenters
   without enabling writes.
2. Refactor the three Agent save/status paths behind plan/apply and raw DTOs;
   preserve the existing TUI behavior and verification fixtures at each step.
3. Add the common parser and capability dispatch, then enable `status`, `global set`,
   and `provider set` for Claude Code and opencode.
4. Add Codex `provider use`, Auth conflict choices, keyring and `CODEX_HOME`
   preconditions, and multi-target preflight/partial reporting.
5. Enable `state init`, no-op detection, `--dry-run`, and `--replace-invalid` across
   their permitted operations.
6. Update translations and user documentation only after the command fixtures pass;
   add Windows/WSL evidence before calling the milestone complete.

## Verification matrix

| Area | Required checks |
| --- | --- |
| Mode and parser | No-subcommand pipe exits `2` with no ANSI; explicit commands run without TTY; missing/unknown Agent, command, field, duplicate scalar, enum, integer, and empty patch return `5` |
| Secrets | Env and stdin success; both sources, TTY stdin, multi-line/NUL/oversize/whitespace inputs fail; token is absent from argv, stdout, stderr, JSON, errors, and logs |
| Writes | Every serving Agent preserves unmanaged keys, uses `0600`, backs up only changed targets, honors `--dry-run`, and returns an accurate no-op report |
| Invalid files | All-target preflight, exit `4`, backup-before-replace, no known partial write, and correct `--replace-invalid` boundaries |
| Codex | Auth adoption/replacement conflict, existing-profile idempotence, unreadable profile, keyring, `CODEX_HOME`, routing plus sidecar writes, and `partial` reporting |
| Status and output | Structured status with `secretPresent`, parse failures plus exit `4`, warning-only success, JSON schema, stable codes, no ANSI, and human i18n |
| Regression and platforms | Existing `npm run verify:*` fixtures, new executable CLI fixtures, mutation-to-fail checks, POSIX mode checks, Windows Terminal/PowerShell and WSL manual scenarios |

The PRD Milestone 3 bullet should link here. README changes, release notes, and
the Important Documentation register belong to the implementation and verification
changes, not to this accepted design alone.

## Open implementation questions

There are no remaining product-contract decisions. Implementation may still choose
internal names and helper boundaries, provided the observable contract above and
the existing TUI safety guarantees remain unchanged.
