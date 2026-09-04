# ccset

[English](README.md) | 中文说明

一个用于正确写入编程 Agent 设置文件的终端界面工具。

将编程 Agent 指向第三方 API 端点时，手动编辑 JSON 容易因字段名拼写错误而导致配置静默失效。ccset 会生成和编辑这些文件，并显示磁盘上已有的配置。

目前支持三个 Agent：**Claude Code**、**opencode** 和 **Codex CLI**。ccset 会询问你要配置哪一个，也可以用 `--agent <id>` 指定。

**ccset 只生成配置，不会启用配置。** 对 Claude Code，启用时请运行 `claude --settings <path>`，每次成功写入后 ccset 都会打印该命令。opencode 和 Codex 在启动时自行读取配置文件，无需启用命令——ccset 会如实说明，而不是编造一条命令。

```bash
npx @droite/ccset
```

要求 Node.js 18 或更高版本。支持 macOS 和 Linux；Windows 为尽力支持。

ccset 是尽力维护的开源项目，并非托管服务。仅支持 npm 上的最新版本。平台与维护边界见
[支持政策](https://github.com/Right202209/ccset/blob/master/SUPPORT.md)，报告安全问题前请阅读
[安全政策](https://github.com/Right202209/ccset/blob/master/SECURITY.md)。

## 功能

### Claude Code

| 菜单项 | 操作对象 |
| --- | --- |
| Global settings | `~/.claude/settings.json` |
| Providers | `~/.claude/settings.<name>.json`，可添加、编辑、查看 |
| Status | 读取上述文件及 `~/.claude.json`，不会写入 |
| Test connection | 向选定的提供商发送一次需确认的连接请求 |

### opencode

| 菜单项 | 操作对象 |
| --- | --- |
| Global settings | `~/.config/opencode/opencode.json`：模型、分享、自动更新 |
| Providers | 同一文件中的 `provider.<id>` 配置块，可添加、编辑、查看 |
| Status | 读取上述内容，不会写入 |

opencode 将所有 provider 保存在同一个文件中，而不是每个 provider 一个文件，因此编辑某个 provider 只会重写对应的配置块。其中的 `models` 映射按条目合并：磁盘上已有的模型保留自身设置，新增的 id 会被添加，从列表中移除的 id 会被删除。

**ccset 不管理 opencode 的 `.jsonc` 配置。** opencode 也会读取 `opencode.jsonc`，其中可能包含注释，而注释无法在 JSON 重写后保留。ccset 从不写入该文件。如果该文件存在，Status 会指出它，并提示此次写入可能并非 opencode 实际读取的配置——请先确认要使用哪一个文件。

opencode 没有 Test connection：自定义 provider 的通信协议取决于你指定的 SDK 包，因此不存在 ccset 能够如实探测的单一端点。

### Codex CLI

| 菜单项 | 操作对象 |
| --- | --- |
| Global settings | `~/.codex/config.toml`：模型、provider、推理强度、审批策略、沙箱模式 |
| Providers | 同一文件中的 `[model_providers.<id>]` 表，以及每个 provider 各自保存的凭据，可添加、编辑、切换 |
| Status | 读取上述内容及 `~/.codex/auth.json`，不会写入 |

Codex 是唯一配置格式不是 JSON 的 Agent。ccset **就地修改** `config.toml`，而不是重新生成：设置某个键时只替换它的值，新增时插入一行，移除时删除一行；你的注释、空行、对齐和键顺序会逐字节保留。

**API Key 不会写入 `config.toml`，因为 Codex 不从那里读取它。** ccset 会把它保存到 `~/.codex/auth.<id>.json`（权限 `0600`），并在 provider 表中写入 `requires_openai_auth = true`——正是这一项让 Codex 使用该凭据。选择 **Use this provider** 后，ccset 会把保存的凭据复制到 `~/.codex/auth.json`，同时把 `model_provider` 指向该表：切换的两个环节一步完成，因为只换凭据会让 Codex 拿着新凭据继续访问旧端点。

如果 `auth.json` 中已有并非 ccset 保存的内容（例如 ChatGPT 登录态，或你手动填写的 Key），ccset 会在替换前请你为它取个名字保存下来，以便日后切换回去。无论是否保存，都会先做备份。

写入的 provider 表使用 `wire_api = "responses"`——这是当前 Codex 唯一接受的取值，因此端点必须支持 OpenAI Responses API。

**如果 Codex 配置了 `cli_auth_credentials_store = "keyring"`，它就完全不读取 `auth.json`**，而 ccset 无法写入系统密钥链。此时 Status 会如实说明，而不是提供一个实际不生效的切换操作。

**`CODEX_HOME` 只会被提示，不会被采用。** 如果设置了该变量，Codex 会从那里读取配置，而 ccset 仍然写入本次运行所使用的主目录。Status 会指出这一差异，避免写错目录却看起来写入成功。ccset 不会跟随该变量：那会让隔离运行的写入跑到指定目录之外。

Codex 没有 Test connection：ccset 内置的探测请求是 Anthropic 形态的，而 Responses API 端点需要另一种请求，目前没有可靠的探测方式。

方向键移动，`1`-`9` 选择当前窗口内对应编号的可见行，Enter 选择，Esc 返回。长列表会显示当前可见范围和总行数。表单在放弃未保存修改前会请求确认。进入嵌套界面后，标题会显示完整导航路径；终端较窄时仍保留最后两级路径。

## 文件与密钥安全

- 未管理的键会保留，包括 `hooks`、`statusLine`、`permissions`、`enabledPlugins` 及手动设置的环境变量。
- 只写入叶子节点，绝不整体覆盖其父对象，因此你手动写在被管理对象内部的同级键会被保留。
- 关闭代理时会删除 `HTTP_PROXY` 和 `HTTPS_PROXY`；空字段会被省略，而不是写入 `null` 或空字符串。
- 写入前会重新读取文件，写入采用同目录临时文件、权限设置和重命名，保证原子性。
- POSIX 系统写入文件权限为 `0600`。每次写入前会备份到该 Agent 配置目录下的 `backups/ccset/`：Claude Code 为 `~/.claude/backups/ccset/`，opencode 为 `~/.config/opencode/backups/ccset/`，Codex 为 `~/.codex/backups/ccset/`，最多保留每个文件十份。
- Token 仅在确认 **Test connection** 后发送，并在界面和错误信息中遮罩显示。备份仍可能包含旧 Token，可从对应 Agent 的 Status 中清除 ccset 备份。备份被中断产生的残缺副本同样保存着正在复制的凭据，Status 会列出并警告，清除 ccset 备份时一并删除。
- 保存失败不会结束会话：错误以独立屏幕显示，已输入的内容不会丢失，`esc` 返回表单，修正后可重试。
- 对带注释的格式，注释和排版同样会保留：Codex 的 `config.toml` 采用就地修改，注释、空行、对齐和键顺序都完整保留。
- 无法解析的文件不会被静默覆盖；工具会指明是 JSON 还是 TOML，并提示你备份后重新创建。
- `~/.codex/auth.json` 只会被整体替换，绝不会被就地编辑：它是 Codex 的活跃凭据，登录和刷新令牌时都会被改写，因此 ccset 只在你明确要求时整文件覆盖。把已有凭据保存为 profile 时是逐字节复制，因此 ccset 不理解的 OAuth 令牌结构也能完整保留。

## CLI

不带命令词时，ccset 是交互式 TUI：

```text
ccset [--agent <id>]
  -v, --version
  -h, --help
```

`--agent` 可取 `claude-code`、`opencode` 或 `codex`，指定后会跳过 Agent 选择界面。通过管道或在 CI 中运行时，TUI 会提示并以退出码 `2` 退出，而不会向日志输出控制序列。

### 非交互式命令

同时给出 Agent **和**命令词时，ccset 以无界面方式运行：没有屏幕，合并、备份与安全行为与表单完全一致。旗标可以出现在调用中的任意位置。Claude Code 目前声明：

```text
ccset --agent claude-code global set [选项]
```

`global set` 只应用你给出的字段——旧脚本不会抹掉新脚本添加的键——ccset 不管理的键始终原样保留。

| 选项 | 取值 | 作用 |
| --- | --- | --- |
| `--model <name>` | 自由文本 | 写入 `model`。 |
| `--cleanupPeriodDays <n>` | 正整数 | 以 JSON 数字写入 `cleanupPeriodDays`。 |
| `--disableNonessentialTraffic <n>` | `1` 或 `0` | 以字符串 `1`/`0` 写入该环境开关。 |
| `--attributionHeader <n>` | `1` 或 `0` | 同上。 |
| `--disableInstallationChecks <n>` | `1` 或 `0` | 同上。 |
| `--enableToolSearch <n>` | `1` 或 `0` | 同上。 |
| `--proxyEnabled <b>` | `true` 或 `false` | 写入或删除 `HTTPS_PROXY` 和 `HTTP_PROXY` 两个键。`true` 必须同时给出 `--proxyUrl`。 |
| `--proxyUrl <url>` | http(s) URL | 同时写入两个代理键；只给出它即表示启用代理。 |
| `--unset <field>` | 可重复 | 从文件中删除该字段的键。代理字段是一个耦合单元：`--unset proxyEnabled` 或 `--unset proxyUrl` 都会删除两个代理键。 |
| `--dry-run` | | 读取、校验并输出计划，不写入任何内容。 |
| `--replace-invalid` | | 备份无法解析的目标文件，然后用新文件替换。 |
| `--json` | | 在标准输出打印一个机器可读的 JSON 信封。 |

解析器会拒绝：缺少 `--agent`、未知选项、重复的标量、无效取值、违反耦合规则的取值，以及未给出任何字段的调用——一律以退出码 `64` 拒绝，且都发生在读取任何文件之前。空字符串永远不是取值：删除只能用 `--unset`，而不是 `--字段 ''`。没有任何非交互式命令接受把凭据写成参数，将来也不会：提供商令牌将在后续里程碑中只经由 `CCSET_TOKEN` 或标准输入提供，绝不进入 argv。

### JSON 输出

`--json` 使命令只在标准输出打印一个带版本号的信封。它不含密钥，且只增不改：新字段可能出现，已有字段不会改变形状。信封中的 `exitCode` 始终与进程退出状态一致，监督与解析不会互相矛盾。

```json
{
  "schemaVersion": 1,
  "operation": "global.set",
  "agentId": "claude-code",
  "changed": true,
  "dryRun": false,
  "targets": [
    {
      "path": "/home/user/.claude/settings.json",
      "changed": true,
      "mode": "0600",
      "backupPath": "/home/user/.claude/backups/ccset/settings.json.backup.1788458903109"
    }
  ],
  "warnings": [],
  "exitCode": 0
}
```

失败时打印同样的信封，`targets` 与 `warnings` 为空，并带有 `error` 主体。`code` 是稳定的机器码，`reason` 是以 i18n 键加参数表示的主要原因，`problems` 列出收集到的全部用法问题：

```json
{
  "schemaVersion": 1,
  "operation": "global.set",
  "agentId": "claude-code",
  "changed": false,
  "dryRun": false,
  "targets": [],
  "warnings": [],
  "error": {
    "code": "usage",
    "message": "不能同时设置和取消同一字段：model。",
    "reason": { "code": "error.conflictSetUnset", "params": { "field": "model" } },
    "problems": [{ "code": "error.conflictSetUnset", "params": { "field": "model" } }]
  },
  "exitCode": 64
}
```

### 退出码

| 退出码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 运行时错误 |
| 2 | 不是 TTY |
| 3 | 目标路径权限被拒绝（会指明路径与所需权限） |
| 4 | 已有文件无法解析（JSON 或 TOML） |
| 64 | 用法错误：语法错误、未知选项、无效或重复取值、空补丁、缺少 `--agent` |
| 66 | 未知 Agent |
| 67 | 该 Agent 不支持所请求的命令 |

在交互式应用中，动作失败不会结束会话：错误是独立的一屏，已输入的内容全部保留，`esc` 返回表单，修复原因后可以重试。只有界面之外发生失败时——启动阶段，或渲染树本身崩溃——退出码才会传给进程。

### 环境变量

| 变量 | 作用 |
| --- | --- |
| `CCSET_LOCALE` | 界面语言。设为 `zh-Hans` 使用简体中文界面；不设置或其他值均为英文。语言只接受显式选择——ccset 不会探测系统语言。 |
| `CCSET_ASCII=1` | 使用七位 ASCII 界面：装饰字形、帮助和标点以及掩码值都会折叠为可打印 ASCII。不设置时使用 Unicode 字形。中文不做转写，七位终端无法显示。 |
| `CCSET_HOME` | 覆盖 ccset 读写的主目录，供隔离测试使用，不建议日常使用。 |

颜色开关不在 ccset：渲染经由 Ink，它已支持 `NO_COLOR`。

## 添加 Agent

只需改动两个文件，这一点是强制的而非愿景。在 `src/agents/<id>/` 下实现 `src/types.ts` 中的 `Agent` 接口（`detect()`、`getActions()`，以及该 Agent 界面所用的文案），然后将其加入 `src/registry.ts` 的静态数组。添加 opencode 时，`src/` 下没有改动任何其他文件。

通用文件读写、合并、备份、遮罩和路径解析位于 `src/core/`，应直接复用。`ConfigFile` 携带的 codec 是真实存在的分界：`json` 会从解析结果重建文档，`toml` 则直接修改原文本以保留注释与键顺序。完整指南见
[docs/adding-an-agent.md](docs/adding-an-agent.md)，该文档是在添加第二个 Agent 的过程中写成的。

## 开发

```bash
npm install
npm run typecheck
npm run build
```

`Important Documentation.md` 是需要实际运行工具验证的场景清单。
Pull Request 可以直接提出产品改动；验收和验证要求见
[贡献指南](https://github.com/Right202209/ccset/blob/master/CONTRIBUTING.md)。

## 许可证

MIT。
