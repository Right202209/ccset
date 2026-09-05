# ccset

[中文说明](README.zh-CN.md) | English

A terminal UI — and a scriptable command line — that write coding-agent
settings files correctly.

Pointing a coding agent at a third-party API endpoint means hand-editing JSON
whose field names are undocumented in aggregate, where a typo produces a config
that looks right and silently fails. ccset generates and edits those files, and
shows you what is already on disk.

Three agents are supported: **Claude Code**, **opencode** and **Codex CLI**.
ccset asks which one you are configuring, takes `--agent <id>`, or runs one
command headlessly — see [CLI](#cli).

**ccset generates configuration; it does not activate it.** For Claude Code,
activation is you running `claude --settings <path>`, and ccset prints that
exact line after every successful write. opencode and Codex read their config on
start, so there is nothing to activate — ccset says so rather than inventing a
command.

```
npx @droite/ccset
```

Node 18 or newer. macOS and Linux are supported; Windows is best-effort (see
[Windows](#windows)).

ccset is a best-effort open source project, not a managed service. Only the latest
npm release is supported. See the [support policy](https://github.com/Right202209/ccset/blob/master/SUPPORT.md)
for platform and maintenance boundaries and the
[security policy](https://github.com/Right202209/ccset/blob/master/SECURITY.md)
before reporting a security issue.

## What it does

### Claude Code

| Menu entry | What it touches |
| --- | --- |
| Global settings | `~/.claude/settings.json` |
| Providers | `~/.claude/settings.<name>.json` — add, edit, list |
| Status | Reads everything above plus `~/.claude.json`. Writes nothing. |
| Test connection | One opt-in request to a provider you pick |

### opencode

| Menu entry | What it touches |
| --- | --- |
| Global settings | `~/.config/opencode/opencode.jsonc` when one exists, else `~/.config/opencode/opencode.json` — model, sharing, auto-update |
| Providers | A `provider.<id>` block in that same file — add, edit, list |
| Status | Reads the above. Writes nothing. |

opencode keeps every provider inside one document rather than one file each, so
editing a provider rewrites only that block. Its `models` map is merged entry by
entry: a model already on disk keeps its own settings, a new id is added, and one
you remove from the list is deleted.

**ccset writes `opencode.jsonc` when it exists.** opencode loads both configs
and merges them per key with the `.jsonc` winning every conflict — and it seeds
a `.jsonc` itself on fresh installs. That merge order is read from opencode's
source code, not yet confirmed by running it. So when that file exists, it is
the one file ccset reads and writes, edited in place: your comments, key order
and formatting survive every save, exactly as the TOML editing promises for
Codex.
When only `opencode.json` exists, nothing changes. A legacy `opencode.json`
beside a managed `.jsonc` is named in Status as not managed: it still loads,
but a key set in both files takes the `.jsonc`'s value. ccset never creates a
`.jsonc`, never rewrites or deletes a legacy `.json`, and ignores `config.json`.

There is no Test connection for opencode: a custom provider's wire protocol comes
from whichever SDK package you name, so there is no single endpoint ccset could
probe honestly.

### Codex CLI

| Menu entry | What it touches |
| --- | --- |
| Global settings | `~/.codex/config.toml` — model, provider, reasoning effort, approval policy, sandbox mode |
| Providers | A `[model_providers.<id>]` table in that file, plus a saved credential per provider — add, edit, switch |
| Status | Reads the above and `~/.codex/auth.json`. Writes nothing. |

Codex's config is TOML, not JSON. `config.toml` is **edited in
place**, not rewritten: setting a key replaces its value, adding one inserts a
line, removing one deletes a line, and your comments, blank lines, alignment and
key order are copied through byte for byte.

**Your API key does not go in `config.toml`, because Codex does not read it
there.** ccset saves it to `~/.codex/auth.<id>.json` (mode `0600`) and writes
`requires_openai_auth = true` on the provider block, which is what makes Codex
use that credential. **Use this provider** then copies the saved credential over
`~/.codex/auth.json` and points `model_provider` at the block — one step for both
halves of a switch, since moving only the key would leave Codex calling the old
endpoint with the new credential.

If `auth.json` already holds something ccset did not save — a ChatGPT login, or a
key you set by hand — you are offered a name to keep it under before it is
replaced, so you can switch back to it later. A backup is taken either way.

A provider block is written with `wire_api = "responses"`, the only value Codex
still accepts, so the endpoint has to speak the OpenAI Responses API.

**If Codex is set to `cli_auth_credentials_store = "keyring"` it never reads
`auth.json`**, and ccset cannot write a keyring entry. Status says so rather than
offering a switch that would change nothing.

**`CODEX_HOME` is reported, not followed.** If you have it set, Codex reads its
config from there while ccset writes under the home this run was given. Status
names the mismatch so a save that lands in the wrong directory does not look
successful. ccset does not chase the variable: it would take an isolated run's
writes back out of the directory it was pointed at.

There is no Test connection for Codex: the probe ccset ships is Anthropic-shaped,
and a Responses-API endpoint is a different request it has no honest way to make.

Arrow keys move, `1`-`9` select the numbered visible row, Enter selects, Esc goes
back. Long lists state the visible range and total row count. A form asks before
discarding unsaved edits and never asks otherwise. Nested screens show their full
navigation path in the header; narrow terminals keep the final two steps visible.

## What it will not do to your files

- **Unmanaged keys survive.** ccset owns a fixed list of keys. `hooks`,
  `statusLine`, `permissions`, `enabledPlugins`, hand-set `env` vars and anything
  else at any nesting level are read, kept, and written back unchanged. `env` is
  merged per key, never replaced wholesale.
- **Turning something off removes it.** Switching the proxy off deletes
  `HTTP_PROXY` and `HTTPS_PROXY` rather than blanking them, because a file that
  still holds the key is a proxy that is still on.
- **Blank means absent.** An empty field omits the key entirely — no `null`,
  no `""`.
- **Nothing is written wholesale.** ccset writes leaves, never their parents, so
  a sibling key you set by hand inside a managed object survives.
- **The file is re-read immediately before writing**, so changes the agent
  persisted while ccset was open are not clobbered by a stale parse.
- **Writes are atomic**: temp file in the same directory, `chmod`, then
  `rename()`. A crash mid-write leaves the target wholly old or wholly new.
- **`~/.claude.json` is created only if it is missing.** If it exists, ccset
  reads it and never writes it — it is Claude Code's live state store, rewritten
  continuously, and a read-modify-write there races an active writer. If
  `hasCompletedOnboarding` is missing, ccset prints the one-line fix instead of
  applying it.
- **Comments and formatting survive too, where the format has them.** Codex's
  `config.toml` and opencode's `opencode.jsonc` are edited in place rather than
  re-serialised, so comments, blank lines, alignment and key order are
  preserved exactly.
- **A file ccset cannot parse is never silently overwritten.** It says so — naming
  JSON or TOML, whichever the file is — and offers to back it up and start fresh.
  That choice is yours to make.
- **`~/.codex/auth.json` is replaced, never edited.** It is Codex's live
  credential, rewritten on login and token refresh, so ccset copies a whole file
  over it on your explicit request and never reads-modifies-writes it. Adopting
  an existing one is a byte copy, so an OAuth token block ccset does not model
  survives intact.

## Secrets

- Tokens are masked on entry and on display — first and last four characters,
  with a fixed-width middle that does not encode the real length. That applies to
  Status, the review screen, and error messages alike.
- Every file ccset writes is mode `0600` on POSIX.
- A token leaves your machine only through **Test connection**, which names the
  destination host and asks before sending. The response body is discarded
  unread, because it can echo the token back.
- **Backups keep old tokens.** Every write first copies the target to a
  `backups/ccset/` directory beside that agent's config —
  `~/.claude/backups/ccset/` for Claude Code, `~/.config/opencode/backups/ccset/`
  for opencode, `~/.codex/backups/ccset/` for Codex (mode `0600`, ten kept per
  file, oldest pruned). After you rotate a token the previous one still sits in
  those copies until you run **Clear ccset backups** from that agent's Status
  screen. Removing a Codex provider's saved credential deletes the sidecar but
  not its backups, for the same reason.
- **A backup interrupted mid-copy is not hidden.** The partial copy holds the
  credential it was copying, so Status lists it with a warning until
  **Clear ccset backups** removes it.

## Windows

Best-effort and unverified. The code is Windows-correct — `os.homedir()`,
`path.join`, no shell-outs — and targets Windows Terminal and PowerShell;
`cmd.exe` is out of scope.

**The `0600` guarantee is POSIX-only.** Node's `fs.chmod` on win32 can only
toggle the read-only bit: owner/group/other are not implemented and NTFS ACLs are
left untouched. On Windows a settings file holding a token inherits the parent
directory's ACL, so restrict `%USERPROFILE%\.claude` yourself if that matters to
you.

## CLI

```
ccset [--agent <id>]             # the interactive interface
ccset --agent <id> <command> …   # one operation, no interface
ccset -v | --version | -h | --help
```

`--agent` takes `claude-code`, `opencode` or `codex`. With no command, ccset
starts the interactive interface; run through a pipe or in CI, that prints a
message and exits `2` rather than emitting control sequences into a log. With a
command, ccset runs it headlessly: a line-oriented report by default, or one
JSON envelope on stdout with `--json`.

### Commands

| Agent | Commands |
| --- | --- |
| `claude-code` | `status` · `global set` · `provider set <id>` · `state init` |
| `opencode` | `status` · `global set` · `provider set <id>` |
| `codex` | `status` · `global set` · `provider set <id>` · `provider use <id>` |

`status` reads everything and writes nothing. The `set` commands patch only the
fields you name: omitted fields keep their disk values, `--unset <field>`
deletes one explicitly, and the unmanaged keys around the managed ones survive
byte for byte — in Codex's `config.toml` down to the comments, blank lines and
key order. Nothing ccset writes activates a provider: Claude Code waits for
`claude --settings`, Codex waits for `provider use`, and opencode reads its
config on start. `state init` creates Claude Code's `~/.claude.json` when it is
absent and otherwise leaves the file alone.

Options the commands share:

| Option | Effect |
| --- | --- |
| `--json` | One JSON envelope on stdout instead of human lines |
| `--dry-run` | Read, validate and plan; no backup, no write. State-changing commands only — `status` refuses it |
| `--unset <field>` | Remove one field explicitly; removal is never inferred |
| `--replace-invalid` | Confirmed replacement of a target that no longer parses; the unreadable original is backed up first |
| `--token-stdin` | Read the API key from stdin |

A key reaches ccset only through `CCSET_TOKEN` or `--token-stdin` — never an
option, a positional or a file, all of which are usage refusals — and is then
written only to that provider's own target: the provider file for Claude Code,
`options.apiKey` in the named block for opencode, the `auth.<id>.json` sidecar
for Codex. It is never printed — not in human output, not in the JSON envelope,
not in an error, warning or backup.

Codex details worth knowing: `provider set` re-asserts `wire_api = "responses"`
and `requires_openai_auth = true` on every save, and lands the key in
`auth.<id>.json` — never in `config.toml`, never in the live `auth.json`.
`provider use` copies the named profile into `auth.json` and moves
`model_provider` in the same operation, routing first. If `auth.json` holds
something that is none of the saved profiles, the switch refuses until you pass
exactly one of `--adopt-current-as <name>` (keep it as a new, switchable
profile) or `--replace-current-auth` (discard it — backed up either way).

| Exit code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Runtime error — a refused operation, or an environment the operation cannot be honest in |
| 2 | Not a TTY (interactive mode only) |
| 3 | Permission denied on a target path (the path and required mode are named) |
| 4 | An existing file could not be parsed (JSON or TOML) |
| 64 | Usage error — unknown field or option, invalid value, empty patch |
| 65 | Unknown agent id |
| 66 | A command this agent does not serve |

In the interactive app a failed action does not end the session: the error is a
screen of its own, everything you typed is kept, and `esc` returns to the form
so you can fix the cause and try again. An exit code reaches the process only
when a failure happens outside the interface — at start-up, or if the render
tree itself crashes.

### Environment

| Variable | Effect |
| --- | --- |
| `CCSET_LOCALE` | Interface language override. `zh-Hans` selects Simplified Chinese; unset or any other value gives English. When set, including empty or unknown values, it suppresses the first-use prompt and is never persisted. With no override, an interactive first run asks once and saves the choice; ccset never detects your environment's locale. |
| `CCSET_ASCII=1` | Use a seven-bit interface: decorative glyphs, help punctuation, prose punctuation, and masked values are folded to printable ASCII. Leave it unset for the Unicode glyphs. Chinese text is not transliterated; a seven-bit terminal cannot draw it. |
| `CCSET_HOME` | Overrides the home directory ccset reads and writes under. Intended for isolated test runs, not daily use. |

Colour is not ccset's switch: it renders through Ink, which already honours
`NO_COLOR`.

## Adding an agent

Two files, and that is enforced rather than aspirational. Write a module under
`src/agents/<id>/` implementing the `Agent` interface from `src/types.ts` —
`detect()`, `getActions()`, and the strings your screens use — then add it to the
array in `src/registry.ts`. Adding opencode changed nothing else under `src/`.

The registry is hand-written and static: the published artifact is a bundle, and
a bundler cannot resolve a dynamically scanned path.

File I/O, merge semantics, backups, masking and path resolution live in
`src/core/` and are agent-agnostic. `ConfigFile` carries a codec, and that seam is
real rather than notional: `json` rebuilds the document from the parsed object,
`toml` and `jsonc` edit the original text so comments and key order survive.
Adding a format means adding a codec, not reworking the interface.

[**docs/adding-an-agent.md**](docs/adding-an-agent.md) is the full guide, written
from adding the second one.

## Development

```
npm install
npm run typecheck
npm run build      # tsup -> dist/cli.js, single ESM bundle with a shebang
```

`Important Documentation.md` is the verification register: everything that needs
to be confirmed by running the tool, rather than by reading it, is listed there.
Pull requests may propose product changes directly; see the
[contribution guide](https://github.com/Right202209/ccset/blob/master/CONTRIBUTING.md)
for acceptance and verification requirements.

## Licence

MIT.
