# 命令契约

[English](../milestone-3-non-interactive.md) | 简体中文

描述当前实现（含 ADR 0020）。历史 M3 计划保留在 git；[issue #56](https://github.com/Right202209/ccset/issues/56) 跟踪剩余设计差异。以实际 parser、输出和退出码为准，不据旧计划修改运行时。

来源：[parser](../../src/commands/parser.ts)、[option reader](../../src/commands/parser-options.ts)、[Agent 声明](../../src/agents/)、[operation 类型](../../src/operations/types.ts)、[JSON](../../src/commands/json.ts)、[退出码](../../src/core/errors.ts)。

## 调用与命令树

```text
ccset [--agent <agent>]                      # TUI
ccset <agent> status [--json]
ccset <agent> global set <字段选项>
ccset <agent> provider set <provider-id> <字段选项>
ccset <agent> use <provider-id>               # 别名 provider use
ccset <agent> run <provider-id> -- <参数>
ccset <agent> add [provider-id] --preset <preset-id>
ccset presets list [搜索词] [--json]
ccset --agent claude-code state init
ccset --help | --version
```

Agent 为 `claude-code`、`opencode`、`codex`、`pi`、`grok-build`。位置选择器等同 `--agent`，优先于 `CCSET_AGENT`；冲突 CLI 选择退出 64。无选择时，仅 stdin 与 stdout 均为 TTY 的命令可推断唯一检测结果；其他调用必须显式指定。`presets list` 不依赖 Agent，也可按 Agent 筛选。

五种均支持 status／global set／provider set／use；仅 Claude 支持 run／state init。删除／忽略／备份清理／探测仅 TUI。Agent 不支持的命令退出 66。

Claude use 校验并打印会话命令，其他 use 保存下次启动选择。run 无 shell 启动已安装 Claude，继承 I/O、返回子进程退出状态（信号为 128 + 信号编号）；仅 run 接受 `--` 后透传，use／dry-run 不启动。

## 托管补丁与选项

提供字段即修改，省略保留，`--unset <fieldId>` 删除可选字段；不填入 TUI 默认值。必填由 Agent 定义：新 Claude／opencode／pi Provider 需端点与密钥；Codex 另需 `--display-name`（可读已存 key 可满足密钥要求）；Grok 覆盖可无密钥／端点。

标量需非空值；重复标量、无效 choice、未知选项、同时 set／unset 同字段报错。列表重复选项，不收 CSV；opencode／pi 保留留下模型的非托管数据。

unset 使用声明 `id`，如 `smallModel`、`modelProvider`、`models`，不是选项拼写。set 无 patch／unset／密钥即报错；无通用路径、payload 或 input-file 参数。

| Agent | global set | provider set |
| --- | --- | --- |
| Claude Code | `--proxy on\|off`、`--proxy-url`、`--disable-nonessential-traffic on\|off`、`--attribution-header on\|off`、`--disable-installation-checks on\|off`、`--enable-tool-search on\|off`、`--cleanup-period-days`、`--model` | `--base-url`、`--model`、可重复 `--fallback-model`、`--default-opus-model`、`--default-sonnet-model`、`--default-haiku-model` |
| opencode | `--model`、`--small-model`、`--share manual\|auto\|disabled`、`--autoupdate on\|off\|notify`、`--username`、可重复 `--disabled-provider` | `--display-name`、`--base-url`、`--npm`、可重复 `--model`、`--timeout` |
| Codex | `--model`、`--model-provider`、`--reasoning-effort`、`--approval-policy on-request\|never`、`--sandbox-mode read-only\|workspace-write\|danger-full-access`、`--verbosity low\|medium\|high`、`--context-window` | `--display-name`、`--base-url`、`--request-max-retries`、`--stream-max-retries`、`--stream-idle-timeout-ms` |
| pi | `--provider`、`--model`、`--thinking-level` | `--base-url`、`--api`、可重复 `--model` |
| Grok Build | `--model` | `--model`、`--base-url`、`--name`、`--api-backend` |

范围／choice／可 unset 性以 declaration／manifest 为准。Claude proxy off 删除两代理变量，`--unset proxyUrl` 删除 URL；虚拟 proxy 开关不可 unset。Codex 每次重申 `wire_api = "responses"`、`requires_openai_auth = true`，不提供这些选项。

opencode／Codex／pi 支持 use --model。opencode 要求存在且启用的 Provider／模型；pi 默认首个模型，无模型覆盖必须显式给 model。Grok use 仅写 `models.default`；带点内置 ID 走 global set --model。

| 修饰项 | 契约 |
| --- | --- |
| `--json` | 普通命令一个 stdout envelope；live run 拒绝 |
| `--dry-run` | 校验／计划但不写文件、目录、备份；status 拒绝 |
| `--replace-invalid` | global／provider set 和 pi／Grok use 支持，备份可重建的损坏原文；status／state init／run／Claude、opencode、Codex use 拒绝 |
| `--token-stdin` | provider 写入／预设 add 的显式 stdin 密钥来源 |

Codex CLI provider set 即使 replace-invalid 也不能重建不可读 Auth profile；路由文档可以重建。

## 预设与密钥

add 将内置数据展开为 provider set，显式字段／unset 覆盖初值，重复应用也会 patch 已有 Provider。省略 ID 使用预设 ID，保留名加 `-ccset`。保存不选择 Provider；Codex 模型建议在返回的 nextCommand 中。

脚本仅接受 `CCSET_TOKEN`／`--token-stdin` 之一。仅显式读取 stdin，拒绝 TTY，最多 64 KiB 合法 UTF-8，最多去掉末尾一个 LF／CRLF／CR。输入非空、无 NUL、单行、无首尾空白；环境输入同样校验但不去末尾换行。

仅 stdin 与 stdout 均为 TTY、人类输出、非 dry-run 的预设 add 可隐藏提示。脚本／JSON／dry-run 要求显式来源；无效选项在消费密钥／写入前失败。真实密钥不得放 argv 或会记录 shell 历史的内联示例。

## Codex 切换

- live auth 与**任何**已保存 profile 都不匹配时，必须二选一 adopt-current-as 新 ID／replace-current-auth；均备份 live 文件。
- 接管排他创建 profile 并记录原路由，无需接管时提出接管会拒绝。
- 选定 profile／有效路由必须可读合法；keyring／CODEX_HOME 不匹配在 CLI 变更前拒绝。
- 先提交路由再整体替换 auth；auth 失败时检查是否已落盘，按需恢复路由／model，报告残留提交与回滚失败。
- TUI 单独编排，有[待解决差异](../../review.md)；共享 commit core 不代表完整界面一致性。

## 输出与退出码

人类输出为本地化行：成功／警告 stdout，失败 stderr。JSON 顶层有 `schemaVersion: 1`、`agent`、`operation`、`ok`、`exitCode`；成功另有 `changed`、`dryRun`、`targets`、`warnings`，可选 data／launchCommand／activation／nextCommand。兼容性读取忽略新增字段。

target 含绝对 path、mode、changed、backupPath（无则 null）。partial 是已变更路径数组，不是布尔。失败用 error.code／params，可含 error.rollback；status 解析失败保留可读 data／errors，ok false、退出 4。普通 JSON 命令失败 stderr 为空。

凭据使用 Agent 自有存在性字段（tokenPresent／apiKeyPresent 等）。任意非托管内容不能自动安全导出，现有投影缺口仍见安全待办。

| 退出码 | 含义 |
| --- | --- |
| 0 | 成功，含警告／no-op |
| 1 | 运行时／I/O、校验拒绝、环境无效冲突 |
| 2 | stdin 非 TTY 却启动 TUI |
| 3 | 目标权限失败 |
| 4 | 目标解析失败，status 可带部分可读数据 |
| 64 | 用法／选择器／字段／密钥来源错误 |
| 65 | 未知 Agent |
| 66 | 所选 Agent 不支持命令 |

检查选择见[验证指南](verification.zh-CN.md)，具体断言由 `verify:commands*`、`verify:short-commands` 固定。
