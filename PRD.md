# Product Requirements Document (PRD)

## Project Name

ccset — npm package `@droite/ccset`

**Status:** v2, revised after design review. Supersedes `PRD.tmp.md`.

---

## 1. Overview

### 1.1 Background

Developers connecting Claude Code to third-party Anthropic-compatible API services
(routers, proxies, resellers) must hand-edit JSON settings files. The fields are
undocumented in aggregate, the file layout is conventional rather than enforced, and
a typo produces a config that looks correct and silently fails.

ccset is a terminal UI that writes those files correctly. It focuses on Claude Code
today. The architecture keeps a second agent additive, but does not build for one
speculatively.

### 1.2 Product Positioning

A TUI that generates and edits Claude Code settings files, and reports what is on
disk. **ccset generates configuration; it does not activate it.** Activation is the
user running `claude --settings <path>`, and ccset's job is to make that command
correct and copy-ready.

### 1.3 Target Users

- Developers pointing Claude Code at a third-party Anthropic-compatible endpoint.
- Users who keep several provider configs and switch between them.
- Users who would rather not hand-edit JSON.

Not served in v1: unattended/scripted deployment (see §5.6 and Milestone 3).

---

## 2. Goals and Success Criteria

### 2.1 Goals

- Configure Claude Code's global settings and any number of third-party provider
  settings files without hand-editing JSON.
- Never damage configuration the user already has.
- Run via `npx @droite/ccset` with no install step.
- Keep adding a second agent a two-file change.
- Keep all user-facing strings translatable without a rewrite.

### 2.2 Success Criteria

1. From launch, the default path to a written global config is **≤ 3 interactions**
   (menu select → review screen → save).
2. Generated files are valid JSON conforming to Claude Code's settings shape, and
   `claude --settings <generated-path>` connects to the configured provider. ccset
   prints that exact command, with an absolute path, on every successful write.
3. Re-running ccset against an existing config preserves **every** key ccset does
   not manage (§6.4), verified by byte-comparison of unmanaged subtrees.
4. Verified stable on macOS and Linux terminals. Windows is best-effort (§5.2).
5. Adding an Agent touches exactly two files: a new module under `src/agents/`
   implementing the `Agent` interface, and one line in `src/registry.ts`.
6. Every file ccset writes that can contain a credential is mode `0600` on POSIX.

### 2.3 Non-Goals (v1)

- Activating a provider (no shell rc edits, no copying provider files over
  `settings.json`, no launcher).
- Writing `~/.claude.json` when it already exists (§4.2.1).
- Non-interactive / flag-driven configuration (§5.6).
- Managing secrets outside the settings file (keychain, `pass`, `apiKeyHelper`) —
  deferred to Milestone 2 pending the experiment in §9.3.
- Validating that a model name exists on a provider.

---

## 3. User Stories

1. As a third-party API user, I enter a base URL, token and model, and get a
   provider file plus the exact command to use it.
2. As a returning user, I open ccset and see my current settings as the starting
   state, not a blank form, so I can see what I am about to change.
3. As a user with six provider files, I see all of them listed with masked tokens
   and a copy-ready command for each.
4. As a network-restricted user, I toggle a proxy on or off — and turning it *off*
   actually removes the proxy variables from the file.
5. As a user whose provider just broke, I run a connection test from inside ccset
   and learn whether the endpoint or the token is at fault.

---

## 4. Functional Requirements

### 4.1 Interaction Model

**Defaults-first with a review screen.** ccset does not interrogate the user field
by field. It computes a complete proposed configuration, renders it as an editable
form, and writes only when the user explicitly saves.

Seed order for every field: **existing file value → template default → render.**
An existing config is never overwritten by a template default merely because the
user opened the screen.

Main menu (generated from the registry, §4.3):

| Entry | Notes |
| --- | --- |
| Global settings | Edit `~/.claude/settings.json` |
| Providers | List / add / edit `~/.claude/settings.<name>.json` |
| Status | Read-only view of everything on disk (§4.2.4) |
| Test connection | Opt-in network check (§4.2.6) |
| Exit | |

When the registry holds exactly one agent, ccset skips the agent-selection screen
and enters it directly. The screen appears only when a second agent is registered.

### 4.2 Functional Details (Claude Code)

#### 4.2.1 `~/.claude.json` — create-if-missing only

This file is Claude Code's live state store: ~79 KB, 37 top-level keys, per-project
history and MCP config under `projects`, plus counters Claude Code rewrites
continuously. Observed rewrite cadence during review: a fresh backup roughly every
five minutes.

- **File absent** → create `{"hasCompletedOnboarding": true}`, mode `0600`.
- **File present** → parse read-only. Report `hasCompletedOnboarding` in Status.
  **ccset never writes this file.** If the flag is missing or `false`, ccset prints
  the one-line fix for the user to apply, and does not apply it.

Rationale: a read-modify-write here races an active writer. A stale merge silently
discards whatever Claude Code wrote in between — up to all project entries — to set
a boolean that is already `true` for anyone who has launched Claude Code once. The
only user who benefits is one for whom the file does not exist, which is exactly the
case with no concurrent writer and nothing to lose.

#### 4.2.2 `~/.claude/settings.json` — global settings

Managed keys (§6.4 defines the semantics; this is the manifest):

| Key | Type | Default | Deleted when |
| --- | --- | --- | --- |
| `env.HTTPS_PROXY` | string | `http://127.0.0.1:7890` | proxy disabled |
| `env.HTTP_PROXY` | string | `http://127.0.0.1:7890` | proxy disabled |
| `env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | `"1"`/`"0"` | `"1"` | set to unmanaged |
| `env.CLAUDE_CODE_ATTRIBUTION_HEADER` | `"1"`/`"0"` | `"0"` | set to unmanaged |
| `env.DISABLE_INSTALLATION_CHECKS` | `"1"`/`"0"` | `"1"` | set to unmanaged |
| `env.ENABLE_TOOL_SEARCH` | `"1"`/`"0"` | `"1"` | set to unmanaged |
| `cleanupPeriodDays` | number | `720` | set to unmanaged |
| `model` | string (free text) | `opus[1m]` | cleared |

All eight env names and the two top-level keys were verified present in the shipped
`claude` binary during review (§9.2).

Everything else in the file — `hooks`, `statusLine`, `enabledPlugins`, `effortLevel`,
`tui`, `permissions`, `verbose`, and any key ccset has never heard of — is preserved
byte-for-byte at every nesting level.

#### 4.2.3 `~/.claude/settings.<provider>.json` — provider settings

**Core fields** (always shown):

| Key | Required | Notes |
| --- | --- | --- |
| `env.ANTHROPIC_BASE_URL` | yes | e.g. `https://api.example.com` |
| `env.ANTHROPIC_AUTH_TOKEN` | yes | secret; masked input and display |
| `model` | no | **free text**, no default |

**Advanced fields** (collapsed by default, omitted from output when blank):

| Key | Notes |
| --- | --- |
| `fallbackModel` | `string[]` |
| `env.ANTHROPIC_DEFAULT_OPUS_MODEL` | router model remapping |
| `env.ANTHROPIC_DEFAULT_SONNET_MODEL` | router model remapping |
| `env.ANTHROPIC_DEFAULT_HAIKU_MODEL` | router model remapping |

The model field is **free text with suggestions**, never a closed list — real router
configs use names like `Kiro-5-claude-opus-4-8` that no curated list can anticipate.
It has **no default**: `opus[1m]` is an Anthropic alias, and writing it into a config
pointed at a non-Anthropic endpoint is wrong more often than right. Left blank, the
key is omitted and the global `model` applies.

**Provider name validation.** Allowed: `[A-Za-z0-9_-]+`. Rejected: empty string, any
path separator, and the reserved names `local` and `json` — `local` would produce
`settings.local.json`, colliding with a name Claude Code uses conventionally.

**Editing an existing provider** uses the same seeded review screen as everything
else. There is no "overwrite or merge?" prompt: the form is seeded from the file,
the user edits what they want, and §6.4's manifest semantics apply. Unmanaged keys
in a provider file survive.

#### 4.2.4 Status

Reads and displays, without writing anything:

- `~/.claude.json` — existence and `hasCompletedOnboarding` only.
- `~/.claude/settings.json` — managed keys, plus a count of unmanaged keys preserved.
- **Every** `~/.claude/settings.*.json` except `settings.json`, discovered by glob.
  The filesystem is the only registry; there is no ccset-owned index file, because
  an index would show zero providers for files ccset did not create and would drift
  the moment anyone hand-edits.

Per discovered provider: name, `ANTHROPIC_BASE_URL`, model, **masked** token, and the
copy-ready `claude --settings <absolute-path>` command.

Files that parse but lack `ANTHROPIC_BASE_URL` are listed with a note, not hidden.
Files that fail to parse are listed as error entries; a single broken file never
prevents the screen from rendering.

**Token masking rule:** first 4 and last 4 characters, middle replaced by a fixed-width
run of `•` that does not encode the true length. Applies to Status, the review screen,
logs, and error messages alike.

#### 4.2.5 Save and exit

Writes occur only on explicit Save. Exit prompts for confirmation **only** when the
form holds unsaved edits; otherwise it exits immediately.

#### 4.2.6 Test connection (opt-in)

A distinct menu action, never triggered by Save and never automatic.

- Displays the destination host and asks for confirmation **before** sending.
- Sends one minimal request to `<base_url>/v1/messages` using global `fetch`
  (Node 18+ — no new dependency), with a short timeout.
- Reports HTTP status and a one-line interpretation (reachable / auth rejected /
  DNS failure / timeout).
- **Never echoes the response body**, which can contain the token or provider-side
  detail the user may screenshot.

Rationale for opt-in: a connection test transmits a live credential to a third-party
host. That must be a thing the user chose in the moment, not a side effect of saving
a draft or fixing a typo.

### 4.3 Extensibility: static registry

`src/registry.ts` holds a hand-written array. There is **no** filesystem scanning and
no dynamic `import()` — the published artifact is a bundle, a bundler cannot resolve a
dynamically scanned path, and an `npx` consumer cannot drop files into `src/` anyway.

```ts
interface Agent {
  id: string                    // 'claude-code'
  name: string                  // 'Claude Code'
  detect(): Promise<boolean>    // is this agent installed?
  getActions(): Action[]        // drives the menu
}

interface Action {
  id: string
  labelKey: string              // i18n key, not literal text
  run(ctx: Ctx): Promise<ActionResult>
}
```

The interface is shaped around `getActions()` rather than a single
`promptForSettings()`/`applyConfig()` pair, because the menu has several independent
actions and a one-shot prompt-then-apply signature cannot drive it.

Serialization is a seam, not an assumption: `ConfigFile` carries a `codec`
(`json` in v1) so a future agent using TOML — OpenAI Codex CLI, for one — does not
require reworking the interface.

### 4.4 Error handling and exit codes

| Code | Condition | Behaviour |
| --- | --- | --- |
| 0 | success | |
| 1 | runtime error | message to stderr, no partial write |
| 2 | not a TTY (§5.6) | usage message naming the limitation |
| 3 | permission denied on a target path | names the path and required mode |
| 4 | existing file is not valid JSON | names path and parse position; offers to back it up and start fresh; never silently overwrites |

Malformed network config warns but does not block saving. A failed agent module logs
a warning and the remaining agents still load.

---

## 5. Non-Functional Requirements

### 5.1 Performance

- **Warm start ≤ 2 s** — measured from process start to first paint, excluding
  `npx` package download, which is network-bound and outside ccset's control.
- No lazy module loading: after §4.3 the registry is static and the artifact is a
  single bundle, so there is nothing to defer.

### 5.2 Compatibility

- Node.js 18+ (required for global `fetch`, §4.2.6).
- **macOS, Linux: supported and verified.**
- **WSL and Windows: best-effort.** Code is Windows-correct — `os.homedir()`,
  `path.join`, no shell-outs. Native Windows targets Windows Terminal and
  PowerShell; cmd.exe is explicitly out of scope.
- **Windows security caveat (must appear in the README, not only here):** Node's
  `fs.chmod` on win32 can only toggle the read-only bit — owner/group/other are not
  implemented and NTFS ACLs are untouched. §2.2 criterion 6 is a **POSIX-only
  guarantee**. On Windows the token file inherits the parent directory's ACL.

### 5.3 Security

- Token input is masked on entry and masked on display (§4.2.4).
- Every ccset-written file: `0600` on POSIX, via `fs.chmod` immediately after
  `rename()`, before the path becomes user-visible.
- Tokens never appear in logs, error messages, stack traces, or process arguments.
- Backups inherit `0600` (§6.5).
- A token is transmitted only by the opt-in action in §4.2.6.

### 5.4 Usability

- Arrow-key and vim-style (`j`/`k`) navigation, Enter to select, Esc to go back.
  Numeric shortcuts are
  hand-implemented via Ink's `useInput` — Ink ships no form widgets, so this is
  explicit work, not a library feature.
- Long regions state the visible range and total row count, and keep the focused
  row inside the terminal Viewport. Numeric shortcuts are renumbered to visible
  rows and cannot select a hidden row.
- Every screen offers Back/Cancel.
- Success messages state the absolute path written, the resulting mode, and the
  `claude --settings` command.

### 5.5 Maintainability

- TypeScript throughout.
- All user-facing strings behind `t('key')` in `src/i18n/en.ts`. English only in v1;
  a second catalog is purely additive. No locale detection in v1.
- File I/O, merge semantics, backups, and path resolution are agent-agnostic
  utilities under `src/core/`, reusable by any future agent module.

### 5.6 TTY requirement

v1 is interactive-only. On `!process.stdin.isTTY` ccset prints a message explaining
that interactive mode is required and exits **2** — Ink degrades badly into a pipe,
and a legible refusal beats emitting control sequences into a log.

If non-interactive mode lands (Milestone 3), **the token must never be a CLI flag** —
flags land in shell history, `ps` output and CI logs. It reads from `CCSET_TOKEN` or
stdin.

---

## 6. Technical Design

### 6.1 Stack

| Concern | Choice |
| --- | --- |
| Language | TypeScript |
| TUI | **React Ink** (+ `ink-text-input`, `ink-select-input`) |
| CLI parsing | `commander` (`--help`, `--version` only in v1) |
| Build | `tsup` → single bundled ESM CLI with shebang |
| HTTP | global `fetch` (no dependency) |
| Paths | `os.homedir()` + `path.join` |

§5.5 of the prior draft proposed `@clack/prompts`/`inquirer`; that is withdrawn. A
stateful editable review screen (§4.1) needs Ink.

### 6.2 Directory structure

```
ccset/
├── package.json            # bin: ccset; publishConfig.access: public
├── tsconfig.json
├── tsup.config.ts
├── README.md
├── Important Documentation.md
├── PRD.md
└── src/
    ├── cli.tsx             # arg parse, TTY guard, mount Ink
    ├── registry.ts         # const AGENTS = [claudeCode]   ← the one line
    ├── types.ts            # Agent, Action, FieldSpec, ManagedKey, ConfigFile
    ├── i18n/
    │   ├── index.ts        # t()
    │   └── en.ts           # string table
    ├── core/
    │   ├── json-file.ts    # parse; atomic write (temp + rename); chmod 0600
    │   ├── merge.ts        # manifest apply: set / delete / preserve-rest
    │   ├── backup.ts       # timestamped, 0600, prune to MAX_BACKUPS
    │   ├── paths.ts        # homedir-relative resolution
    │   └── errors.ts       # error taxonomy + exit codes
    ├── ui/
    │   ├── App.tsx         # root + routing
    │   ├── Menu.tsx
    │   ├── ReviewForm.tsx  # FieldSpec[] → editable rows
    │   ├── Field.tsx       # text / boolean / masked / suggest row
    │   └── Status.tsx
    └── agents/
        └── claude-code/
            ├── index.ts    # implements Agent
            ├── manifest.ts # managed keys + FieldSpec (global + provider)
            └── actions.ts  # global / providers / status / test-connection
```

Every file is expected to stay under the 300-line project limit; `manifest.ts` is
data, which is what keeps `actions.ts` and `ReviewForm.tsx` small.

### 6.3 CLI

- `npx @droite/ccset`
- Global install exposes `ccset` via `"bin": { "ccset": "./dist/cli.js" }`.
- `--help`, `--version`.
- `--agent <id>` reserved; meaningful only once a second agent exists.
- **`"publishConfig": { "access": "public" }` is required** — scoped packages are
  private by default and `npm publish` fails without it.

The prior draft's `npx ai-agent-config` is withdrawn: that name is already published
on npm by a third party (v2.8.6) and is unusable.

### 6.4 Write strategy: managed-key manifest

One declaration drives both the review screen and the writer.

For each write:

1. **Re-read the target file immediately before writing** — never reuse the parse
   from when the TUI launched. Claude Code persists `/model`, `/config` and effort
   changes into `settings.json`.
2. For every key in the manifest: present in the proposed config → **set**; absent →
   **delete**.
3. Every key not in the manifest, at every nesting level, is passed through unchanged.
4. Serialize, write to a temp file in the same directory, `chmod 0600`, then
   `rename()` — atomic on POSIX, so a crash can never leave a truncated target.

Deletion is not an optimization; it is required for correctness. Without it,
answering "no" to the proxy leaves `HTTPS_PROXY` in the file and ccset reports
success while the proxy stays on.

`env` is merged per-key, never replaced wholesale — a wholesale replace would destroy
env vars the user set by hand.

### 6.5 Backups

- Location: `~/.claude/backups/ccset/` — a ccset-owned subdirectory, deliberately
  **not** the shared `~/.claude/backups/`. Claude Code maintains that directory
  itself and its pruning rule is unknown (§9.3); a scheme that silently loses
  backups is worse than none, because it would be relied upon.
- Naming follows Claude Code's own observed convention:
  `<basename>.backup.<epoch_ms>`.
- Mode `0600`. Taken before every write, including provider files.
- `MAX_BACKUPS = 10`, pruned oldest-first. A named constant, not a config option —
  ccset does not introduce a config file of its own.
- **Documented consequence:** an old token survives in a backup after it is
  overwritten. Status offers a "clear backups" action, and the README says so
  plainly.

---

## 7. Milestones

**Milestone 1 — publishable MVP.** The whole point of §2.1 is `npx` with no install,
which is untrue until the package is published; publishing first also forces the
packaging questions (scope access, bin name, bundling Ink) to surface while they are
cheap. Ship at `0.x` so nothing is locked.

- Static registry + Claude Code module + Ink review screen.
- `~/.claude.json` create-if-missing; global settings; provider add/edit; Status
  with glob discovery; opt-in test connection.
- Manifest merge with deletion, atomic writes, `0600`, backups, error taxonomy,
  TTY guard.
- README (including the Windows chmod caveat), published to npm.

Manifest-merge semantics move **into** M1: they are not a refinement, they are the
condition for writing `settings.json` without data loss.

**Milestone 2 — hardening and proof of extensibility.**

- `apiKeyHelper` support, gated on the §9.3 experiment.
- A second real agent module, which is the only honest test of §2.2 criterion 5.
- Extension guide; error-recovery polish.

**Milestone 3 — reach.**

- Non-interactive mode (§5.6 constraints binding).
- Windows and WSL verification to improve best-effort compatibility evidence.
- Additional i18n catalogs.

---

## 8. Risks and Assumptions

- Claude Code's settings shape is convention, not contract; a future version may
  move it. Confined to `agents/claude-code/manifest.ts`.
- `settings.<provider>.json` is **not** auto-discovered by Claude Code. It is a user
  naming convention that only takes effect via `--settings`. Everything in §4.2.3
  depends on that flag continuing to exist.
- Third-party endpoint compatibility is the user's concern; ccset writes config and,
  on request, checks reachability.
- Ink on Windows is unverified (§5.2).

---

## 9. Appendices

### 9.1 Files

| Path | ccset access |
| --- | --- |
| `~/.claude.json` | create-if-missing; otherwise **read-only** |
| `~/.claude/settings.json` | read/write, manifest-merged |
| `~/.claude/settings.<name>.json` | read/write, manifest-merged, glob-discovered |
| `~/.claude/backups/ccset/` | write, `0600`, pruned to 10 |

Activation is always `claude --settings <absolute-path>`.

### 9.2 Verified during review

Confirmed present in the installed `claude` binary (v2.1.x, Linux x64):
`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_DEFAULT_OPUS_MODEL`,
`ANTHROPIC_DEFAULT_SONNET_MODEL`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`,
`CLAUDE_CODE_ATTRIBUTION_HEADER`, `DISABLE_INSTALLATION_CHECKS`, `ENABLE_TOOL_SEARCH`,
`cleanupPeriodDays`, `fallbackModel`, `hasCompletedOnboarding`, `apiKeyHelper`,
`CLAUDE_CODE_API_KEY_HELPER_TTL_MS`.

`claude --settings <file-or-json>` exists and is documented as loading *additional*
settings.

npm: `@droite/ccset` unpublished; `ai-agent-config` taken (v2.8.6); `ccset`,
`aiset`, `acset` free; `agentset` taken.

### 9.3 Known unknowns — resolve before depending on them

1. **`apiKeyHelper` on the Bearer path.** Third-party endpoints authenticate via
   `ANTHROPIC_AUTH_TOKEN` (Bearer); `apiKeyHelper` is documented alongside
   `ANTHROPIC_API_KEY` (`x-api-key`). Whether its output is used when
   `ANTHROPIC_BASE_URL` points at a third party is **unknown**. Milestone 2 depends
   on it entirely. One request against a real provider settles it.
2. **`--settings` precedence.** The help text says "additional settings." Whether an
   overlapping key in the provider file overrides `~/.claude/settings.json`, and
   whether `env` merges per-key or wholesale, is unverified. §4.2.3's "leave model
   blank to inherit the global value" assumes per-key merge.
3. **`fallbackModel` type in settings JSON.** Observed on disk as `string[]`; the
   CLI flag takes a comma-separated string. Array form is assumed, not confirmed.
4. **Pruning rule for `~/.claude/backups/`.** Unknown whether Claude Code prunes by
   pattern or across the whole directory — the reason §6.5 uses a subdirectory.
5. **Ownership of the `droite` npm scope.** Registry probes returned 401/403 (auth
   required), so availability could not be determined.
