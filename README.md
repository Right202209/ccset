# ccset

[中文说明](https://github.com/Right202209/ccset/blob/master/README.zh-CN.md) | English

Configure third-party API providers for **Claude Code**, **opencode**, and
**Codex CLI** with an interactive terminal UI or scriptable commands. ccset
preserves unmanaged settings and backs up existing files before changing them.

## Quick start

Requires **Node.js 18+**.

```bash
npx @droite/ccset
```

Choose an agent, review its settings, and save. The first interactive run asks
for English or Simplified Chinese and remembers your choice. Arrow keys move,
Enter selects, Esc goes back, and Ctrl+S saves a form.

To install the `ccset` command:

```bash
npm install -g @droite/ccset
ccset --agent claude-code
```

## Supported agents

| Agent | `--agent` ID | Default configuration |
| --- | --- | --- |
| Claude Code | `claude-code` | `~/.claude/settings.json` and `settings.<name>.json` |
| opencode | `opencode` | `~/.config/opencode/opencode.jsonc` when present, otherwise `opencode.json` |
| Codex CLI | `codex` | `~/.codex/config.toml` and saved `auth.<id>.json` profiles |

- **Claude Code:** ccset prints the `claude --settings <path>` command to run
  after saving a provider.
- **opencode:** reads its configuration on launch. ccset honours
  `XDG_CONFIG_HOME` when using your real home directory.
- **Codex CLI:** save a provider, then choose **Use this provider** or run
  `provider use` to switch both routing and the live credential. The endpoint
  must support the OpenAI Responses API.

See the [agent configuration guide](https://github.com/Right202209/ccset/blob/master/docs/user-guide.md#agent-configuration)
for file selection, Codex credential handling, and environment constraints.

## CLI

With no subcommand, ccset opens the interactive UI and requires a TTY. Explicit
commands run in scripts and CI; each requires `--agent`.

```text
ccset --agent <id> status [--json]
ccset --agent <id> global set [options]
ccset --agent <id> provider set <provider-id> [options]
ccset --agent codex provider use <provider-id> [options]
ccset --agent claude-code state init
```

For example:

```bash
ccset --agent claude-code status --json
ccset --agent opencode global set --model example/model --dry-run
```

`set` changes only the fields you supply. Omitted fields keep their values;
`--unset <field>` removes one explicitly. Use `--dry-run` to preview changes
without writing or creating backups, and `--json` for structured output.

Supply API keys through **`CCSET_TOKEN`** or **`--token-stdin`**, never command
arguments. Inject `CCSET_TOKEN` through your shell or CI secret store. Codex
switches that would replace an unsaved login require `--adopt-current-as <id>`
or `--replace-current-auth`.

The [CLI reference](https://github.com/Right202209/ccset/blob/master/docs/user-guide.md#cli)
covers shared options, exit codes, and environment variables. `ccset --help`
shows launch options; `ccset --version` prints the installed version.

## File safety

- Unmanaged keys survive. TOML and JSONC edits preserve comments and formatting.
- Targets are re-read before saving, and each file is written atomically.
  Written files use mode `0600` on POSIX.
- Invalid config requires explicit confirmation in the UI or
  `--replace-invalid` on a supported command.
- Tokens are masked in the UI. Only Claude Code's opt-in **Test connection**
  sends a token over the network.
- **Backups retain old tokens:** ten copies are kept per file under the agent's
  `backups/ccset/` directory. Clear them from the agent's Status screen after
  rotating credentials.

See the [file safety details](https://github.com/Right202209/ccset/blob/master/docs/user-guide.md#what-it-will-not-do-to-your-files)
and [security policy](https://github.com/Right202209/ccset/blob/master/SECURITY.md).

## Development and support

```bash
npm ci
npm run typecheck
npm run build
```

See the [contribution guide](https://github.com/Right202209/ccset/blob/master/CONTRIBUTING.md),
[verification commands and prerequisites](https://github.com/Right202209/ccset/blob/master/docs/verification.md),
[verification register](https://github.com/Right202209/ccset/blob/master/Important%20Documentation.md),
and [adding an agent](https://github.com/Right202209/ccset/blob/master/docs/adding-an-agent.md).

macOS and Linux are supported. Windows is best-effort; interactive behavior and
file permissions have [platform limitations](https://github.com/Right202209/ccset/blob/master/docs/user-guide.md#windows).
Only the latest npm release is supported; see the
[support policy](https://github.com/Right202209/ccset/blob/master/SUPPORT.md).

[MIT License](https://github.com/Right202209/ccset/blob/master/LICENSE).
