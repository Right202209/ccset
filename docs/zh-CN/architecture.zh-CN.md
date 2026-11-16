# 架构

[English](../architecture.md) | 简体中文

[AGENTS.md](../../AGENTS.md) 管贡献规则，[CONTEXT.md](CONTEXT.zh-CN.md) 管术语。本文映射当前源码；[未解决安全项](../../review.md) 是限制，不是已完成修复。

## 入口与契约

| 源码 | 职责 |
| --- | --- |
| [cli.tsx](../../src/cli.tsx) | 参数、`CCSET_*`、模式分流、语言、TTY 检查、退出 |
| [registry.ts](../../src/registry.ts) | 静态 Agent 导入、消息登记 |
| [types.ts](../../src/types.ts)、[ctx.ts](../../src/ctx.ts) | TUI `ActionResult` 与上下文 |
| [operations/types.ts](../../src/operations/types.ts)、[index.ts](../../src/operations/index.ts) | `OperationRequest → executeOperation → OperationResult` 或类型化错误 |
| [commands/](../../src/commands/) | 选择器／预设展开、声明驱动解析、密钥输入、输出、启动 |

无位置子命令时，检查 stdin TTY 后进入 TUI；help／version 提前结束。Ink／React 渲染器仅在 TUI 路径加载；命令不调用 Screen 回调。

位置 Agent／`--agent` 优先于 `CCSET_AGENT`，冲突的 CLI 选择报错。仅 stdin 与 stdout 均为 TTY 的命令可推断唯一已检测 Agent；TUI 展示本地检测结果，显式选择绕过检测。检测不执行 Agent、不联系 Provider（ADR 0020）。

parser 消费 Agent 自有字段声明，预设展开为相同选项，显式字段／unset 优先。仅终端预设 `add` 可隐藏输入密钥。operation 准备参数数组，[launch.ts](../../src/commands/launch.ts) 仅对 live Claude `run` 以 `shell: false` 启动。

## 共享写入与 Codec

`read → overlay → validate → render/plan → apply`

1. Agent 重读目标，映射 TUI 表单或 CLI patch，校验最终提案。
2. [config-file.ts](../../src/core/config-file.ts) 通过 Codec 解析／生成，并再次检查输出语法。
3. [commit.ts](../../src/operations/commit.ts) 在变更前规划所有普通命令目标，比对输出与 baseline 字节。
4. `applyPlan` 依次备份、原子替换，失败时报告已提交项，不提供跨文件事务。

CLI `skipUnchanged: true`，普通 TUI 保存为 `false`。dry-run 不建目录、备份或文件；不存在的目标收到空文档为 no-op。已授权替换损坏文件却生成空结果的边界仍见[安全待办](../../review.md)。

表单写入当前持有的托管值；保存时重读保护非托管数据，不会把外部改动合入表单字段。每次 Edit 需重新播种，即使 Provider Screen 在前次保存后仍留在导航栈。

| 核心源码 | 机制 |
| --- | --- |
| [merge.ts](../../src/core/merge.ts) | 逐叶 set／delete、自有属性遍历；拒绝 `__proto__`，保留 `constructor`／`prototype` 数据 |
| [atomic-file.ts](../../src/core/atomic-file.ts)、[json-file.ts](../../src/core/json-file.ts)、[copy.ts](../../src/core/copy.ts) | 随机排他私有 stage，替换时 rename；创建时设 POSIX 权限，chmod 重申为尽力执行 |
| [create-file.ts](../../src/core/create-file.ts) | 仅目标不存在时 hard-link 发布，无覆盖回退 |
| [backup.ts](../../src/core/backup.ts) | 暂存复制、每 basename 保留十份、部分复制诊断／清理 |
| [save.ts](../../src/core/save.ts)、[errors.ts](../../src/core/errors.ts) | TUI 恢复确认、类型化 parse／permission／partial 错误 |
| [remove.ts](../../src/core/remove.ts)、[provider-actions.ts](../../src/core/provider-actions.ts) | 先备份后删除、整文件／块删除、确认式 Provider 管理 |

原子 rename 防止单次发布截断，不提供锁、CAS、排他最终备份名或 fsync 耐久性；不能声称防并发覆盖或断电丢失。

`LoadedConfig` 同时携带数据和原文：JSON 合并后重序列化，JSONC／TOML 编辑 span。保格式 Codec 的空写入字节一致，修改范围外的非托管文本保留。

- [TOML](../../src/core/toml/) 分离 scan／read／check／edit；inline table 托管叶子可展开为 dotted assignments；删除 Provider 也删其所属表，输出重新校验（ADR 0003）。
- [JSONC](../../src/core/jsonc/) 使用 npm `jsonc-parser` 的语法／span，编辑由 ccset 完成；库 `modify()` 改了邻近紧凑数组，未通过保留语料（ADR 0004）。
- TOML 刻意接受 `\e`、闰秒、年份 `0000`；Python `tomllib` 仅作一致性语料 oracle，扩展单独验证。
- 宽松读取不等于允许写入。损坏 Agent 文件需要确认或声明支持的 `--replace-invalid`，原文留在备份。

## Agent 模块

路径、默认值、manifest、校验、动作、命令、消息均属 `src/agents/<id>/`。Status 无写入；具体路径／选项见[用户指南](user-guide.zh-CN.md#agent-配置) 和[命令契约](milestone-3-non-interactive.zh-CN.md)。

| Agent | 特有策略 |
| --- | --- |
| Claude Code | 全局／Provider 分文件 JSON；状态 create-only；唯一确认式 Messages 探测。use 生成会话命令，run 执行 |
| opencode | 已有 JSONC 优先，否则 JSON；不创建 JSONC，不改旁边旧 JSON；模型逐 ID 合并 |
| Codex | TOML 路由、Auth profile、接管路由元数据；保存坚持 Responses／认证不变量，拒绝覆盖密钥来源；live auth 整体替换。CLI 拒绝 home 不匹配，TUI 提示；两种激活都查 keyring，但编排不同且有待办 |
| pi | JSONC models、JSON settings；模型数组按有效 ID 合并并保留元数据；use 同写默认 Provider／model；login auth 非托管 |
| Grok Build | TOML `model.<id>`、`models.default`；内置覆盖可无密钥／端点；login auth 非托管 |

opencode 的 `XDG_CONFIG_HOME`、pi 的 `PI_CODING_AGENT_DIR`、Grok 的 `GROK_HOME` 仅在 `ctx.home` 为真实 home 时应用。Codex 不跟随 `CODEX_HOME`，CLI 写入拒绝不匹配。临时 home fixture 清除继承覆盖；上游启动需独立隔离。

## 导航与终端渲染

[useScreens.ts](../../src/ui/useScreens.ts) 返回时仅重载产生 list／status 的任务，不能保存写操作作重载任务。成功删除的 `closesOrigin` 关闭 Provider 与确认 Screen；随后清理忽略项的偏好失败可能漏报已完成删除。

草稿与脏 baseline 独立。保存失败或拒绝损坏替换保留草稿，仅成功保存／显式放弃清除未保存状态；确认光标初始选择安全项。

[Layout.tsx](../../src/ui/Layout.tsx) 统一计算 chrome，传主 Panel 内部 Viewport。[Viewport.tsx](../../src/ui/Viewport.tsx)、[terminal.ts](../../src/ui/terminal.ts)、[text-fit.ts](../../src/ui/text-fit.ts) 管窗口、能力、显示宽度。Frame 随内容增高，变窄只清可见绘制，不清 scrollback；数字／鼠标对应可见行。

Glance 在选择 Agent／消息后读状态并丢弃过期刷新；Preview 复用列表记录，只显示凭据存在性和合法 URL origin。View 不新增 Agent 文件读取路径（ADRs 0017–0018）。

## 界面语言与消息

TUI：调用覆盖 → 已保存偏好 → 首次提示；命令：调用覆盖或英文。均不推断 `LANG`。registry 导入时合并 Agent 消息并拒绝重复；fixture 解析 Agent 键前必须导入。

## 从已修复失败提炼的禁用模式

| 禁止 | 原因／替代 |
| --- | --- |
| 后续 Edit 复用列表旧记录 | 轮换后恢复旧密钥；每次进入表单重读（`3fdbce1`） |
| 整体替换 env／options／models | 丢失非托管成员／保留模型元数据；逐叶／成员编辑 |
| 删除写空字符串，或把 false 当删除 | 代理仍在或布尔丢失；显式删除 |
| 先查不存在再 rename 覆盖 create-only | 覆盖并发创建的状态／profile；排他发布（`ec668ba`） |
| 独立 fixture 共用临时 home | 新文件场景意外产生备份；各自隔离（`0569b3e`） |
| 模型 ID 套用 Provider ID 规则 | 拒绝含点／斜线／冒号的真实模型；用 Agent 模型校验（`59121f1`） |
| 转发包与同版本本地 tarball 同装 | npm 由本地满足依赖，自我比较；独立安装并断言 registry 解析（`a999c4a`） |
