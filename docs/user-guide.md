# ccset user guide

[简体中文](zh-CN/user-guide.zh-CN.md) | English · [README](../README.md)

## Agent selection

The TUI lists registered Agents detected from local files and automatically enters a sole match. Explicit `--agent <id>` or `CCSET_AGENT` permits first-time setup. **Change agent** or Esc from the Agent menu returns to local detection.

Commands also accept a positional Agent ID. Scripts always require an explicit selector; only commands with both stdin and stdout TTYs may infer a sole match. Detection is read-only and never executes an Agent.

## Interaction

Arrow keys move, Enter selects, Esc returns; `1`–`9` address numbered visible rows. SGR mouse clicks open visible menu/list rows. **Ctrl+S** saves a form; abandoning a dirty form asks for confirmation.

Each Edit entry reads the file again. Failed saving or declined malformed-file replacement keeps the draft and its dirty baseline. Returning from a success message does not repeat the save. After a successful delete, the TUI returns to the Provider list.

The frame follows content height and retains terminal scrollback. At ≥100 columns/16 rows it can show side Panels; at 80–99 columns/≥20 rows it can show a detail strip. Smaller terminals keep only the main View. Previews show key presence and valid URL origins, hiding paths/queries/fragments. Use `CCSET_ASCII=1` for seven-bit decorative glyphs; Chinese is not transliterated.

## Agent configuration

Paths below use the run's home; Agent-specific overrides are listed afterwards.

| Agent | Managed configuration | Provider credential |
| --- | --- | --- |
| Claude Code | `~/.claude/settings.json`; `settings.<id>.json` per Provider | `env.ANTHROPIC_AUTH_TOKEN` in the Provider file |
| opencode | Existing `~/.config/opencode/opencode.jsonc`, otherwise `opencode.json`; `provider.<id>` | Block's `options.apiKey` |
| Codex CLI | `~/.codex/config.toml`; `model_providers.<id>` | Saved `~/.codex/auth.<id>.json`; selected profile replaces live `auth.json` |
| pi | `~/.pi/agent/settings.json`; `models.json` under `providers.<id>` | Block's `apiKey`; login `auth.json` is unmanaged |
| Grok Build | `~/.grok/config.toml`; `model.<id>` | Block's `api_key`; login `auth.json` is unmanaged |

ccset also writes `~/.ccset/settings.json` for language/ignore preferences and `~/.codex/ccset.auth-profiles.json` for adopted routing. Backups live in `backups/ccset/` under the selected Agent directory.

### Claude Code

Global settings manage proxy, traffic/install/tool-search switches, cleanup days, and model. Providers manage endpoint/token/model plus optional fallback and model-remapping fields. IDs use letters/digits/`_`/`-`; `local`, `json`, and `__proto__` are reserved.

`~/.claude.json` is created only when absent, with onboarding marked complete; an existing file is read-only. Provider files take effect only through `claude --settings <path>`: `use <id>` prints that command, `run <id>` executes it.

**Test connection** is an optional confirmed Messages request. It names the host, warns for non-loopback HTTP, refuses redirects, and discards the response body. Saving never sends this request. Other Agents have no probe.

### opencode

The existing JSONC file is the sole ccset target; a legacy JSON beside it remains untouched and is named in Status. ccset never creates JSONC or manages `config.json`. Upstream JSONC precedence is source-backed; its separate live check remains U6 in the register.

Provider models merge by ID: retained IDs keep custom options, new IDs get empty objects, removed IDs disappear. `use` selects the first listed model or an explicit `--model`; absent/missing/disabled targets are refused without changing enable/disable lists.

`XDG_CONFIG_HOME` applies only when ccset's home equals the real home; a scratch home keeps its own `.config/opencode`.

### Codex CLI

Provider saves enforce `wire_api = "responses"` and `requires_openai_auth = true`, requiring a Responses endpoint. They refuse blocks containing `env_key` or `experimental_bearer_token`, which override the saved credential.

Saving a profile does not change live auth. CLI `use` switches routing/auth together; `--model` optionally selects a model. An unmatched live login requires `--adopt-current-as <new-id>` to retain it or `--replace-current-auth`; either path backs it up. Adoption records the prior route; restore refuses an absent required custom table.

Keyring activation/restoration is refused because `auth.json` is ineffective. **`CODEX_HOME` is reported, never followed:** CLI writes refuse a mismatch; the TUI reports it but does not enforce the same refusal. Use the CLI when this precondition matters.

TUI activation has a separate implementation. Credential-source, adoption-name reuse, and partial-progress gaps are tracked in [the safety follow-up](../review.md). Neither a saved profile nor successful local file writes establish live API compatibility.

### pi

Startup defaults are `defaultProvider`, `defaultModel`, and `defaultThinkingLevel` in plain JSON. `models.json` uses the JSONC editor; retained model-array members keep metadata, and members without usable string IDs pass through unchanged.

A block may override a built-in Provider without models. Blocks retaining custom models require an effective `api`. `use` writes default Provider and model together; without listed models it needs an explicit `--model`.

`apiKey` is stored verbatim, including pi's reference forms such as `$ENV_VAR` or `!command`; ccset does not execute them. pi's login file and project-local settings are unmanaged. `PI_CODING_AGENT_DIR` applies only at the real home.

### Grok Build

The managed Provider leaves are `model`, `base_url`, `name`, `api_backend`, and `api_key`. Backends are `chat_completions`, `responses`, and `messages`. Built-in overrides may omit key/endpoint; a missing endpoint warns.

`use` writes only `models.default`; an unknown ID warns because it may be built-in. Provider IDs use the shared letters/digits/`_`/`-` pattern. Select dotted built-in IDs through `global set --model grok-4.6`; hand-written quoted tables remain unmanaged.

Grok's credential order is inline `api_key` → unmanaged `env_key` → session token → `XAI_API_KEY`. Adding an inline key can override a hand-set reference. `GROK_HOME` applies only at the real home.

## Deleting and ignoring providers

A Provider Screen offers **Edit**, **Ignore/Stop ignoring**, and **Delete**. Ignore/unignore/delete require confirmation and are TUI-only.

- Claude Code deletion backs up/removes its whole Provider file, even if malformed.
- Shared-document deletion requires a parseable document and removes the whole Provider block, including custom keys; sibling Providers and unrelated TOML/JSONC text remain.
- Codex deletion refuses the currently routed Provider; it backs up/removes the Auth profile before the table.
- An absent delete target is a no-op. Successful deletion clears its ignore note and closes its Screen.
- Ignore changes only `~/.ccset/settings.json`, not Agent configuration. Normal lists and Claude probes omit ignored Providers; a list row reveals them and offers unignore.
- If ignore-note clearing fails after removal, the current error omits the completed removal report; retrying clears the note. Separate **Remove saved credential** deletes a Codex sidecar directly and leaves its table/previous backups.

Deletion and cleanup do not erase credentials from backups unless those backups are themselves removed.

## What it will not do to your files

- Managed edits set/delete leaves, preserving unmanaged siblings. TUI blank fields remove managed leaves; omitted CLI fields preserve them, with explicit `--unset` for deletion. Supported `false` is a value.
- TOML/JSONC retain unrelated text; plain JSON may be reformatted. Inline TOML tables can expand to dotted assignments while preserving siblings.
- Each save re-reads the target. TUI managed fields are still written as held in the form; external edits to those fields can be overwritten.
- Configuration replacement/deletion backs up existing targets. Replacement uses an exclusive private stage and per-file atomic rename; create-only state/adoption uses publication that refuses an existing destination.
- Malformed Agent configuration is replaced only after confirmation or supported CLI `--replace-invalid`. Codex CLI provider set cannot reconstruct an unreadable saved Auth profile.
- Live Codex auth is replaced whole, preserving adopted bytes without merging unknown token structures.
- Multi-file failures report committed targets and available rollback errors. No cross-file transaction, writer locking, or fsync power-loss guarantee exists. See [open safety findings](../review.md).

## Secrets

TUI secret fields fully hide values shorter than 16 characters; longer values show the first/last four with a fixed-width mask. Managed credential fields are omitted from command output. This is masking, not encryption: configuration/profile/backups can contain plaintext.

POSIX staging creates files at `0600`; reasserting chmod is best effort on filesystems that refuse it. Windows ACLs are unmanaged.

Each Agent directory's `backups/ccset/` retains ten completed backups per basename. Old keys remain until **Status → Clear ccset backups**. Cleanup counts successful removals and reports failed paths with retry; interrupted copies remain visible as partial-backup warnings.

Status output for arbitrary URL components or model metadata has [known projection gaps](../review.md); do not treat raw output as automatically safe to share. Reporting requirements are in [SECURITY.md](../SECURITY.md).

## Windows

macOS/Linux are supported. WSL and Windows Terminal/PowerShell are best effort; native interactive behavior is not established by Windows CI. `cmd.exe` is unsupported.

`0600` is a POSIX-filesystem guarantee. Node chmod cannot enforce NTFS owner/group/other access; inherited directory ACLs govern files. See [SUPPORT.md](../SUPPORT.md).

## CLI

```text
ccset [--agent <id>]           # TUI
ccset <agent> <command> …
ccset --agent <id> <command> …
ccset --help | --version
```

An invocation without a command and with non-TTY stdin exits 2; explicit commands run headlessly. Human output is line-oriented; `--json` emits one envelope. All exact options, unset field IDs, JSON fields, and exit codes live in [the command contract](milestone-3-non-interactive.md).

### Select, add, and use a provider

```bash
ccset presets list
ccset claude-code add relay --preset openrouter
ccset claude-code use relay
ccset claude-code run relay -- --help
ccset codex add relay --preset openrouter
CCSET_AGENT=pi ccset use relay
```

Preset `add` may ask for a hidden key only with stdin+stdout TTYs, human output, and no dry-run. Enter saves; Ctrl+C cancels without writing. Scripts/JSON/dry-run require `CCSET_TOKEN` or `--token-stdin`. Both sources together fail.

OpenRouter has all five Agent entries; DeepSeek has no Codex Responses entry. Model suggestions can age; defaults are reviewed starting data, not live evidence. Reapplying a preset patches existing Providers too; inspect dry-run before overriding custom fields. The default ID is the preset ID, suffixed `-ccset` when reserved. See [preset contribution rules](../presets/README.md).

### Commands

All five Agents serve `status`, `global set`, `provider set <id>`, and `use <id>` (alias `provider use`). Claude Code additionally serves `run <id>` and `state init`.

| Agent | `use` effect |
| --- | --- |
| Claude Code | Validate Provider file and print the session command; no write |
| opencode | Save `model = "provider/model"`; optional `--model` |
| Codex | Switch routing/Auth profile; optional global `--model` |
| pi | Save default Provider/model; optional `--model` |
| Grok Build | Save `models.default` |

Existing sessions do not change; Agent CLI/project settings can override startup defaults. `run` executes Claude Code's argument array without a shell, inherits I/O, and returns the child's status. `run --dry-run --json` previews only; live `run --json` is refused.

### Environment

| Variable | Behavior |
| --- | --- |
| `CCSET_LOCALE` | `zh-Hans` selects Chinese; any other set value selects English. Overrides and suppresses TUI prompting/persistence; commands use it or English. Unset TUI uses saved choice or asks once. No `LANG` inference. |
| `CCSET_ASCII=1` | Fold decorative glyphs/punctuation to ASCII; Chinese remains Chinese |
| `CCSET_AGENT` | Explicit Agent fallback; CLI selection wins; empty/unknown values fail |
| `CCSET_HOME` | Scratch-home override for ccset writes; does not isolate an upstream Agent |
| `CCSET_TOKEN` | Provider secret source for set/preset add; conflicts with `--token-stdin` |

Ink honors `NO_COLOR`. The website's browser language preference is independent of CLI settings.
