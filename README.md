# ccset

[中文说明](README.zh-CN.md) | English

A terminal UI that writes coding-agent settings files correctly.

Pointing a coding agent at a third-party API endpoint means hand-editing JSON
whose field names are undocumented in aggregate, where a typo produces a config
that looks right and silently fails. ccset generates and edits those files, and
shows you what is already on disk.

Two agents are supported: **Claude Code** and **opencode**. ccset asks which one
you are configuring, or takes `--agent <id>`.

**ccset generates configuration; it does not activate it.** For Claude Code,
activation is you running `claude --settings <path>`, and ccset prints that
exact line after every successful write. opencode reads its config on start, so
there is nothing to activate — ccset says so rather than inventing a command.

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
| Global settings | `~/.config/opencode/opencode.json` — model, sharing, auto-update |
| Providers | A `provider.<id>` block in that same file — add, edit, list |
| Status | Reads the above. Writes nothing. |

opencode keeps every provider inside one document rather than one file each, so
editing a provider rewrites only that block. Its `models` map is merged entry by
entry: a model already on disk keeps its own settings, a new id is added, and one
you remove from the list is deleted.

**opencode's `.jsonc` config is not managed.** opencode also loads
`opencode.jsonc`, which may contain comments that cannot survive a JSON rewrite.
ccset never writes that file. If it exists, Status names it and warns that a save
may not be the config opencode actually reads — sort out which file you want
before relying on the write.

There is no Test connection for opencode: a custom provider's wire protocol comes
from whichever SDK package you name, so there is no single endpoint ccset could
probe honestly.

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
- **A file that is not valid JSON is never silently overwritten.** ccset says so,
  and offers to back it up and start fresh. That choice is yours to make.

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
  for opencode (mode `0600`, ten kept per file, oldest pruned). After you rotate
  a token the previous one still sits in those copies until you run **Clear ccset
  backups** from that agent's Status screen.

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
ccset [--agent <id>]
  -v, --version
  -h, --help
```

`--agent` takes `claude-code` or `opencode` and skips the selection screen.

ccset is interactive only. Run through a pipe or in CI it prints a message and
exits `2` rather than emitting control sequences into a log.

| Exit code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Runtime error |
| 2 | Not a TTY |
| 3 | Permission denied on a target path (the path and required mode are named) |
| 4 | An existing file is not valid JSON |

### Environment

| Variable | Effect |
| --- | --- |
| `CCSET_ASCII=1` | Use a seven-bit interface: decorative glyphs, help punctuation, prose punctuation, and masked values are folded to printable ASCII. Leave it unset for the Unicode glyphs. |
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
`src/core/` and are agent-agnostic. `ConfigFile` carries a codec so an agent that
uses a format other than JSON does not require reworking the interface — though
no non-JSON agent is implemented, and one would need a format-preserving parser
to keep the unmanaged-keys guarantee.

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
