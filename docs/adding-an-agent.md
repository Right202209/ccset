# Adding an agent

This guide is written from adding the second one, and updated from the third.
opencode took nine files under `src/agents/opencode/`, one line in
`src/registry.ts`, and one verification fixture — and it is the reason several
things in `src/core/` look the way they do now. Codex took ten files and the
same one registry line, but it also needed a new codec, which is a different
kind of change and is covered at the end.

Read [`CONTEXT.md`](../CONTEXT.md) for the vocabulary (Screen, Frame, Agent,
Provider) before starting. Read [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the
bar a new integration has to clear; this guide only covers the mechanics.

## What you are actually building

An agent module turns files on disk into the five `ActionResult` shapes in
`src/types.ts` — `form`, `list`, `status`, `confirm`, `message` — and turns a
submitted form back into writes. It never imports from `src/ui/`. If you find
yourself wanting to, the shape you need is missing from `types.ts` and that is
the change to propose.

## The two files rule

PRD §2.2 criterion 5: adding an agent touches **exactly two files** — your
module and `src/registry.ts`. That is enforceable, not aspirational. If you need
to edit anything else under `src/`, one of these is true:

- **You need a string.** Ship it in your own `messages.ts` (below), not in
  `src/i18n/en.ts`.
- **You need a path helper.** Put it in your module's `paths.ts`. `src/core/paths.ts`
  holds only `resolveHome`, `backupsDirFor`, and `listNamedFiles`, which takes
  your naming rule as a callback.
- **You need something core almost does.** Propose the core change as its own
  issue first, the way #33 preceded #34. Do not smuggle it into the agent PR.

## Layout

Nine files, none over 300 lines. `manifest.ts` and `providers.ts` are the two
that grow; if either passes 300, logic has usually leaked into the manifest.

| File | Holds |
| --- | --- |
| `index.ts` | The `Agent` object: `id`, `name`, `messages`, `detect`, `getActions` |
| `manifest.ts` | **Data only.** Every managed key, declared once |
| `constants.ts` | Template defaults, enum values, wire details |
| `paths.ts` | Where the config lives, and where backups go |
| `global.ts` | `seed*` / `emit*` / `save*` for the top-level config |
| `providers.ts` | The same for a provider, plus discovery |
| `status.ts` | The read-only view. Reads everything, writes nothing |
| `actions.ts` | Assembles the menu actions |
| `messages.ts` | Your strings, namespaced by agent id |

Codex adds two more, because its credential lives outside its config document:
`auth.ts` (the sidecars) and `activate.ts` (the switch). If your agent keeps its
key in the settings file, you will not need either.

## The parts that are easy to get wrong

### Deletion is not an optimisation

A `ManagedWrite` with `value: undefined` means **delete the key**. Turning a
setting off has to remove it, not write `""` or `null`. Without that, ccset
reports a successful save while the old value is still in the file. Every
"blank means omit" path goes through `textOrUndefined`, `intOrUndefined`, or
`csvOrUndefined` in `src/core/values.ts`.

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
}
```

Namespace every key with your agent id. The registry merges these and **throws
on a duplicate**, so you cannot silently redefine a shell string. Reuse the
shared vocabulary in `src/i18n/en.ts` — `field.baseUrl`, `action.status`, every
`write.*` and `confirm.*` line — rather than restating it.

Two fields exist because two agents disagreed:

- `Action.detailKey` — both agents label a screen "Global settings" while
  describing different files.
- `WriteReport.activateKey` — Claude Code needs `claude --settings <path>`;
  opencode reads its config on start and has nothing to activate.

### Say what you cannot do

opencode also loads a JSONC config, and ccset cannot round-trip a comment
through `JSON.parse`. Rather than write it anyway or ignore it, the Status
screen reports the file and warns that the save may not be the config opencode
reads. An unknown belongs in `Important Documentation.md` §1, handled like
U1–U5 — not papered over in code.

## Register it

```ts
export const AGENTS: Agent[] = [claudeCode, opencode]
```

That is the whole registry change. No dynamic `import()`, no scanning: the
published artifact is a bundle and a bundler cannot resolve a scanned path.

With a second agent registered, the agent-selection Screen starts appearing
(PRD §4.1) and `--agent <id>` gains a second legal value. Both were dead code
until opencode landed, and both had fixtures that needed updating.

## Prove it

A new agent needs its own gate in `scripts/`, wired into `package.json` the way
the others are, running against a `mkdtemp` home. Cover at minimum:

- unmanaged keys survive a save, including siblings of a managed key at the
  deepest level your config nests;
- a blank field omits its key entirely — no `null`, no `""`;
- turning a managed choice off deletes the key;
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

## If your agent's config is not JSON

This is a core change, and it is not covered by the two-files rule — say so in
the PR rather than claiming criterion 5 for it.

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
