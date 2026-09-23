# ccset 用户指南

[English](user-guide.md) | 简体中文

[返回 README](../README.md)

## Agent 选择

交互式程序启动时，会并行检查已注册 Agent 的本地文件，只把当前 home 中
检测到的 Agent 列入选项。只检测到一个 Agent 时会自动进入。如果尚未检测到
任何 Agent，可以显式使用 `--agent <id>` 有意打开首次配置；非交互命令始终
要求显式提供这个选择器。

## Agent 配置

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

**当 `opencode.jsonc` 存在时，ccset 写入该文件。** opencode 会同时读取两份配置并按键合并，冲突时以 `.jsonc` 为准——而且全新安装时 opencode 自己就会生成一份 `.jsonc`。这一合并顺序读自 opencode 的源码，尚未通过运行 opencode 证实。因此该文件存在时，它就是 ccset 唯一读写的文件，并且就地编辑：你的注释、键顺序和格式在每次保存后保持不变，与 Codex 的 TOML 就地编辑是同一承诺。只存在 `opencode.json` 时，一切照旧。受管的 `.jsonc` 旁如有旧的 `opencode.json`，Status 会将其标注为非受管：它仍会被加载，但两边都设置的键以 `.jsonc` 的值为准。ccset 从不创建 `.jsonc`，从不改写或删除旧的 `.json`，并且忽略 `config.json`。

**只有真实主目录才遵循 `XDG_CONFIG_HOME`。** 设置了该变量时 opencode 读取 `$XDG_CONFIG_HOME/opencode`，ccset 也随之读写同一位置。通过 `CCSET_HOME` 指向其他主目录的运行不受环境变量影响，无论外围 shell 导出了什么，都始终使用该主目录自己的 `.config/opencode`。

opencode 没有 Test connection：自定义 provider 的通信协议取决于你指定的 SDK 包，因此不存在 ccset 能够如实探测的单一端点。

### Codex CLI

| 菜单项 | 操作对象 |
| --- | --- |
| Global settings | `~/.codex/config.toml`：模型、provider、推理强度、审批策略、沙箱模式 |
| Providers | 同一文件中的 `[model_providers.<id>]` 表，以及每个 provider 各自保存的凭据，可添加、编辑、切换 |
| Status | 读取上述内容及 `~/.codex/auth.json`，不会写入 |

Codex 的配置格式是 TOML，不是 JSON。ccset **就地修改** `config.toml`，而不是重新生成：设置某个键时只替换它的值，新增时插入一行，移除时删除一行；你的注释、空行、对齐和键顺序会逐字节保留。

**ccset 将 API 密钥与 `config.toml` 分开保存。** 它会把每个密钥保存到 `~/.codex/auth.<id>.json`（权限 `0600`），并在 provider 表中写入 `requires_openai_auth = true`——正是这一项让 Codex 使用该凭据。选择 **Use this provider** 后，ccset 会把保存的凭据复制到 `~/.codex/auth.json`，同时把 `model_provider` 指向该表：切换的两个环节一步完成，因为只换凭据会让 Codex 拿着新凭据继续访问旧端点。

如果 `auth.json` 中已有并非 ccset 保存的内容（例如 ChatGPT 登录态，或你手动填写的密钥），ccset 会在替换前请你为它取个名字保存下来，以便日后切换回去。无论是否保存，都会先做备份。切换回去是真实的操作：这个已保存的登录会出现在 **Providers** 列表中，并注明它恢复到哪条路由；选择它即可同时恢复凭据和收养时的 `model_provider`。

写入的 provider 表使用 `wire_api = "responses"`——这是当前 Codex 唯一接受的取值，因此端点必须支持 OpenAI Responses API。

**设置了 `env_key` 或 `experimental_bearer_token` 的表会被拒绝保存。** Codex 会先从这些来源读取凭据，轮不到 `auth.json`；把密钥存进这样的表只会报告成功，而 Codex 仍使用旧来源。请先从表中移除这些键。

**如果 Codex 配置了 `cli_auth_credentials_store = "keyring"`，它就完全不读取 `auth.json`**，而 ccset 无法写入系统密钥链。此时 Status 会如实说明，而不是提供一个实际不生效的切换操作。

**`CODEX_HOME` 只被报告，不会被跟随。** 如果设置了该变量，Codex 会从那里读取配置，而 ccset 仍然写入本次运行所使用的主目录。Status 会指出这一差异，避免写错目录却看起来写入成功。ccset 不会跟随该变量：那会让隔离运行的写入跑到指定目录之外。非交互写入会在改动文件之前拒绝 `CODEX_HOME` 不一致的情况。

Codex 没有 Test connection：ccset 内置的探测请求是 Anthropic 形态的，而 Responses API 端点需要另一种请求，目前没有可靠的探测方式。

### pi

| 菜单项 | 操作对象 |
| --- | --- |
| Global settings | `~/.pi/agent/settings.json`：默认提供商、默认模型、默认思考级别 |
| Providers | `~/.pi/agent/models.json` 中的 `providers.<id>` 配置块，可添加、编辑、查看 |
| Provider use | 把默认提供商与默认模型写入 `settings.json` |
| Status | 读取上述内容及 `~/.pi/agent/auth.json`，不会写入 |

pi 把自定义 provider 保存在 `models.json` 中（每个 id 一个配置块），启动默认项则读取 `settings.json`。编辑某个 provider 只会重写对应的配置块。其中的 `models` 数组按成员合并：磁盘上已有的模型保留自身设置（`cost`、`compat`、`headers` 等 ccset 不管理的字段），新增的 id 会以 `{ "id": … }` 追加，从列表中移除的 id 会被删除。不带模型的配置块是有意支持的——用 `anthropic` 这类内置 id 只写 `baseUrl` 正是 pi 文档中让内置提供商走代理的方式。

**`models.json` 就地编辑；`settings.json` 是纯 JSON。** pi 读取 `models.json` 时会自行剥离注释（已从 pi 源码核实），因此该文件可以带注释，ccset 对它使用与 opencode 的 `.jsonc` 相同的格式保留式 JSONC 编辑器：注释、键顺序和格式在每次保存后保持不变。`settings.json` 由 pi 按纯 JSON 解析，因此 ccset 对它重新序列化。

**ccset 把 provider 密钥写入该配置块自己的 `apiKey`。** pi 按其文档顺序解析凭据（CLI 参数、`auth.json`、环境变量、再到 `models.json`），该值原样支持 pi 的取值形式——字面量、`$ENV_VAR` 或 `!command`——因此可以存 `$MY_KEY` 而不是密钥本身。ccset 绝不编辑 `auth.json`：它由 pi 的 `/login` 管理；文件存在时 Status 会如实标注，而不是假装管理它。

**只有真实主目录才遵循 `PI_CODING_AGENT_DIR`。** pi 设置了该变量时从这个目录读取配置，ccset 也随之读写同一位置。通过 `CCSET_HOME` 指向其他主目录的运行不受环境变量影响，始终使用该主目录自己的 `.pi/agent`。项目级 `.pi/settings.json` 受 pi 的信任机制管理，ccset 不管理它。

pi 没有 Test connection：`models.json` 的 provider 使用四种 API 类型之一，不存在 ccset 能够如实探测的单一端点。

**`provider use <id>` 会把 `defaultProvider` 与 `defaultModel` 同时写入 `settings.json`**——pi 只有在两者同时设置时才会采用保存的启动默认项。未传 `--model` 时使用该 provider 磁盘条目中的第一个模型；不带模型的配置块（内置覆盖形态）必须显式传 `--model`，因为它的启动模型在 pi 自己的目录中，ccset 不读取。

### Grok Build

| 菜单项 | 操作对象 |
| --- | --- |
| Global settings | `~/.grok/config.toml`：默认模型（`models.default`） |
| Providers | 同一文件中的 `[model.<id>]` 配置块，可添加、编辑、查看 |
| Status | 读取上述内容及 `~/.grok/auth.json`，不会写入 |

Grok Build 的配置格式是 TOML，与 Codex 一样就地修改：注释、空行、对齐和键顺序在每次保存后逐字节保留。`auth.json` 是 Grok 自己的凭据存储，由 `grok login` 写入；ccset 只在 Status 中说明它，绝不编辑。

一个 provider 对应一个 `[model.<id>]` 表。ccset 管理其中的 `model`（端点收到的模型标识）、`base_url`、`name`、`api_backend`（`chat_completions`、`responses` 或 `messages`）和 `api_key`；表中的其余键——`env_key`、`extra_headers`、`query_params`、采样与窗口数值——全部原样保留。命名一个内置模型的配置块只覆盖你设置的字段，这是 Grok 文档中的内置覆盖方式，因此新建配置块不强制要求 `base_url`；没有 `base_url` 的配置块会在 Status 和命令警告中标注，因为自定义模型没有它就无法连接任何端点。ccset 写入的 id 仅限字母、数字、连字符和下划线；带点的内置 id（`grok-4.6`）不是 ccset 能写成表的 id——请用 `global set --model` 让 `models.default` 指向它，而手写的带引号表（如 `[model."grok-4.6"]`）会原样保留。

**Provider use** 只写入 `models.default`，不写其他任何内容：Grok 为每个新会话读取它，`/model` 和 `-m` 仍可按会话覆盖。切换到没有对应 `[model.*]` 块的 id 时会给出警告而不是拒绝，因为该 id 可能是内置模型。

Grok 解析模型凭据的顺序是 `api_key`、`env_key`、登录会话令牌、再到 `XAI_API_KEY`。ccset 保存的密钥会内联写入 `config.toml`，并在所有显示中遮罩；若完全不想把密钥写进文件，请改用非受管的 `env_key`（手工设置）。

**只有真实主目录才遵循 `GROK_HOME`。** 设置了该变量时 Grok 读取 `$GROK_HOME`，ccset 也随之读写同一位置——但仅当 ccset 本身指向真实主目录时。通过 `CCSET_HOME`（或每个 fixture）指向其他主目录的运行始终使用该主目录自己的 `.grok`，继承的环境变量不会把隔离运行的写入带出临时目录。

Grok Build 同样没有 Test connection：它的三种 API 后端各有自己的请求形态，ccset 内置的 Anthropic 形态探测对哪种都无法如实发送。

方向键移动，`1`-`9` 选择当前窗口内对应编号的可见行，Enter 选择，Esc 返回。长列表会显示当前可见范围和总行数。表单在放弃未保存修改前会请求确认，其余情况从不询问。进入嵌套界面后，标题会显示完整导航路径；终端较窄时仍保留最后两级路径。

## 不会对你的文件做的事

- **非受管键会保留。** ccset 拥有一份固定的键列表。`hooks`、`statusLine`、`permissions`、`enabledPlugins`、手动设置的 `env` 变量以及任意嵌套层级的其他所有内容都会被读取、保留并原样写回。`env` 按键合并，绝不整体替换。
- **关闭即删除。** 关闭代理时会删除 `HTTP_PROXY` 和 `HTTPS_PROXY`，而不是将其留空，因为文件里仍保留这个键就等于代理仍然开启。
- **表单留空即表示省略。** 交互界面中的空字段会删除对应的键。命令会保留省略的字段，删除一项需要显式使用 `--unset`。
- **配置编辑只针对受管叶子。** 你手动写在受管对象内部的同级键会被保留。
- **写入前会立即重新读取文件**，因此 ccset 打开期间 Agent 持久化的更改不会因过期的解析结果而被覆盖。
- **写入是原子的**：先写同目录临时文件，`chmod`，然后 `rename()`。写入中途崩溃会让目标要么完全是旧内容，要么完全是新内容。
- **`~/.claude.json` 只在缺失时创建。** 如果它已存在，ccset 只读取、绝不写入——它是 Claude Code 的活跃状态存储，会被持续改写，对它做读-改-写会与活跃的写入者产生竞争。如果缺少 `hasCompletedOnboarding`，ccset 会打印那条单行修复命令，而不是代为应用。
- **只要格式本身支持，注释与排版同样会保留。** Codex 的 `config.toml`、Grok Build 的 `config.toml`、opencode 的 `opencode.jsonc` 和 pi 的 `models.json` 采用就地修改而非重新序列化，因此注释、空行、对齐和键顺序被完整保留。
- **ccset 无法解析的文件绝不会被静默覆盖。** UI 会提供先备份再重新创建的选项。在支持替换的命令上必须传 `--replace-invalid`，并且会先备份无法读取的原文件。
- **`~/.codex/auth.json` 只会被整体替换，绝不会被编辑。** 它是 Codex 的活跃凭据，登录和刷新令牌时都会被改写，因此 ccset 只在你明确要求时整文件覆盖，绝不读-改-写。收养已有凭据时是逐字节复制，因此 ccset 不理解的 OAuth 令牌结构也能完整保留。

## 密钥

- 在 UI 中输入和显示时会遮罩密钥。少于 16 个字符的密钥完全隐藏；16 个字符及以上的密钥显示前四位和后四位，中间以固定宽度的遮罩填充。命令输出不包含密钥。
- ccset 写入的每个文件在 POSIX 上的权限都是 `0600`。
- 密钥只有通过 **Test connection** 才会离开你的机器：它会指明目标主机，并在发送前请求确认。响应体会被直接丢弃、不予读取，因为它可能把密钥回显回来。
- **备份会保留旧密钥。** 每次写入前都会先把目标复制到该 Agent 配置目录旁的 `backups/ccset/` 目录——Claude Code 为 `~/.claude/backups/ccset/`，opencode 为 `~/.config/opencode/backups/ccset/`，Codex 为 `~/.codex/backups/ccset/`，pi 为 `~/.pi/agent/backups/ccset/`，Grok Build 为 `~/.grok/backups/ccset/`（权限 `0600`，每个文件最多保留十份，最旧的会被清理）。轮换密钥后，旧密钥仍留在这些副本中，直到你在该 Agent 的 Status 界面运行 **Clear ccset backups**。出于同样的原因，移除 Codex 某个 provider 已保存的凭据时会删除 sidecar 文件，但不删除其备份。
- **复制中途被中断的备份不会被隐藏。** 残缺副本保存着正在复制的凭据，因此 Status 会将其列出并警告，直到 **Clear ccset backups** 将其删除。

## Windows

Windows 为尽力支持。CI 会在 Windows 上构建并对 CLI 做冒烟测试；原生的交互行为仍未验证。目标终端是 Windows Terminal 和 PowerShell；`cmd.exe` 不在范围内。

**`0600` 保证仅限 POSIX。** Node 在 win32 上的 `fs.chmod` 只能切换只读位：owner/group/other 未实现，NTFS ACL 也不会被改动。在 Windows 上，保存密钥的设置文件会继承父目录的 ACL，因此如果这对你重要，请自行限制 `%USERPROFILE%\.claude`。

## CLI

```
ccset [--agent <id>]             # 交互式界面
ccset --agent <id> <command> …   # 单条操作，无界面
ccset -v | --version | -h | --help
```

`--agent` 可取 `claude-code`、`opencode`、`codex`、`pi` 或 `grok-build`。不带命令时启动交互式界面；通过管道或在 CI 中运行时会提示并以退出码 `2` 退出，不会向日志输出控制序列。带命令时以无界面方式执行：默认输出面向人的行式报告，加 `--json` 则在 stdout 输出一份 JSON 信封。

### 命令

| Agent | 命令 |
| --- | --- |
| `claude-code` | `status` · `global set` · `provider set <id>` · `state init` |
| `opencode` | `status` · `global set` · `provider set <id>` |
| `codex` | `status` · `global set` · `provider set <id>` · `provider use <id>` |
| `pi` | `status` · `global set` · `provider set <id>` · `provider use <id>` |
| `grok-build` | `status` · `global set` · `provider set <id>` · `provider use <id>` |

`status` 只读取，不写入。各 `set` 命令只修补你给出的字段：省略的字段保留磁盘值，`--unset <field>` 显式删除一项，非受管键原样保留。TOML 和 JSONC 编辑还会保留这些键周围的格式。保存某个 provider 并不会切换到它：Claude Code 等你运行 `claude --settings`，Codex、pi 和 Grok Build 等你执行 `provider use`，opencode 在启动时自行读取配置。`state init` 在 Claude Code 的 `~/.claude.json` 不存在时创建它，否则原样保留。

各命令共享的选项：

| 选项 | 作用 |
| --- | --- |
| `--json` | 在 stdout 输出一份 JSON 信封，代替面向人的行式输出 |
| `--dry-run` | 读取、校验并计划；不备份，不写入。仅限会更改状态的命令——`status` 会拒绝它 |
| `--unset <field>` | 用字段 ID 删除一个可选字段，例如 `model`、`smallModel` 或 `modelProvider` |
| `--replace-invalid` | 在支持的命令上允许替换无效目标；无法读取的原文件会先被备份。`status`、`state init` 与 Codex 的 `provider use` 拒绝该选项 |
| `--token-stdin` | 从 stdin 读取 API 密钥 |

密钥只能通过 `CCSET_TOKEN` 或 `--token-stdin` 进入 ccset——绝不允许作为选项、位置参数或文件，这些都会被拒绝为用法错误——并且只会写进该 provider 自己的目标：Claude Code 的 provider 文件、opencode 对应配置块的 `options.apiKey`、Codex 的 `auth.<id>.json` 旁路文件、pi 对应 `providers` 配置块的 `apiKey`、Grok Build 对应 `[model.<id>]` 表的 `api_key`。它绝不会被打印在面向人的输出、JSON、错误或警告中。备份文件仍会包含以前的凭据。

关于 Codex 的细节：`provider set` 每次保存都会重新断言 `wire_api = "responses"` 与 `requires_openai_auth = true`，并把密钥写入 `auth.<id>.json`——绝不写入 `config.toml`，也绝不碰在用的 `auth.json`。`provider use` 会把指定的 Auth profile 复制为 `auth.json` 并在同一操作中移动 `model_provider`，先提交路由。如果 `auth.json` 中已有不属于任何已保存 Auth profile 的内容，切换会被拒绝，直到你传且只传 `--adopt-current-as <name>`（把它保存为新的可切换 Auth profile）或 `--replace-current-auth`（丢弃——无论如何都会先备份）。这个选择只在需要时才会被询问：对一个已与某个已保存 Auth profile 一致的在用 `auth.json` 传 `--adopt-current-as` 会被拒绝——因为没有任何内容被替换，也就没有可采纳的对象。

| 退出码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 运行时错误——被拒绝的操作，或无法如实执行该操作的环境 |
| 2 | 非 TTY（仅交互模式） |
| 3 | 目标路径权限不足（会指出路径与所需模式） |
| 4 | 已有文件无法解析（JSON、JSONC 或 TOML） |
| 64 | 用法错误——未知字段或选项、非法值、空补丁 |
| 65 | 未知 Agent id |
| 66 | 该 Agent 不支持的命令 |

在交互式应用中，操作失败不会结束会话：错误以独立屏幕显示，你输入的所有内容都会保留，`esc` 返回表单，修正原因后可重试。只有当失败发生在界面之外——启动时，或渲染树本身崩溃时——退出码才会传递给进程。

### 环境变量

| 变量 | 作用 |
| --- | --- |
| `CCSET_LOCALE` | 单次运行的语言覆盖：设为 `zh-Hans` 选择简体中文；任何其他已设置的值都选择英文。它会抑制首次使用提示，且绝不持久化。未设置时，UI 使用已保存的选择或询问一次；命令默认使用英文。ccset 绝不会从系统语言环境推断语言。 |
| `CCSET_ASCII=1` | 使用七位界面：装饰字形、帮助标点、正文标点和遮罩值都会折叠为可打印 ASCII。不设置时使用 Unicode 字形。中文不做转写，七位终端无法显示。 |
| `CCSET_HOME` | 覆盖 ccset 读写的主目录，供隔离测试使用，不建议日常使用。 |
| `CCSET_TOKEN` | `provider set` 命令所用的 provider API 密钥。请通过密钥存储或已导出的环境提供，不要与 `--token-stdin` 同时使用。 |

颜色开关不在 ccset：渲染经由 Ink，它已支持 `NO_COLOR`。
