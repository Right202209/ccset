# ccset

[中文说明](README.zh-CN.md) | English

A terminal UI that writes Claude Code settings files correctly.

Pointing Claude Code at a third-party Anthropic-compatible endpoint means
hand-editing JSON whose field names are undocumented in aggregate, where a typo
produces a config that looks right and silently fails. ccset generates and edits
those files, and shows you what is already on disk.

**ccset generates configuration; it does not activate it.** Activation is you
running `claude --settings <path>`. ccset's job is to make that command correct
and copy-ready, and it prints the exact line after every successful write.

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

| Menu entry | What it touches |
| --- | --- |
| Global settings | `~/.claude/settings.json` |
| Providers | `~/.claude/settings.<name>.json` — add, edit, list |
| Status | Reads everything above plus `~/.claude.json`. Writes nothing. |
| Test connection | One opt-in request to a provider you pick |

Arrow keys move, `1`-`9` jump, Enter selects, Esc goes back. A form asks before
discarding unsaved edits and never asks otherwise.

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
- **The file is re-read immediately before writing**, so changes Claude Code
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
- **Backups keep old tokens.** Every write first copies the target to
  `~/.claude/backups/ccset/` (mode `0600`, ten kept per file, oldest pruned).
  After you rotate a token the previous one still sits in those copies until you
  run **Clear ccset backups** from the Status screen.

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

Two files. Write a module under `src/agents/<id>/` implementing the `Agent`
interface from `src/types.ts` — `detect()` plus `getActions()`, where each action
returns a screen the UI already knows how to render — and add it to the array in
`src/registry.ts`. The registry is hand-written and static: the published
artifact is a bundle, and a bundler cannot resolve a dynamically scanned path.

File I/O, merge semantics, backups, masking and path resolution live in
`src/core/` and are agent-agnostic. `ConfigFile` carries a codec so an agent that
uses a format other than JSON does not require reworking the interface.

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
