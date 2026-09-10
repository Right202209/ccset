# Architecture

Read [AGENTS.md](../AGENTS.md) for the change workflow and
[CONTEXT.md](../CONTEXT.md) for the domain vocabulary. This guide explains the
runtime boundaries and the reasons behind the guarantees contributors must
preserve. Specifications and accepted decisions live in [PRD.md](../PRD.md), the
[command specification](milestone-3-non-interactive.md), and [ADRs](adr/).

## Entry points and contracts

`src/cli.tsx` owns process arguments, `CCSET_*` overrides, invocation mode, locale
selection, and exit status. An explicit subcommand selects the command adapter;
without one, the TTY guard precedes interactive rendering. Command mode must not
load Ink. Pass boundary values inward rather than reading overrides again in
helpers.

`src/types.ts` defines the TUI contract: an Agent returns an `ActionResult`
(`form`, `list`, `status`, `confirm`, or `message`), and the Ink Views render those
shapes without Agent-specific knowledge. `src/ctx.ts` owns the shared context;
`types.ts` re-exports it. Agent modules do not import from `src/ui/`.

The Non-interactive contract is `src/operations/types.ts` and
`executeOperation` in `src/operations/index.ts`: a normalized `OperationRequest`
produces an `OperationResult` or typed error. Screens, translated presentation,
and `ManagedWrite[]` do not cross the public operation contract. See ADR 0006.

`src/commands/` adapts argv to that contract. The parser uses declarations from
each Agent, secret readers supply `CCSET_TOKEN` or explicitly selected stdin,
and presenters produce localized lines or the `schemaVersion: 1` JSON envelope.
The printed error and process exit status must agree. The command specification
records known conformance differences; changing those is a behavior change, not
a documentation cleanup.

## Shared writes and codecs

Configuration saves use `src/operations/commit.ts` for planning and applying
writes. The flow is `read → overlay → validate → plan → apply`: read current
disk state at save time, validate the proposed result, render and preflight all
command targets, then commit them in order. Non-interactive no-ops skip writes
and backups; dry-run stops at the plan. A failure after a multi-target commit
reports the paths already written as partial, not as a rolled-back transaction.

TUI form mapping and command patch mapping stay separate. A blank TUI field can
emit a deletion; an omitted command option preserves the disk value, and command
removal is explicit. Template defaults must not populate omitted patch fields
(ADR 0008). A `ManagedWrite` whose `value` is `undefined` means deletion; boolean
`false` is still a value.

Shared file-safety helpers live under `src/core/`:

| Module | Responsibility |
| --- | --- |
| `merge.ts` | Apply managed leaf writes while preserving unmanaged siblings |
| `json-file.ts`, `copy.ts` | Atomic temp-file/rename writes and whole-file copies, POSIX `0600` |
| `backup.ts` | Backups and per-file rotation in the directory supplied by the Agent |
| `config-file.ts` | Read, check, render, and write through the selected Codec |
| `save.ts` | Translate save errors into TUI recovery/confirmation Screens and success messages |
| `mask.ts`, `errors.ts` | Secret-safe display and typed errors with message keys and exit codes |
| `values.ts`, `validate.ts` | Shared coercions and validator factories; Agent policy stays with the Agent |
| `paths.ts`, `settings.ts` | Shared home/backup helpers and ccset's own locale preference file |

`ConfigFile.codec` selects `json`, `jsonc`, or `toml`. `LoadedConfig` carries
both parsed data and original text. JSON can be rendered from the merged object;
TOML and JSONC edit original spans to retain comments, whitespace, and key order.
For those formats, an empty write list must be byte-identical and a managed edit
must leave unrelated bytes alone.

The TOML Codec under `src/core/toml/` separates scanning, reading, strict checking,
and editing (ADR 0003). The JSONC Codec uses npm's `jsonc-parser` for syntax and
spans, with ccset's own editor because the package's formatter changes unmanaged
bytes (ADR 0004). Tolerant reads do not authorize writes: a target failing the
strict check requires TUI confirmation or the command's `--replace-invalid`
choice. An authorized replacement backs up the unreadable original first.
`ConfigParseError` carries format-specific message keys; `runSave` catches it.

## Agent modules

Each `src/agents/<id>/` module owns paths, defaults, manifests, validators,
messages, actions, and command declarations. Keep `manifest.ts` as data; use
`seed*` and `emit*` helpers for form/config mapping and reuse the commit core for
saves. Status builders read without writing. Command status DTOs and TUI status
presentation can share reads while keeping their output contracts separate.

`src/registry.ts` is static: add an import and array entry, never scan paths for
dynamic imports. It merges Agent catalogs at module load and rejects duplicate
keys. Fixtures resolving Agent strings must import the registry too.

The PRD's extension boundary allows multiple files inside
an Agent module. Fixtures, package wiring, and docs are additional expected
changes. A new shared capability needs an explicit core/interface change with
its own verification scope; see [adding an Agent](adding-an-agent.md).

Agent-specific constraints that are easy to miss:

- **Claude Code:** global settings and each Provider use separate JSON files.
  `state.ts` creates `~/.claude.json` only when missing; never update this live
  state store. `test-connection.ts` is the only outbound network path: confirm
  the destination before sending a token and never print the response body.
- **opencode:** Providers share one document under `provider.<id>`.
  `provider.<id>.models` merges per model ID, preserving options on retained
  models. `opencodeTarget` in `paths.ts` selects an existing `.jsonc`, otherwise
  `.json`; when `.jsonc` is selected, the legacy `.json` remains untouched.
  ccset does not create a `.jsonc`. The upstream merge-order evidence and pending
  runtime check are recorded as U6 in the verification register.
- **Codex:** Provider keys live in `auth.<id>.json` Auth profiles, outside
  `config.toml`. Provider saves reassert `wire_api = "responses"` and
  `requires_openai_auth = true`, and refuse a conflicting `env_key` or
  `experimental_bearer_token` credential source. The live `auth.json` is copied
  whole after a backup; adopted credentials retain fields ccset does not model.
  Switching writes routing before credentials and handles failures explicitly.
  Non-interactive switches require explicit credential-conflict choices;
  `CODEX_HOME` mismatch and keyring preconditions follow ADRs 0011–0013.

There is no Test connection for opencode or Codex: the existing probe speaks the
Anthropic protocol, and arbitrary SDK/Responses endpoints need their own contract.
Live compatibility unknowns belong in the register, not in assumed guarantees.

## Navigation and terminal rendering

`src/ui/useScreens.ts` owns a stack of `Frame`s. Only `list` and `status` Frames
retain their producing task for reload on back, because rerunning those is a
read. Returning from a success message must never rerun the write that produced
it.

A confirmation returned by `replace()` stacks over the form, and `App` parks
submitted values on the form's Frame before submitting. Declining malformed-file
replacement or returning from a failed save must retain the draft, including
masked secrets. The unsaved-edits prompt keeps the form mounted but hidden;
confirmation cursors start on the safe choice.

Frame titles appear in the header's navigation path and elide from the front
when space is short. The TUI keeps output in terminal scrollback and windows
long regions instead of owning a fixed-height screen (ADR 0002).

- `terminal.ts` owns glyphs, colors, busy frames, and `fold()` for catalog text
  on seven-bit terminals. New paint sites must use the terminal helpers.
- `Viewport.tsx` owns terminal dimensions, resize handling, `windowAround()`,
  and `WindowRegion`. Lists, Status, and forms use it to keep focused content
  inside the row budget.
- `keymap.ts` owns bindings and the help line. It rejects duplicate bindings
  and missing message keys at load time.
- `useReviewForm.ts` owns editing state, Advanced fields, validation, row
  windowing, and `ctrl+s`; `ReviewForm.tsx` renders that state.

## Locale and messages

Shell catalogs live in `src/i18n/en.ts` and `src/i18n/zh-Hans.ts`; Agent-specific
strings live in each Agent's `messages.ts`. Ship both locales. `t()` can fall back
to English or return the raw key, so successful rendering alone does not prove
catalog coverage. Keys also occur in fields, validators, choices, error objects,
and template-built families; searching only for direct `t()` calls misses them.

The CLI resolves locale before mounting the main App (ADR 0005). An explicit
`CCSET_LOCALE` overrides the saved choice without persisting it; otherwise the
TUI uses the saved locale or asks on first use. The initial prompt is bilingual
and bypasses the catalogs because no locale has been selected. Help, version,
and non-TTY interactive refusals do not prompt or persist a choice.

Use the [verification guide](verification.md) to select fixtures for any of
these boundaries. Keep release status and dated evidence in the register rather
than duplicating milestone snapshots in coding-assistant instructions.
