# ccset

[English](README.md) | 中文说明

一个用于正确写入编程 Agent 设置文件的终端界面工具，也是一条可脚本化的命令行。

将编程 Agent 指向第三方 API 端点时，手动编辑 JSON 容易因字段名拼写错误而导致配置静默失效。ccset 会生成和编辑这些文件，并显示磁盘上已有的配置。

目前支持三个 Agent：**Claude Code**、**opencode** 和 **Codex CLI**。ccset 会询问你要配置哪一个，可以用 `--agent <id>` 指定，也可以无界面地执行单条命令——见 [命令行](#cli)。

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
| Global settings | `~/.config/opencode/opencode.jsonc`（若存在），否则为 `~/.config/opencode/opencode.json`：模型、分享、自动更新 |
| Providers | 同一文件中的 `provider.<id>` 配置块，可添加、编辑、查看 |
| Status | 读取上述内容，不会写入 |

opencode 将所有 provider 保存在同一个文件中，而不是每个 provider 一个文件，因此编辑某个 provider 只会重写对应的配置块。其中的 `models` 映射按条目合并：磁盘上已有的模型保留自身设置，新增的 id 会被添加，从列表中移除的 id 会被删除。

**当 `opencode.jsonc` 存在时，ccset 写入该文件。** opencode 会同时读取两份配置并按键合并，冲突时以 `.jsonc` 为准——而且全新安装时 opencode 自己就会生成一份 `.jsonc`。这一合并顺序读自 opencode 的源码，尚未通过运行 opencode 证实。因此该文件存在时，它就是 ccset 唯一读写的文件，并且就地编辑：你的注释、键顺序和格式在每次保存后保持不变，与 Codex 的 TOML 就地编辑是同一承诺。只存在 `opencode.json` 时，一切照旧。受管理的 `.jsonc` 旁如有旧的 `opencode.json`，Status 会将其标注为不受管理：它仍会被加载，但两边都设置的键以 `.jsonc` 的值为准。ccset 从不创建 `.jsonc`，也从不改写或删除旧的 `.json`，并且一如既往地忽略 `config.json`。

opencode 没有 Test connection：自定义 provider 的通信协议取决于你指定的 SDK 包，因此不存在 ccset 能够如实探测的单一端点。

### Codex CLI

| 菜单项 | 操作对象 |
| --- | --- |
| Global settings | `~/.codex/config.toml`：模型、provider、推理强度、审批策略、沙箱模式 |
| Providers | 同一文件中的 `[model_providers.<id>]` 表，以及每个 provider 各自保存的凭据，可添加、编辑、切换 |
| Status | 读取上述内容及 `~/.codex/auth.json`，不会写入 |

Codex 的配置格式是 TOML，不是 JSON。ccset **就地修改** `config.toml`，而不是重新生成：设置某个键时只替换它的值，新增时插入一行，移除时删除一行；你的注释、空行、对齐和键顺序会逐字节保留。

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
- 对带注释的格式，注释和排版同样会保留：Codex 的 `config.toml` 和 opencode 的 `opencode.jsonc` 采用就地修改，注释、空行、对齐和键顺序都完整保留。
- 无法解析的文件不会被静默覆盖；工具会指明是 JSON 还是 TOML，并提示你备份后重新创建。
- `~/.codex/auth.json` 只会被整体替换，绝不会被就地编辑：它是 Codex 的活跃凭据，登录和刷新令牌时都会被改写，因此 ccset 只在你明确要求时整文件覆盖。把已有凭据保存为 profile 时是逐字节复制，因此 ccset 不理解的 OAuth 令牌结构也能完整保留。

## CLI

```text
ccset [--agent <id>]             # 交互式界面
ccset --agent <id> <command> …   # 单条操作，无界面
ccset -v | --version | -h | --help
```

`--agent` 可取 `claude-code`、`opencode` 或 `codex`。不带命令时启动交互式界面；通过管道或在 CI 中运行时会提示并以退出码 `2` 退出，不会向日志输出控制序列。带命令时以无界面方式执行：默认输出面向人的行式报告，加 `--json` 则在 stdout 输出一份 JSON 信封。

### 命令

| Agent | 命令 |
| --- | --- |
| `claude-code` | `status` · `global set` · `provider set <id>` · `state init` |
| `opencode` | `status` · `global set` · `provider set <id>` |
| `codex` | `status` · `global set` · `provider set <id>` · `provider use <id>` |

`status` 只读取，不写入。各 `set` 命令只修补你给出的字段：省略的字段保留磁盘值，`--unset <field>` 显式删除一项，受管键周围的非受管键逐字节保留——在 Codex 的 `config.toml` 中连注释、空行和键顺序一起保留。ccset 写入的任何内容都不会启用提供商：Claude Code 等你运行 `claude --settings`，Codex 等你执行 `provider use`，opencode 在启动时自行读取配置。`state init` 在 Claude Code 的 `~/.claude.json` 不存在时创建它，否则原样保留。

各命令共享的选项：

| 选项 | 作用 |
| --- | --- |
| `--json` | 在 stdout 输出一份 JSON 信封，代替面向人的行式输出 |
| `--dry-run` | 读取、校验并计划；不备份，不写入。仅限会更改状态的命令——`status` 会拒绝它 |
| `--unset <field>` | 显式删除一个字段；绝不隐式推断删除 |
| `--replace-invalid` | 确认替换已无法解析的目标；先备份无法读取的原文件 |
| `--token-stdin` | 从 stdin 读取 API 密钥 |

密钥只能通过 `CCSET_TOKEN` 或 `--token-stdin` 进入 ccset——绝不允许作为选项、位置参数或文件，这些都会被拒绝为用法错误——并且只会写进该 provider 自己的目标：Claude Code 的 provider 文件、opencode 对应配置块的 `options.apiKey`、Codex 的 `auth.<id>.json` 旁路文件。它绝不会被打印——不在面向人的输出里，不在 JSON 信封里，也不在错误、警告或备份里。

关于 Codex 的细节：`provider set` 每次保存都会重新断言 `wire_api = "responses"` 与 `requires_openai_auth = true`，并把密钥写入 `auth.<id>.json`——绝不写入 `config.toml`，也绝不碰在用的 `auth.json`。`provider use` 会把指定凭据配置复制为 `auth.json` 并在同一操作中移动 `model_provider`，先提交路由。如果 `auth.json` 中已有不属于任何已保存凭据配置的内容，切换会被拒绝，直到你传且只传 `--adopt-current-as <name>`（把它保存为新的可切换配置）或 `--replace-current-auth`（丢弃——无论如何都会先备份）。

| 退出码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 运行时错误——被拒绝的操作，或无法如实执行该操作的环境 |
| 2 | 非 TTY（仅交互模式） |
| 3 | 目标路径权限不足（会指出路径与所需模式） |
| 4 | 已有文件无法解析（JSON 或 TOML） |
| 64 | 用法错误——未知字段或选项、非法值、空补丁 |
| 65 | 未知 Agent id |
| 66 | 该 Agent 不支持的命令 |

### 环境变量

| 变量 | 作用 |
| --- | --- |
| `CCSET_LOCALE` | 界面语言覆盖。设为 `zh-Hans` 选择简体中文；未设置或其他任何值均为英文。设置该变量时——包括空值与未知值——会抑制首次使用提示，且绝不持久化。没有覆盖时，首次交互运行会询问一次并保存选择；ccset 永远不会探测系统语言环境。 |
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
