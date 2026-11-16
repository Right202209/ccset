# Architecture

[简体中文](zh-CN/architecture.zh-CN.md) | English

[AGENTS.md](../AGENTS.md) owns contributor rules; [CONTEXT.md](../CONTEXT.md) owns terms. This guide maps current behavior to source. [Open safety findings](../review.md) are limitations, not completed fixes.

## Entry points and contracts

| Source | Responsibility |
| --- | --- |
| [cli.tsx](../src/cli.tsx) | Arguments, `CCSET_*` values, mode split, locale, TTY guard, process exit |
| [registry.ts](../src/registry.ts) | Static Agent imports and catalog registration |
| [types.ts](../src/types.ts), [ctx.ts](../src/ctx.ts) | TUI `ActionResult` and runtime context |
| [operations/types.ts](../src/operations/types.ts), [index.ts](../src/operations/index.ts) | `OperationRequest → executeOperation → OperationResult` or typed error |
| [commands/](../src/commands/) | Selector/preset expansion, declaration-driven parsing, secret input, output, launch |

Without a positional command, the CLI enters the TUI after checking stdin is a TTY. Help/version finish earlier. Ink and React renderers load only on that path. A command never invokes Screen callbacks.

Explicit positional/`--agent` selection wins over `CCSET_AGENT`; conflicting CLI selections fail. Only commands with stdin and stdout TTYs can infer a sole locally detected Agent. TUI discovery offers detected Agents; explicit selection bypasses it. Detection never runs the Agent or contacts a Provider (ADR 0020).

The CLI parser consumes Agent-owned field declarations. Presets expand to those same options; explicit fields/unsets win. Only terminal preset `add` can request a hidden key. The operation prepares a launch argument array; [launch.ts](../src/commands/launch.ts) spawns it with `shell: false` only for live Claude Code `run`.

## Write pipeline

`read → overlay → validate → render/plan → apply`

1. An Agent re-reads each target, applies its TUI form or CLI patch mapping, and validates the resulting proposal.
2. [config-file.ts](../src/core/config-file.ts) parses and renders through the selected Codec, then checks the rendered document again.
3. [commit.ts](../src/operations/commit.ts) plans all ordinary command targets before mutation and compares rendered bytes with the base.
4. `applyPlan` backs up and atomically replaces each target in order. It reports committed records on failure; it provides no cross-file transaction.

CLI saves use `skipUnchanged: true`; ordinary TUI saves use `false`. Dry-run plans intent without creating directories, backups, or files. An absent target receiving an empty document is a no-op. The authorized-invalid/empty-result edge case remains in [the safety follow-up](../review.md).

Forms write their held managed values. A fresh save-time read protects unmanaged data already on disk; it does not merge later external changes into form fields. Each Edit entry must seed from a new read, including when its Provider Screen has stayed open across a save.

| Core source | Guarantee/mechanism |
| --- | --- |
| [merge.ts](../src/core/merge.ts) | Managed leaf set/delete; own-property traversal; `__proto__` blocked, `constructor`/`prototype` retained as data |
| [atomic-file.ts](../src/core/atomic-file.ts), [json-file.ts](../src/core/json-file.ts), [copy.ts](../src/core/copy.ts) | Random exclusive private staging, then rename for replacement; POSIX mode applied at creation, chmod reassertion best effort |
| [create-file.ts](../src/core/create-file.ts) | Hard-link publication only if absent, with no overwriting fallback |
| [backup.ts](../src/core/backup.ts) | Staged copies, per-basename retention of ten, partial-copy reporting and cleanup |
| [save.ts](../src/core/save.ts), [errors.ts](../src/core/errors.ts) | TUI recovery confirmation and typed parse/permission/partial errors |
| [remove.ts](../src/core/remove.ts), [provider-actions.ts](../src/core/provider-actions.ts) | Backup-before-delete, whole-file/shared-block removal, confirmed Provider management |

Atomic rename protects each completed publication from truncation; it does not provide locks, compare-and-swap, exclusive final backup names, or fsync durability. Do not claim protection against concurrent external writers or power loss.

## Codecs

`LoadedConfig` carries parsed data and original text. JSON reserializes the merged object; JSONC/TOML edit spans. Empty format-preserving write lists are byte-identical; unmanaged text outside the edit survives.

- [TOML](../src/core/toml/): scan/read/check/edit separately. A managed leaf inside an inline table may expand to dotted assignments; Provider removal also removes its owned tables. Recheck rendered syntax (ADR 0003).
- [JSONC](../src/core/jsonc/): npm `jsonc-parser` provides syntax/spans; ccset edits them. The package's `modify()` formatter changed adjacent compact arrays, so it failed the preservation corpus (ADR 0004).
- The TOML checker intentionally accepts `\e`, leap seconds, and year `0000`. Python `tomllib` is an oracle for the parity corpus, not these separate extension cases.
- A tolerant reader is not write permission. Malformed Agent files require confirmation or a declaration-supported `--replace-invalid`; originals remain in backups.

## Agent policies

Paths, defaults, manifests, field validation, actions, commands, and messages stay in `src/agents/<id>/`. Status readers have no writes. Exact paths/options are in [the user guide](user-guide.md#agent-configuration) and [command contract](milestone-3-non-interactive.md).

| Agent | Distinct policy |
| --- | --- |
| Claude Code | Separate global/Provider JSON files; live state create-only; only confirmed Messages probe. `use` prepares a session command; `run` executes it. |
| opencode | Existing `.jsonc` preferred, otherwise `.json`; never creates JSONC or touches the legacy JSON beside it. Models merge by ID. |
| Codex | TOML routing plus saved Auth profiles and adoption-routing metadata; saves enforce Responses/auth invariants and reject overriding credential sources. Live auth replaced whole. CLI enforces home mismatch; TUI reports it. Both activation paths check keyring, but have distinct orchestration and remaining gaps. |
| pi | JSONC `models.json`, plain JSON `settings.json`; model arrays merge by usable member ID and preserve retained metadata. `use` writes both default Provider/model leaves. Login auth is unmanaged. |
| Grok Build | One TOML document; Provider `model.<id>`, startup `models.default`; optional key/endpoint for built-in overrides. Login auth is unmanaged. |

opencode's `XDG_CONFIG_HOME`, pi's `PI_CODING_AGENT_DIR`, and Grok's `GROK_HOME` apply only when `ctx.home` is the real home. Codex never follows `CODEX_HOME`; CLI mutation refuses a mismatch. Scratch-home fixtures must clear inherited Agent overrides. Launching an upstream Agent needs its own isolation.

## Navigation, terminal, and language

[useScreens.ts](../src/ui/useScreens.ts) reloads only list/status-producing tasks on back. Never retain a save as a reload task. A successful delete's `closesOrigin` closes the Provider Screen and its confirmation; clearing its ignore note happens after removal. A settings failure at that point can omit the removal report (open follow-up).

A retained draft and dirty baseline are separate. Failed saves and declined replacement preserve the draft; only successful saving or explicit discard clears unsaved state. Confirmation cursors start on the safe choice.

[Layout.tsx](../src/ui/Layout.tsx) computes chrome once and supplies the main Panel's interior Viewport. [Viewport.tsx](../src/ui/Viewport.tsx), [terminal.ts](../src/ui/terminal.ts), and [text-fit.ts](../src/ui/text-fit.ts) own windowing, capabilities, and display-width fitting. Frame height follows content; narrowing clears visible paint, never scrollback. Numeric/mouse selection addresses visible rows.

Glance calls read-only status on Agent selection and after a message, discarding stale refreshes. Focused Previews reuse loaded rows and show credentials only as presence, URLs only as valid origins. Views add no Agent file-read path (ADRs 0017–0018).

TUI locale: invocation override → saved choice → first-use prompt. Commands use the invocation override or English. Neither infers `LANG`. Agent catalogs merge at registry import and reject duplicates; fixtures must import it before resolving Agent keys.

## Anti-patterns from fixed failures

| Do not | Failure and replacement |
| --- | --- |
| Reuse a list's record for later Edit forms | Reinstates an old credential after rotation; read on every form entry (`3fdbce1`). |
| Replace `env`, options, or models wholesale | Drops unmanaged siblings/retained model metadata; emit leaves/member edits. |
| Encode off/deletion as empty text or treat `false` as deletion | Leaves proxy keys active or loses valid booleans; use explicit deletion. |
| Check absence, then rename over a create-only destination | Overwrites a concurrently created live state/profile; use exclusive publication (`ec668ba`). |
| Share one scratch home across independent fixture scenarios | A fresh-file test unexpectedly creates a backup; allocate independent homes (`0569b3e`). |
| Use Provider-ID rules for model IDs | Refuses real IDs containing `.`, `/`, or `:`; use Agent model validation (`59121f1`). |
| Install the forwarder beside the same-version local tarball | npm satisfies its pin locally and parity compares the build with itself; install separately and assert registry resolution (`a999c4a`). |
