# U6 research: opencode config loading with both `opencode.json` and `opencode.jsonc` present

Researched 2026-09-01 against opencode v1.18.25 (sources pinned inline).

Repo note: `github.com/sst/opencode` now redirects to `github.com/anomalyco/opencode`
(the GitHub API returned `301 Moved Permanently` for the sst path). Latest release at
research time was `v1.18.25` (published 2026-08-28, tag commit
`cb7d8b2f5e44876ef98b661dc10590c915af3a9f`). All source citations below pin that tag:
`https://raw.githubusercontent.com/anomalyco/opencode/v1.18.25/...`.
Config loading lives at `packages/opencode/src/config/` (confirmed unchanged from the
path the question suggested, though several of its imports moved to
`packages/core/src/`).

## Answer

opencode never picks one of `opencode.json` / `opencode.jsonc` outright. In every
directory it probes — global, project, `.opencode`, and the admin-managed directory —
it loads **both** files when both exist and deep-merges them per key, with
`opencode.jsonc` always merged **last**, so `opencode.jsonc` wins on conflicting keys.
In the global directory it additionally merges the legacy `~/.config/opencode/config.json`
first. The deciding code is in `loadGlobal` in
`packages/opencode/src/config/config.ts` (lines 272-274 at v1.18.25):

```ts
result = mergeConfig(result, yield* loadFile(path.join(Global.Path.config, "config.json"), env))
result = mergeConfig(result, yield* loadFile(path.join(Global.Path.config, "opencode.json"), env))
result = mergeConfig(result, yield* loadFile(path.join(Global.Path.config, "opencode.jsonc"), env))
```

https://raw.githubusercontent.com/anomalyco/opencode/v1.18.25/packages/opencode/src/config/config.ts

Missing files are skipped silently (`readFileStringSafe` returns `undefined` on
`NotFound`, and `loadFile` returns `{}` for empty text, config.ts lines 186 and
253-258), so the order above is the effective precedence:
`opencode.jsonc` > `opencode.json` > `config.json` per key.

The docs describe merging between *locations* ("Configuration files are merged
together, not replaced.") but never document the `.json` vs `.jsonc` behavior inside
one directory — that is determinable only from the code.

## Evidence

### 1. JSONC (comments and trailing commas) is accepted for every locally loaded config file

Every config file opencode reads from disk goes through one parse function,
`ConfigParse.jsonc`, which uses the `jsonc-parser` npm package (pinned at `3.3.1` in
`packages/opencode/package.json`) with trailing commas explicitly enabled:

```ts
import { type ParseError as JsoncParseError, parse as parseJsoncImpl, printParseErrorCode } from "jsonc-parser"
...
export function jsonc(text: string, filepath: string): unknown {
  const errors: JsoncParseError[] = []
  const data = parseJsoncImpl(text, errors, { allowTrailingComma: true })
```

https://raw.githubusercontent.com/anomalyco/opencode/v1.18.25/packages/opencode/src/config/parse.ts (lines 3 and 8-10)

`jsonc-parser`'s `parse` tolerates comments by default, so both comments and trailing
commas are accepted. This parse path is used for global, project, `.opencode`,
managed-directory, `OPENCODE_CONFIG`, and `OPENCODE_CONFIG_CONTENT` inputs
(all funnel through `loadConfig` -> `ConfigParse.jsonc`, config.ts line 240), and also
when opencode re-reads a config to rewrite it (config.ts lines 643, 664, 672-673).
Exception: remote config fetched over HTTP (`.well-known/opencode` and org config) is
parsed with `Schema.fromJsonString`, i.e. strict JSON without comments (config.ts
line 222).

### 2. Global config: three candidate files, probed in a fixed order, all merged

`loadGlobal` unconditionally attempts all three files (see Answer for the merge
lines 272-274). Missing files are no-ops, and if none exists opencode seeds one —
and it seeds `opencode.jsonc`, not `opencode.json`:

```ts
if (!Flag.OPENCODE_CONFIG && !Flag.OPENCODE_CONFIG_DIR && !Flag.OPENCODE_CONFIG_CONTENT) {
  const file = globalConfigFile()
  if (!existsSync(file)) {
    yield* fs
      .writeWithDirs(file, JSON.stringify({ $schema: "https://opencode.ai/config.json" }, null, 2))
```

config.ts lines 264-271. `globalConfigFile()` itself prefers `.jsonc`:

```ts
function globalConfigFile() {
  const candidates = ["opencode.jsonc", "opencode.json", "config.json"].map((file) =>
    path.join(Global.Path.config, file),
  )
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return candidates[0]
}
```

config.ts lines 140-148. The global directory is
`path.join(xdgConfig, "opencode")` — i.e. `~/.config/opencode` (or `$XDG_CONFIG_HOME/opencode`)
— set in `packages/core/src/global.ts` lines 7-10:
https://raw.githubusercontent.com/anomalyco/opencode/v1.18.25/packages/core/src/global.ts

A legacy TOML `~/.config/opencode/config` is also migrated if present (config.ts
lines 276-290). Consequence: a fresh opencode install creates
`~/.config/opencode/opencode.jsonc` containing only `$schema`, and any keys a tool
later writes to `opencode.json` in that directory will be overridden on conflict by
that `opencode.jsonc` (since it merges last) — though a bare `$schema`-only file
overrides nothing in practice.

### 3. Project config: both files probed per directory; `.json` merges first, `.jsonc` last

Project-level files come from `ConfigPaths.files`, which walks up from the current
directory to the worktree root, probing both names in **each** directory:

```ts
export const files = Effect.fn("ConfigPaths.projectFiles")(function* (
  name: string,
  directory: string,
  worktree?: string,
) {
  const afs = yield* FSUtil.Service
  return (yield* afs.up({
    targets: [`${name}.jsonc`, `${name}.json`],
    start: directory,
    stop: worktree,
  })).toReversed()
})
```

https://raw.githubusercontent.com/anomalyco/opencode/v1.18.25/packages/opencode/src/config/paths.ts (lines 10-21)

`FSUtil.up` checks each target in array order at every level, nearest directory
first (fs-util.ts lines 168-183):

```ts
const up = Effect.fn("FileSystem.up")(function* (options: { targets: string[]; start: string; stop?: string }) {
  const result: string[] = []
  let current = options.start
  while (true) {
    for (const target of options.targets) {
      const search = join(current, target)
      if (yield* fs.exists(search)) result.push(search)
    }
```

https://raw.githubusercontent.com/anomalyco/opencode/v1.18.25/packages/core/src/fs-util.ts

So `up` yields, per directory, `.jsonc` before `.json`, and nearer directories before
farther ones; `.toReversed()` then flips the whole list. The reversed list is merged
in iteration order, each file overriding the previous (config.ts lines 420-424):

```ts
if (!Flag.OPENCODE_DISABLE_PROJECT_CONFIG) {
  for (const file of yield* ConfigPaths.files("opencode", ctx.directory, ctx.worktree).pipe(Effect.orDie)) {
    yield* merge(file, yield* loadFile(file, authEnv), "local")
  }
}
```

Net effect, per key: within any one directory, `opencode.jsonc` overrides
`opencode.json`; and a directory nearer the cwd overrides the worktree root.
(Project config can be disabled entirely with `OPENCODE_DISABLE_PROJECT_CONFIG`.)

### 4. `.opencode` directories and the managed directory use the same `.json` then `.jsonc` order

```ts
for (const dir of directories) {
  if (dir.endsWith(".opencode") || dir === Flag.OPENCODE_CONFIG_DIR) {
    for (const file of ["opencode.json", "opencode.jsonc"]) {
```

config.ts lines 438-440. Same pattern for the admin-controlled directory:

```ts
const managedDir = ConfigManaged.managedConfigDir()
if (existsSync(managedDir)) {
  for (const file of ["opencode.json", "opencode.jsonc"]) {
```

config.ts lines 530-532. The managed directory is
`/Library/Application Support/opencode` (macOS), `/etc/opencode` (Linux),
`%ProgramData%\opencode` (Windows) — `packages/opencode/src/config/managed.ts`,
`systemManagedConfigDir()`:
https://raw.githubusercontent.com/anomalyco/opencode/v1.18.25/packages/opencode/src/config/managed.ts

### 5. Merge semantics: per key; plain objects deep-merge, arrays are replaced (one exception)

All of the above merges go through remeda's `mergeDeep` (pinned `2.26.0` in the root
`package.json` catalog), which only recurses when **both** sides hold plain objects;
any other overlapping value — including arrays — is taken from the later source:

```ts
function mergeDeepImplementation<Destination extends object, Source extends object>(
  destination: Destination,
  source: Source,
): MergeDeep<Destination, Source> {
  const output = { ...destination, ...source } as ...
  ...
  if (!isPlainObject(destinationValue)) {
    // The value in destination is not a mergable object so the value from
    // source (which was already copied in the shallow merge) would be used
    // as-is.
    continue;
  }
```

https://raw.githubusercontent.com/remeda/remeda/v2.26.0/packages/remeda/src/mergeDeep.ts

The one exception is the `instructions` array, which opencode concatenates and
deduplicates at the instance-level merge (global -> project -> `.opencode` -> etc.):

```ts
function mergeConfigConcatArrays(target: Info, source: Info): Info {
  const merged = mergeConfig(target, source)
  if (target.instructions && source.instructions) {
    merged.instructions = Array.from(new Set([...target.instructions, ...source.instructions]))
  }
  return merged
}
```

config.ts lines 46-52, used at line 366 (`merge` in `loadInstanceState`) — but note
the global-only merges in `loadGlobal` (lines 272-274) use plain `mergeConfig`, so
even `instructions` is replaced rather than concatenated when the conflict is purely
between global files. Side note: the comment above `mergeConfig` (lines 40-41) claims
it "concatenates array fields instead of replacing them", but its body is a plain
`mergeDeep` — a stale/misleading code comment, contradicted by the code right below it.

### 6. Where `allowComments` and `allowTrailingCommas` actually live

They exist **only** as non-standard root keys of the generated JSON schema published at
`https://opencode.ai/config.json` (fetched 2026-09-01; the last two lines of the file):

```json
  "allowComments": true,
  "allowTrailingCommas": true
}
```

https://opencode.ai/config.json

They are injected by the schema generator in the repo, not by any validation schema:

```ts
  restored.allowComments = true
  restored.allowTrailingCommas = true
  return restored
```

https://raw.githubusercontent.com/anomalyco/opencode/v1.18.25/packages/opencode/script/schema.ts (lines 21-22)

Findings about these keys:

- Not in the docs: the docs page and its Markdown source
  (`packages/web/src/content/docs/config.mdx` at v1.18.25) contain zero occurrences of
  `allowComments` or "trailing".
- Not in a Zod schema: opencode validates config with **Effect Schema**, not Zod
  (`ConfigV1.Info` decoded via `EffectSchema.decodeUnknownExit` in parse.ts, line 42).
  The generator builds the JSON schema via `Schema.toJsonSchemaDocument` and then
  tacks the two keys on (schema.ts lines 12-23).
- Not read by the loader: opencode's own JSONC tolerance comes from `jsonc-parser`'s
  hardcoded `{ allowTrailingComma: true }` (parse.ts line 10); nothing in the runtime
  consults the schema keys. What consumes them (editor language servers, etc.) is not
  determinable from these primary sources; within the schema they are inert metadata.

### 7. What the latest docs say (fetched 2026-09-01, site reports "Last updated: Sep 1, 2026")

The live page matches the repo Markdown at v1.18.25 (last commit touching that file:
2026-08-07). Verbatim, under "Locations":

> Configuration files are merged together, not replaced.

> Configuration files are merged together, not replaced. Settings from the following config locations are combined. Later configs override earlier ones only for conflicting keys. Non-conflicting settings from all configs are preserved.

The documented precedence order (1-8):

> 1. **Remote config** (from `.well-known/opencode`) - organizational defaults
> 2. **Global config** (`~/.config/opencode/opencode.json`) - user preferences
> 3. **Custom config** (`OPENCODE_CONFIG` env var) - custom overrides
> 4. **Project config** (`opencode.json` in project) - project-specific settings
> 5. **`.opencode` directories** - agents, commands, plugins
> 6. **Inline config** (`OPENCODE_CONFIG_CONTENT` env var) - runtime overrides
> 7. **Managed config files** (`/Library/Application Support/opencode/` on macOS) - admin-controlled
> 8. **macOS managed preferences** (`.mobileconfig` via MDM) - highest priority, not user-overridable

https://opencode.ai/docs/config/ and
https://raw.githubusercontent.com/anomalyco/opencode/v1.18.25/packages/web/src/content/docs/config.mdx

Docs mentions of `.jsonc` are limited to: the "Format" section
("OpenCode supports both **JSON** and **JSONC** (JSON with Comments) formats."), the
managed-settings section ("Drop an `opencode.json` or `opencode.jsonc` file in the
system managed config directory"), and TUI config ("Use a dedicated `tui.json` (or
`tui.jsonc`) file for TUI-specific settings.").

Docs vs code discrepancies (incomplete rather than contradictory):

- Docs name only `~/.config/opencode/opencode.json` for global config; the code also
  loads `config.json` and `opencode.jsonc`, and prefers `opencode.jsonc` both in
  precedence and when writing/seeding the file (sections 2 and 3 above).
- Docs never state the within-directory `.json` vs `.jsonc` precedence — only the
  code does (`.jsonc` wins).
- Docs' tier ordering matches the code's merge order exactly (remote -> global ->
  `OPENCODE_CONFIG` -> project files -> `.opencode` dirs -> `OPENCODE_CONFIG_CONTENT`
  -> managed files -> MDM plist), verified against `loadInstanceState` (config.ts
  lines 370-548).

## What this means for ccset

- Writing only `opencode.json` is safe in the sense that it is always loaded — but it
  is **not** the whole story: if `opencode.jsonc` exists in the same directory, every
  key present in the `.jsonc` file overrides what ccset wrote to `opencode.json`,
  silently. A warning about a coexisting `opencode.jsonc` is warranted, and the
  warning should say the `.jsonc` file wins rather than that behavior is undefined.
- Extra care for the global directory: opencode itself creates
  `~/.config/opencode/opencode.jsonc` (with just `$schema`) on first run, so an empty
  or near-empty `.jsonc` there is normal and harmless today, but any keys a user later
  adds to it outrank ccset's `opencode.json`. Preferring to write `opencode.jsonc`
  when it exists (as opencode's own `globalConfigFile()` does) would match the tool's
  native behavior.
- ccset can rely on JSONC being accepted (comments and trailing commas) wherever it
  might read opencode config, but remote/org config over HTTP is strict JSON.
- Merging is per key with plain objects deep-merged and arrays replaced (except
  `instructions`, which is concatenated only at the instance-level merge) — so
  ccset should not assume array-valued keys (other than `instructions`) union across
  files.

## Unresolved

- The intended consumer of the schema's `allowComments`/`allowTrailingCommas` keys.
  Primary sources show only that the generator emits them and the runtime ignores
  them. Whether any editor honors them is not settled here.
- TUI config (`tui.json` / `tui.jsonc`) loading was not traced line by line (it lives
  outside `packages/opencode/src/config/`); the docs say `tui.json` or `tui.jsonc` is
  supported, and `packages/opencode/script/schema.ts` generates a matching
  `tui.json` schema, but the `.json` vs `.jsonc` precedence for that file specifically
  was not verified in code.
- Behavior at commit granularity other than v1.18.25: the repo is under active
  development (an Effect-ts refactor is visible in these files); the pinned findings
  may drift in later releases.
