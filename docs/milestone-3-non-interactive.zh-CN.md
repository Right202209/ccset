# 里程碑 3 非交互模式

[English](milestone-3-non-interactive.md) | 简体中文

状态：设计已接受；实现已落地，一致性收尾待完成（[issue #56](https://github.com/Right202209/ccset/issues/56)）。

本文档保留已接受的设计。当前实现在命令契约的部分内容上与之不同：它使用 `--json` 和退出码 `64`–`66`，并且只有活跃凭据与任何已保存的 Auth profile 都不匹配时，Codex 才要求做出替换选择。这些差异仍属于一致性收尾的一部分；已实现的 CLI 行为见[用户指南](user-guide.md#cli)。

这是里程碑 3 的可执行产品契约。它有意与 TUI 模型分离：`Action` 和 `Screen` 仍是交互式概念，而本文档定义脚本与 CI 使用的稳定命令 API。

本契约背后的持久权衡记录在 ADR [0006](adr/0006-keep-non-interactive-commands-independent-of-tui-screens.md)、[0007](adr/0007-limit-m3-non-interactive-capabilities.md)、[0008](adr/0008-use-patch-semantics-for-non-interactive-writes.md)、[0009](adr/0009-restrict-non-interactive-secret-sources.md)、[0010](adr/0010-preflight-non-interactive-writes.md)、[0011](adr/0011-require-explicit-codex-credential-conflict-choice.md)、[0012](adr/0012-fail-non-interactive-writes-on-codex-home-mismatch.md)、[0013](adr/0013-treat-codex-keyring-as-a-use-precondition.md) 和 [0014](adr/0014-stabilize-non-interactive-output-and-exit-codes.md) 中。

## 目的与边界

里程碑 3 添加本地部署与检查命令，其所有改变状态的选择都可以显式给出。它不承诺与每个 TUI 菜单操作对等。

包含的操作：

- 用 `status` 读取本地状态；
- 应用全局与提供商的受管补丁；
- 仅在 Claude Code 状态文件缺失时创建它；
- 当调用方显式解决任何凭据冲突时，切换 Codex 提供商及其活跃 Auth profile。

排除的操作：

- 携带凭据的网络探测；
- 清除备份；
- 移除 Auth profile；
- 需要另行制定安全契约的其他破坏性维护。

## 调用与命令树

不带子命令运行 ccset 保持现有 TUI 行为。显式给出子命令即选择非交互执行；不存在 `--non-interactive` 标志。TUI 路径仍然要求 TTY，而显式命令不要求。

每条非交互命令都要求显式给出 `--agent <id>`。安装检测绝不会替脚本选择目标。提供商的身份始终是一个位置参数形式的 Provider ID，即使某个 Agent 在内部把它称为 name。

```text
ccset --agent <id> status
ccset --agent <id> global set [options]
ccset --agent <id> provider set <provider-id> [options]
ccset --agent codex provider use <provider-id> [options]
ccset --agent claude-code state init
```

`show`、`configure`、`apply` 之类的别名不属于里程碑 3。

在规范示例中，通用的输出与安全修饰符放在子命令之前：

```text
--output human|json
--dry-run
--replace-invalid
```

帮助与版本处理在 TTY 守卫之前完成。这些通用修饰符只在带有显式子命令时才有意义；不带子命令使用它们是用法错误，而不是配置 TUI 的途径。

`--replace-invalid` 只对能从命令取值重建目标的操作有效。`state init` 绝不替换已存在的状态文件。Codex 的 `provider use` 命令只有在所选 Auth profile 本身可读时才能替换无效的路由文档；若已保存的 profile 缺失或无效，它无法凭空重建，只能先执行一次新的 `provider set`。

`status` 接受 `--output`，但不接受变更类修饰符。`--dry-run` 仍会执行与真实执行完全相同的前置检查，包括在本应需要时显式给出 Codex 冲突选择。

## Agent 能力矩阵

| 命令 | Claude Code | opencode | Codex CLI | pi | Grok Build |
| --- | --- | --- | --- | --- | --- |
| `status` | 是 | 是 | 是 | 是 | 是 |
| `global set` | 是 | 是 | 是 | 是 | 是 |
| `provider set` | 是 | 是 | 是 | 是 | 是 |
| `provider use` | 否 | 否 | 是 | 是 | 是 |
| `state init` | 是 | 否 | 否 | 否 | 否 |

在语法上合法但不在所选 Agent 能力声明中的命令返回退出码 `7`；它不会被静默映射为另一个操作。

## 输入契约

### 受管补丁

`global set` 与 `provider set` 应用一个受管补丁：

- 给出的字段被修改；
- 省略的字段保留其在磁盘上的当前值；
- 新目标从空文档开始，而不是从 TUI 模板默认值开始；
- 新建的提供商必须获得构成有效配置所需的字段；
- 既无字段变更、也无 `--unset`、也无密钥来源的调用是用法错误，而不是一次隐式重写。

CLI 不接受通用配置路径、`--set key=value`、JSON/TOML 载荷或输入文件。这使公开契约独立于序列化格式，并防止旧脚本替换它所不了解的字段。

### 字段选项

字段选项是稳定的 kebab-case 名称。下表是 M3 基线；未为某个 Agent 列出的选项会被拒绝。

| Agent 与命令 | 选项 |
| --- | --- |
| Claude Code `global set` | `--proxy-enabled true|false`, `--proxy-url <url>`, `--disable-nonessential-traffic on|off`, `--attribution-header on|off`, `--disable-installation-checks on|off`, `--enable-tool-search on|off`, `--cleanup-period-days <positive-int>`, `--model <text>` |
| Claude Code `provider set` | `--base-url <url>`, `--model <text>`, `--fallback-model <model>`（可重复）, `--default-opus-model <text>`, `--default-sonnet-model <text>`, `--default-haiku-model <text>` |
| opencode `global set` | `--model <text>`, `--small-model <text>`, `--share manual|auto|disabled`, `--autoupdate on|off|notify`, `--username <text>`, `--disabled-provider <provider-id>`（可重复） |
| opencode `provider set` | `--display-name <text>`, `--base-url <url>`, `--npm <package>`, `--models <model-id>`（可重复）, `--timeout <positive-int>` |
| Codex `global set` | `--model <text>`, `--model-provider <provider-id>`, `--reasoning-effort <text>`, `--approval-policy on-request|never`, `--sandbox-mode read-only|workspace-write|danger-full-access`, `--verbosity low|medium|high`, `--context-window <positive-int>` |
| Codex `provider set` | `--display-name <text>`, `--base-url <url>`, `--request-max-retries <positive-int>`, `--stream-max-retries <positive-int>`, `--stream-idle-timeout-ms <positive-int>` |

`wire_api`、`requires_openai_auth` 及其他 Codex 不变量仍由 Agent 负责固定写入，不是 CLI 选项。Claude 的代理字段是耦合的：启用时结果状态必须带有 URL，而 `--proxy-enabled false` 会移除两个代理变量。`--unset proxy-url` 是代理字段唯一的 `--unset` 形式；`--proxy-enabled false` 是一个显式的开关取值，同样会移除两者。对虚拟字段 `proxy-enabled` 执行 unset 会被拒绝。结果开关为关闭状态时设置 `--proxy-url` 是用法错误；启用此前为空的代理需要在现有状态中或同一次调用中给出 URL。

标量选项总是携带显式的值。布尔值为 `true` 或 `false`，选项取值使用上表所示的语义值，整数是十进制正整数。Commander 风格的 `--no-*`、出现即为 true 的标志、空值以及 TUI 的 `unmanaged` 哨兵值都不属于本契约。重复的标量选项和未知的选项名都是用法错误。

选项解析在任何文件系统读取之前完成。因此，语法上无效的调用不可能消耗密钥、创建目录或创建备份。

多值选项以可重复的方式给出，而不是 CSV 字符串。重复给出某个选项即提供完整的新列表；省略它则保留现有列表，`--unset <field>` 会移除它。opencode 的 `--models` 仍逐条合并模型 ID，保留现有模型对象内部的非受管设置。

### 显式移除

可选的非密钥字段只能通过可重复的 `--unset <field>` 移除：

```text
ccset --agent codex global set --unset model --unset verbosity
```

在同一次调用中对同一字段既赋值又 unset 是一个错误。Provider ID、必需字段和密钥不能被 unset。不存在 `--clear-*` 别名，空字符串也绝不表示移除。

### 密钥来源

提供商密钥没有携带取值的 CLI 选项。它只能来自以下二者之一：

```sh
CCSET_TOKEN='...' ccset --agent codex provider set acme --base-url https://api.example.com
printf '%s' "$TOKEN" | ccset --agent codex provider set acme --token-stdin --base-url https://api.example.com
```

规则如下：

- `CCSET_TOKEN` 和显式的 `--token-stdin` 是仅有的两种来源；
- 不存在 `--token`、`--api-key`、位置参数形式的密钥或密钥文件选项；
- 同时给出两种来源是错误，没有优先级规则；
- stdin 绝不会被隐式读取，在 TTY 上使用 `--token-stdin` 是用法错误；
- 两种来源都省略时保留现有密钥，但新建的提供商（或没有已保存密钥的提供商）在缺少密钥时会失败；
- 通过 provider set 输入密钥绝不会启用某个提供商。

stdin 会被读取到 EOF，上限 64 KiB。至多移除末尾的一个 LF 及其前面可选的 CR。得到的值必须非空、是有效的 UTF-8、不含 NUL、为单行，且没有前导或尾随空白。`CCSET_TOKEN` 使用相同的校验，但不移除行尾符。错误只指明来源和原因；任何密钥，无论是否经过遮罩，都不会进入输出、日志、堆栈跟踪或进程参数。实践中，请通过 CI 密钥库或已导出的环境注入 `CCSET_TOKEN`，不要在内联 shell 赋值中键入字面值，那可能进入 shell 历史。

### 无效目标与 Codex 冲突

操作的所有目标都会在首次写入之前读取并校验。已存在的无效目标默认返回 `4`。`--replace-invalid` 显式允许对可重建的目标先备份、再以空文档为基础写入；它不会绕过字段校验、权限或其他前置条件。

Codex 的 `provider use` 把与所选 Auth profile 不是逐字节一致的活跃 `auth.json` 视为安全冲突。调用方必须恰好选择其一：

```text
--adopt-current-as <provider-id>
--replace-current-auth
```

第一种把活跃字节保存在一个新的、尚不存在的 Auth profile 名下；第二种不经采纳直接替换它们。两条路径都会备份活跃文件。已经生效且可读的 profile 无需任何一个选项；同时给出两个选项是一个错误。

当 `CODEX_HOME` 解析到的目录与 ccset 的目标不同时，Codex 写入会在任何改动发生之前失败。`status` 可以把这种不匹配作为警告报告。当 `cli_auth_credentials_store = "keyring"` 时，`provider set` 可以在给出警告的情况下保存可复用的 Auth profile，但 `provider use` 会在写入之前失败，因为 `auth.json` 并不是实际生效的凭据来源。

`state init` 只在 `~/.claude.json` 不存在时创建它。已存在的有效文件作为无变更的成功处理；已存在的无效文件保持原样并返回退出码 `4`。

## 输出契约

非交互执行绝不挂载 Ink、发出 ANSI 控制序列，也不显示进度加载动画。

### 面向人的输出

面向人的输出是行式的。成功的写入会列出每一个发生变化的绝对路径、产生的权限模式、所有备份路径、启用或启动命令，以及警告。未发生变化的操作会报告 `changed: false`，且不会声称做过备份。面向人的文本继续使用 i18n 文案目录。密钥绝不会被打印，包括遮罩后的预览；status 只报告是否存在密钥。

成功与警告输出到 stdout。错误输出到 stderr，包含一条翻译后的消息，不带堆栈跟踪，也不含携带密钥的操作系统文本。

### JSON 输出

`--output json` 无论成功还是失败都向 stdout 恰好输出一个 JSON 对象；对于普通命令错误，stderr 保持为空。自 `schemaVersion: 1` 起，schema 只做增量扩展；消费方必须忽略未知字段。

成功信封：

```json
{
  "schemaVersion": 1,
  "ok": true,
  "exitCode": 0,
  "agent": "codex",
  "operation": "provider.set",
  "changed": true,
  "data": {
    "targets": [
      { "path": "/home/example/.codex/config.toml", "mode": "0600", "backupPath": null }
    ],
    "activationCommand": "codex"
  },
  "warnings": []
}
```

失败信封：

```json
{
  "schemaVersion": 1,
  "ok": false,
  "exitCode": 4,
  "agent": "codex",
  "operation": "provider.use",
  "error": { "code": "invalidConfig", "params": { "path": "/home/example/.codex/config.toml", "position": "line 4, column 2" } }
}
```

JSON 使用稳定的操作 ID、警告/错误码、原生的布尔值和数字、绝对路径，并以 `null` 表示不存在的备份。它不包含翻译后的标签、原始密钥值、遮罩后的密钥或响应体；URL、模型、枚举设置等非密钥值可以出现在结构化的 status 数据中。Status 用 `secretPresent: true|false` 表示凭据字段，并携带可解析的数据和警告码。部分发生的运行时失败会带有 `partial: true` 和已经提交的路径。

信封中的数字型 `exitCode` 始终与进程退出状态一致。当 `status` 因某个目标无法解析而返回 `4` 时，信封带有 `ok: false`、对应的错误对象以及 `data` 中可读取的部分，而不是丢弃检查结果。

当任一被检查的目标无法解析时，`status` 返回退出码 `4`，同时仍返回它能够读取的所有部分。缺少 Base URL、keyring 模式或 `CODEX_HOME` 警告这类普通发现不会改变其成功码。

## 退出码

| 退出码 | 名称 | 含义 |
| --- | --- | --- |
| `0` | `EXIT_OK` | 成功完成；允许带警告或没有变更 |
| `1` | `EXIT_RUNTIME` | 未分类的运行时或 I/O 失败；提交中途的多文件失败以 `partial` 报告 |
| `2` | `EXIT_NOT_TTY` | 仅限不带子命令的 TUI 在没有 TTY 时被调用 |
| `3` | `EXIT_PERMISSION` | 目标路径权限不足 |
| `4` | `EXIT_INVALID_CONFIG` | 某个已存在的目标无法解析；`status` 仍可能返回其部分报告 |
| `5` | `EXIT_USAGE` | 非法的命令/选项/字段/取值、缺少 Agent 或必需输入、重复的标量选项，或密钥来源错误 |
| `6` | `EXIT_CONFLICT` | 存在需要显式选择的安全冲突，目前是 Codex 活跃 Auth 替换 |
| `7` | `EXIT_UNSUPPORTED` | 所选 Agent 缺少该命令，或某项 Agent 前置条件使它无效，例如 keyring 或 `CODEX_HOME` 不匹配 |

退出码 `0` 也用于幂等的空操作（no-op）和非致命警告。信号保留平台的正常终止行为，不在本表范围内。

## 写入与复用架构

实现应当保持展示层与领域操作之间的深层边界：

1. 添加由 Agent 拥有的非交互命令声明，其中包含命令 ID、字段选项元数据和处理器。注册表保持静态；添加一个 Agent 仍然只改动它自己的模块和注册表中的一行，而不是解析器里硬编码的 Agent 路径列表。
2. 引入结构化的 `CommandInput`/`OperationResult` 层。命令处理器接收仅针对磁盘的补丁、`unset` 集合、密钥值（如有）、恢复策略和 dry-run 标志，然后返回原始路径、被改动的目标、警告和错误码。它绝不返回 `Screen` 或翻译后的句子。命令字段声明可以引用现有的 manifest 校验器和字段 ID；它们不得在解析器中重复校验规则。
3. 把每个 Agent 现有的保存路径拆分为 `read -> seed/overlay -> validate -> plan -> apply`。Agent 代码保留字段映射、耦合字段、Codec 和多文件规则；`src/core` 保留合并、备份、原子写入、权限模式以及预检/提交原语。
4. 让 TUI 的提交回调调用同一套 plan/apply 操作。`runSave()` 仍是 TUI 对其畸形配置确认 Screen 的适配器。CLI 传入已经确定的恢复策略，绝不调用 `Action.run`。
5. 在现有已翻译的 `StatusSection` 视图旁提取原始 status DTO；TUI 展示器负责翻译它们，而 JSON 直接序列化 DTO。同样地，把共享边界中已翻译的 `WriteReport.notes` 替换为警告/错误码和参数，然后让两个展示器各自渲染它们。
6. 把 Codex 私有的启用工作提取到操作层，让 `openActivate()` 在其现有的确认/表单 Screen 中包装它。在任何重命名或复制之前，先预检路由文档、所选 profile、keyring 设置和主目录路径。

不存在跨文件的文件系统事务。操作先准备好全部渲染内容和备份，再按 Agent 文档记载的顺序提交；如果提交开始后发生意外失败，则以 `partial: true` 报告受影响的路径。空操作会把计划得到的受管结果（以及任何 sidecar 字节）与磁盘比较，从而完全跳过备份和写入。`--dry-run` 执行相同的读取、校验和计划步骤，但绝不创建备份或改动文件。

## 实现顺序

1. 添加退出码常量、命令输入/结果 DTO、密钥读取器、选项校验（包括 Commander 错误拦截）以及面向人/JSON 的展示器，但不启用写入。
2. 把三个 Agent 的保存/status 路径重构到 plan/apply 和原始 DTO 背后；每一步都保持现有 TUI 行为和验证 fixture 不变。
3. 添加通用解析器和能力分发，然后为 Claude Code 和 opencode 启用 `status`、`global set` 和 `provider set`。
4. 添加 Codex 的 `provider use`、Auth 冲突选择、keyring 与 `CODEX_HOME` 前置条件，以及多目标预检/部分报告。
5. 在其允许的操作中启用 `state init`、空操作检测、`--dry-run` 和 `--replace-invalid`。
6. 只有当命令 fixture 通过之后才更新翻译和用户文档；在宣布里程碑完成之前添加 Windows/WSL 证据。

## 验证矩阵

| 领域 | 必需检查 |
| --- | --- |
| 模式与解析器 | 不带子命令经管道运行时以 `2` 退出且无 ANSI；显式命令可在无 TTY 的情况下运行；缺失/未知的 Agent、命令、字段、重复标量、枚举、整数和空补丁返回 `5` |
| 密钥 | 环境变量与 stdin 成功；同时给出两种来源、TTY 上的 stdin、多行/NUL/超限/含空白输入都会失败；token 不出现在 argv、stdout、stderr、JSON、错误和日志中 |
| 写入 | 每个支持写入的 Agent 都保留非受管键、使用 `0600`、只备份被改动的目标、遵循 `--dry-run`，并返回准确的空操作报告 |
| 无效文件 | 全目标预检、退出码 `4`、替换前先备份、不出现已知的部分写入，以及正确的 `--replace-invalid` 边界 |
| Codex | Auth 采纳/替换冲突、现有 profile 的幂等性、不可读的 profile、keyring、`CODEX_HOME`、路由与 sidecar 写入，以及 `partial` 报告 |
| Status 与输出 | 带 `secretPresent` 的结构化 status、解析失败加退出码 `4`、仅含警告的成功、JSON schema、稳定的警告/错误码、无 ANSI，以及面向人的 i18n |
| 回归与平台 | 现有 `npm run verify:*` fixture、新增可执行 CLI fixture、mutation-to-fail 检查、POSIX 权限模式检查、Windows Terminal/PowerShell 与 WSL 手工场景 |

PRD 的里程碑 3 条目应链接到这里。README 变更、发布说明和 Important Documentation 登记册属于实现与验证变更，而不只属于这份已接受的设计。

## 待定的实现问题

产品契约层面已没有遗留决策。实现仍可自行选择内部名称和辅助边界，只要上述可观察契约与现有 TUI 安全保证保持不变。
