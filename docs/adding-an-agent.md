# Adding an agent

[简体中文](zh-CN/adding-an-agent.zh-CN.md) | English

First meet [contribution criteria](../CONTRIBUTING.md#new-agents). Read [terms](../CONTEXT.md), [architecture](architecture.md), and the [command contract](milestone-3-non-interactive.md). The [coding-assistant SOP](agents/add-agent-workflow.md) sequences this work.

## What you are actually building

An Agent reads local configuration, returns `ActionResult` data (`form`, `list`, `status`, `confirm`, `message`), and maps submitted values to managed writes. Views render that data; the module never imports `src/ui/`.

Before coding, record upstream sources/version, paths/precedence, formats, managed leaves/types, deletion semantics, ID constraints, credential authority, activation timing, detection and verification limits. Another Agent's implementation is a structural example, not evidence for the new Agent's policies.

## Extension boundary

Reusing existing capabilities changes runtime only in `src/agents/<id>/` and `src/registry.ts`. Fixtures, npm-script wiring and docs are additional deliverables. A new Codec, Screen shape or operation is an explicit shared-interface extension: state ownership and regression scope for existing Agents; a preceding issue remains optional.

## Layout

Split by responsibility; this is a reference layout, not a required file count.

| File | Owns |
| --- | --- |
| `index.ts` | Agent identity, messages, detection, actions, optional commands |
| `paths.ts`, `constants.ts` | Agent paths/overrides, defaults/bounds/protocol facts |
| `manifest.ts` | Managed-field declarations and mapping |
| `global.ts`, `providers.ts` | Read/seed/emit/save, Provider discovery |
| `status.ts`, `status-dto.ts` | Read-only status and explicit safe diagnostic projection |
| `actions.ts`, `messages.ts` | Screen composition and both locale catalogs |
| `commands.ts` | Agent-owned field declarations and structured handlers |

Codex separates Auth profiles, activation and route restoration; reuse responsibilities rather than copying its credential policy.

## The parts that are easy to get wrong

- **Deletion:** `ManagedWrite.value: undefined` deletes. Blank/Unmanaged TUI choices omit according to their contract; `false` remains boolean. Use shared value coercions. CLI omission preserves; optional `--unset` removes by declaration ID.
- **Freshness:** seed on every form entry, including a persistent Provider Screen's Edit. Re-read again during save; held managed fields can still overwrite external managed changes. Do not claim locking/CAS.
- **Leaves and collections:** emit `options.baseURL` and `options.apiKey`, not a replacement `options` object. Keep metadata on retained model IDs; remove/add only selected members.
- **Safety:** reuse plan/apply, backup/atomic/create-only/remove helpers. Backups use `backupsDirFor(configDir)` so one Agent's retention cannot prune another's. Preserve malformed originals after explicit recovery consent; preflight before command mutation.
- **Credentials:** model upstream precedence explicitly. Never export arbitrary model/header objects or credential-bearing URL components in diagnostic DTOs; preserving them on disk does not authorize printing them.
- **Strings:** Agent keys belong in its `messages.ts`, under a unique namespace, in `en` and `zh-Hans`. Reuse shared shell keys. Registry merging rejects duplicates; `Action.detailKey` and `WriteReport.activateKey` carry Agent-specific descriptions.
- **Detection:** only cheap local file/directory checks; no process execution or Provider requests. Override rules must keep scratch homes isolated.
- **Limits:** unsupported stores/formats/activation paths get findings and documentation. Record live compatibility assumptions in [register §1](<../Important Documentation.md#1-blocking-unknowns>).

## Non-interactive commands

Declare `AgentCommands` fields/handlers inside the module. Seed from disk without TUI defaults, validate the resulting proposal and reuse `executeOperation`/commit. Do not drive Screen callbacks or add Agent-ID branches to shared parsing/UI. State supported commands explicitly; neither existing Agents nor both surfaces have automatic feature parity.

## Register it

Import the module statically and append it to [registry.ts](../src/registry.ts). Never scan paths for dynamic imports: the published bundle cannot resolve them. Update Agent-enumerating fixtures for discovery, selection, command capabilities and locale parity.

## Prove it

Use a separate `mkdtemp` home and placeholder credentials. Register a fixture in both `verify:*` and sequential `npm test`; add its scope to [the map](verification.md#fixture-map). Assert:

- unmanaged siblings survive at the deepest managed nesting; retained collection members keep metadata;
- blank/unset deletes, omitted CLI fields preserve, and valid booleans retain their types;
- save-time reread and each Edit entry see current disk state;
- backups rotate per basename, originals survive recovery, POSIX modes and no-op/dry-run zero writes hold;
- secrets/control sequences stay out of output, including indirect metadata and errors;
- malformed/partial failures report committed files, rollback and retry behavior;
- every Screen key (`labelKey`, `helpKey`, `detailKey`, choices) resolves in both locales.

Import `src/registry.js` before resolving messages. Walk read-only `run()` paths; do not submit or confirm writes merely to inspect a Screen. Deliberately mutate a preservation/deletion path and prove the assertion fails; restore and rerun. Select remaining checks in [verification](verification.md), link actual environments/results from a concise register §9 summary, and apply [Trace → Distill → Prune](../AGENTS.md#knowledge-base-self-evolution-specification-tdp-loop) to the affected rules.

## If the config needs a new Codec

Reuse JSON/JSONC/TOML first. A new Codec requires a reader producing `JsonObject`, a strict write-permission check, a `ManagedWrite[]` editor and typed `ConfigParseError` presentation. Recheck rendered output before committing.

For comment-bearing formats, parse-and-reserialize loses unmanaged text. Prove an empty write list is byte-identical across a representative corpus and unrelated bytes survive managed edits. Include malformed input, scalar-parent insertion, inline structures, deletion, depth bounds and prototype-sensitive own keys. Python `tomllib` parity excludes ccset's deliberate TOML extensions; do not erase them to satisfy the wrong oracle.
