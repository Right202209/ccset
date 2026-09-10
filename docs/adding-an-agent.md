# Adding an agent

Use the existing Claude Code, opencode, and Codex modules as examples of the
same extension boundary with different file layouts. An integration includes
its runtime module, registry entry, verification fixtures, and documentation.
The existing JSON, JSONC, and TOML Codecs are available for reuse.

Read [`CONTEXT.md`](../CONTEXT.md) for the vocabulary (Screen, Frame, Agent,
Provider) before starting. Read [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the
bar a new integration has to clear; this guide only covers the mechanics.

## What you are actually building

An agent module turns files on disk into the five `ActionResult` shapes in
`src/types.ts` — `form`, `list`, `status`, `confirm`, `message` — and turns a
submitted form back into writes. It never imports from `src/ui/`. If you find
yourself wanting to, the shape you need is missing from `types.ts` and that is
the change to propose.

## Extension boundary

PRD §2.2 criterion 5 defines the Agent module and `src/registry.ts` as the
extension boundary. The module is a directory with multiple files.
An Agent reusing existing capabilities
changes no runtime code outside its module except the registry. Fixtures,
`package.json` wiring, and docs are expected additional changes.

If you need another runtime change, identify the responsibility first:

- **You need a string.** Ship it in your own `messages.ts` (below), not in
  `src/i18n/en.ts`.
- **You need a path helper.** Put it in your module's `paths.ts`. `src/core/paths.ts`
  holds only `resolveHome`, `backupsDirFor`, and `listNamedFiles`, which takes
  your naming rule as a callback.
- **You need a shared capability.** Make the core/interface change explicit and
  separately reviewable, with checks for existing Agents as well as the new one.
  It may be part of a complete implementation proposal; a preceding issue is
  optional under [CONTRIBUTING.md](../CONTRIBUTING.md).

## Layout

Use focused files within the module and follow the executable quality limits.
This is a common layout, not a required file count:

| File | Holds |
| --- | --- |
| `index.ts` | The `Agent` object: `id`, `name`, `messages`, `detect`, `getActions`, and optional `commands` |
| `manifest.ts` | **Data only.** Every managed key, declared once |
| `constants.ts` | Template defaults, enum values, wire details |
| `paths.ts` | Where the config lives, and where backups go |
| `global.ts` | `seed*` / `emit*` / `save*` for the top-level config |
| `providers.ts` | The same for a provider, plus discovery |
| `status.ts` | The read-only view. Reads everything, writes nothing |
| `actions.ts` | Assembles the menu actions |
| `messages.ts` | Your strings, under a unique Agent namespace, in both locales |
| `commands.ts` | Command declarations and handlers, when exposing Non-interactive commands |
| `status-dto.ts` | Structured, secret-free status data shared with command presentation |

Codex also separates credential handling into `auth.ts`, `activate.ts`, and
`provider-use.ts`, because its Auth profiles live outside the config document.
Use additional files when the Agent's responsibilities need them.

## The parts that are easy to get wrong

### Deletion is not an optimisation

A `ManagedWrite` with `value: undefined` means **delete the key**. A blank or
Unmanaged TUI choice must remove a key when its field contract says to omit it,
rather than write `""` or `null`. Proxy-off deletes its environment keys, while
a supported boolean setting such as `autoupdate = false` remains a value.
Use `textOrUndefined`, `intOrUndefined`, and `csvOrUndefined` in
`src/core/values.ts` for the corresponding form coercions.

### Re-read immediately before writing

Agents rewrite their own config while ccset is open. `save*` re-reads the target
inside the save, not at launch. A parse from when the screen opened will clobber
whatever the agent wrote in between.

### Never write a subtree wholesale

Write the leaf, not its parent. opencode's provider options look like a natural
object to assign:

```ts
// WRONG: destroys options.headers, and anything else the user put there.
{ path: ['provider', id, 'options'], value: { baseURL, apiKey } }

// RIGHT: two leaves, and every unmanaged sibling survives.
{ path: ['provider', id, 'options', 'baseURL'], value: baseURL }
{ path: ['provider', id, 'options', 'apiKey'], value: apiKey }
```

The same applies to a map whose entries the user also edits. opencode's
`provider.<id>.models` is merged per key — an id already on disk is left
untouched, a new one is added, one dropped from the list is deleted — because
writing the map outright would discard per-model settings. That needs the
current disk state, so `emitProvider` takes it as an argument.

### Backups belong to you

`backupFile(dir, path)` takes the directory. Pass `backupsDirFor(yourConfigDir)`
so your rotation cannot evict another agent's backups, and so ccset never writes
into a directory the target agent prunes on its own schedule.

### Strings ship with the module

```ts
export const yourMessages: Record<string, Record<string, string>> = {
  en: { 'yourAgent.field.apiKey': 'API key' },
  'zh-Hans': { 'yourAgent.field.apiKey': 'API 密钥' },
}
```

Use a unique Agent namespace for every key. The registry merges these and **throws
on a duplicate**, so you cannot silently redefine a shell string. Reuse the
shared vocabulary in `src/i18n/en.ts` — `field.baseUrl`, `action.status`, every
`write.*` and `confirm.*` line — rather than restating it.

Two fields exist because two agents disagreed:

- `Action.detailKey` — both agents label a screen "Global settings" while
  describing different files.
- `WriteReport.activateKey` — Claude Code needs `claude --settings <path>`;
  opencode reads its config on start and has nothing to activate.

### Say what you cannot do

Name an unsupported format, credential store, or activation path in Status
and document the verification gap. Record unresolved compatibility assumptions
in `Important Documentation.md` §1 instead of treating a synthetic fixture as a
live compatibility result.

For example, opencode's JSONC gap was resolved with a format-preserving Codec
(ADR 0004): an existing `.jsonc` is now the managed target and its legacy `.json`
stays untouched. Reuse that selection and Codec behavior; the separate live
merge-order check remains recorded as U6.

## Non-interactive commands

An Agent may expose `commands` through the `AgentCommands` interface. Declare
its command fields and handlers inside the Agent module so the shared parser
and dispatcher need no Agent-specific branches. An Agent without `commands`
serves only the TUI; document the supported surface explicitly.

Commands are Managed patches: supplied fields change, omitted fields preserve
the disk state, and `--unset` removes a managed key. Seed from disk without TUI
template defaults, validate the complete proposal, and reuse the operation and
commit core. Do not implement commands by invoking Screen callbacks. Follow the
[command specification](milestone-3-non-interactive.md) and ADRs 0006–0014 for
secret sources, preflight, output, and exit contracts.

## Register it

```ts
import { yourAgent } from './agents/your-agent/index.js'

export const AGENTS: Agent[] = [claudeCode, opencode, codex, yourAgent]
```

That is the whole registry change. No dynamic `import()`, no scanning: the
published artifact is a bundle and a bundler cannot resolve a scanned path.

Check detection, agent selection, and the new `--agent <id>` value. Update
fixtures that enumerate supported Agents, including locale parity and command
capabilities where the new Agent exposes them.

## Prove it

A new Agent needs its own fixture in `scripts/`, running against a `mkdtemp`
home. Wire it into a `verify:*` command **and** the sequential `npm test` chain in
`package.json`, and add it to the [verification map](verification.md#fixture-map).
Cover at minimum:

- unmanaged keys survive a save, including siblings of a managed key at the
  deepest level your config nests;
- a blank field omits its key entirely — no `null`, no `""`;
- choosing Unmanaged or disabling a proxy deletes its keys, while boolean
  settings retain real boolean values;
- secrets are masked in Status and never appear whole;
- backups rotate to `MAX_BACKUPS` and are `0600` on POSIX.

Then **mutate your own code and check the gate fails.** `verify:opencode` was
run against four deliberate bugs — a wholesale models write, a skipped delete, a
blank written as `""`, and a replaced `options` subtree — and each turned it
red. A data-safety gate that has never failed has not been tested.

Then walk your screens and check every string resolved. `t()` returns the key on
a miss, so a typo in `messages.ts` paints `yourAgent.field.apiKey` at the user
rather than throwing. `verify-codex-auth.ts` has the walk: it runs each action,
descends through list items — `run()` only, never `confirm()` or `submit()`,
which are the writes — and asserts both that painted strings are not unresolved
keys and that every `labelKey`, `helpKey`, `detailKey` and choice label exists.
Import `src/registry.js` in the fixture: `registerMessages` is a load-time side
effect of that module, and without it your whole catalog reads as missing.

Ship both locales while you are in `messages.ts`: an `en` block and a `zh-Hans`
block. At runtime a key your agent has not translated falls back to English
rather than to the raw key, but that is no licence to skip it:
`verify:i18n-zh` holds every agent's two catalogs key-for-key identical and
turns red on a missing block or a missing key. An untranslated agent is a red
gate, not a silent gap.

Record what you ran in `Important Documentation.md`. A passing local build is
not evidence for a platform gate.

## If the config needs a new Codec

JSON, JSONC, and TOML are already supported. Reuse their readers, strict checks,
and editors when they match the Agent's format. A format that needs another
Codec is a shared-core change outside the Agent module and registry; state
that scope explicitly and verify existing formats as well.

`ConfigFile` carries a `codec`, and `src/core/config-file.ts` dispatches on it.
Adding one means:

- a reader that produces a `JsonObject`, so agents and Status never learn the
  format;
- a strict checker, separate from the reader, that decides whether ccset may
  rewrite the file at all. A file that fails it becomes the same "back it up and
  start fresh" confirm a malformed JSON target does;
- a writer that applies `ManagedWrite[]`.

The writer is where the guarantee lives. If the format carries anything a parse
throws away — comments, blank lines, key order, alignment — then rebuilding the
document from a parse deletes it, and "unmanaged keys survive" becomes false the
first time someone saves. `src/core/toml/` does not rebuild: it records where
each value *is* and splices spans, so every byte it did not write is copied
through. Prove that with a corpus that must survive an empty write list
byte-identically before you write anything else.

`ConfigParseError` is the base class the save flow catches. Subclass it with
your own `messageKey` and `titleKey` so the user is told which format the file
failed to be, rather than being told a TOML file is bad JSON.
