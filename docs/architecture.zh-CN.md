# 架构

[English](architecture.md) | 简体中文

变更工作流见 [AGENTS.md](../AGENTS.md)，领域词汇见 [CONTEXT.md](../CONTEXT.md)。本指南解释运行时边界，以及贡献者必须维持的各项保证背后的原因。规范与已接受的决策位于 [PRD.md](../PRD.md)、[命令规范](milestone-3-non-interactive.md) 和 [ADR](adr/) 中。

## 入口与契约

`src/cli.tsx` 负责进程参数、`CCSET_*` 覆盖、调用模式、界面语言选择和退出状态。显式的子命令会选择命令适配器；没有子命令时，TTY 守卫先于交互式渲染执行。命令模式不得加载 Ink。把边界值向内传递，而不是在辅助函数中再次读取覆盖项。

`src/types.ts` 定义 TUI 契约：Agent 返回一个 `ActionResult`（`form`、`list`、`status`、`confirm` 或 `message`），Ink View 渲染这些形态而不需要任何 Agent 特定的知识。`src/ctx.ts` 负责共享上下文；`types.ts` 重新导出它。Agent 模块不得从 `src/ui/` 导入。

非交互契约是 `src/operations/types.ts` 与 `src/operations/index.ts` 中的 `executeOperation`：一个规范化的 `OperationRequest` 产生一个 `OperationResult` 或类型化错误。Screen、翻译后的展示文本和 `ManagedWrite[]` 不跨越公开的操作契约。见 ADR 0006。

`src/commands/` 把 argv 适配到该契约。解析器使用各 Agent 的声明，密钥读取器提供 `CCSET_TOKEN` 或显式选择的 stdin，展示器生成已本地化的行或 `schemaVersion: 1` 的 JSON 信封。打印的错误与进程退出状态必须一致。命令规范记录了已知的一致性差异；更改它们属于行为变更，而不是文档清理。

## 共享写入与 Codec

配置保存用 `src/operations/commit.ts` 规划并应用写入。流程是 `read → overlay → validate → plan → apply`：保存时读取当前磁盘状态，校验提案的结果，渲染并预检所有命令目标，然后按顺序提交。非交互的空操作跳过写入和备份；dry-run 在计划处停止。多目标提交之后发生失败时，已写入的路径会报告为部分完成，而不是已回滚的事务。

TUI 表单映射与命令补丁映射保持分离。TUI 中留空的字段可以发出删除；省略的命令选项保留磁盘值，命令删除必须显式给出。模板默认值不得填充被省略的补丁字段（ADR 0008）。`value` 为 `undefined` 的 `ManagedWrite` 表示删除；布尔值 `false` 仍然是一个值。

共享的文件安全辅助函数位于 `src/core/` 下：

| 模块 | 职责 |
| --- | --- |
| `merge.ts` | 应用受管叶子写入，同时保留非受管的同级键 |
| `json-file.ts`、`copy.ts` | 原子的临时文件/重命名写入与整文件复制，POSIX `0600` |
| `backup.ts` | 在 Agent 提供的目录中备份并按文件轮换 |
| `config-file.ts` | 通过所选 Codec 读取、检查、渲染并写入 |
| `save.ts` | 把保存错误转换为 TUI 的恢复/确认 Screen 与成功消息 |
| `mask.ts`、`errors.ts` | 不泄露密钥的显示，以及带消息键与退出码的类型化错误 |
| `values.ts`、`validate.ts` | 共享的强制转换与校验器工厂；Agent 策略留在 Agent 内 |
| `paths.ts`、`settings.ts` | 共享的主目录/备份辅助函数，以及 ccset 自己的界面语言偏好文件 |

`ConfigFile.codec` 选择 `json`、`jsonc` 或 `toml`。`LoadedConfig` 同时携带解析后的数据与原始文本。JSON 可以从合并后的对象渲染；TOML 和 JSONC 则编辑原文区间，以保留注释、空白和键顺序。对这些格式而言，空的写入列表必须做到逐字节一致，受管编辑必须不碰无关字节。

`src/core/toml/` 下的 TOML Codec 把扫描、读取、严格检查和编辑分开（ADR 0003）。JSONC Codec 使用 npm 的 `jsonc-parser` 处理语法和区间，但编辑器是 ccset 自己的，因为该包的格式化器会改动非受管字节（ADR 0004）。宽容读取不授权写入：未通过严格检查的目标需要 TUI 确认，或由命令显式选择 `--replace-invalid`。获得授权的替换会先备份无法读取的原文件。`ConfigParseError` 携带按格式区分的消息键；`runSave` 会捕获它。

## Agent 模块

每个 `src/agents/<id>/` 模块拥有自己的路径、默认值、manifest、校验器、消息、操作和命令声明。`manifest.ts` 保持为纯数据；用 `seed*` 和 `emit*` 辅助函数做表单/配置映射，保存时复用提交核心。Status 构建器只读取而不写入。命令的 status DTO 与 TUI 的 status 展示可以共享读取，同时保持各自的输出契约分离。

`src/registry.ts` 是静态的：添加一个导入和一个数组条目，绝不扫描路径做动态导入。它在模块加载时合并各 Agent 的文案目录，并拒绝重复的键。解析 Agent 字符串的 fixture 也必须导入注册表。

PRD 的扩展边界允许 Agent 模块内部包含多个文件。fixture、npm 脚本接入和文档是额外的预期改动。新的共享能力需要一次显式的核心/接口改动，并带有自己的验证范围；见[添加 Agent](adding-an-agent.md)。

容易遗漏的 Agent 特定约束：

- **Claude Code：** 全局设置与每个 Provider 各用一个独立的 JSON 文件。`state.ts` 仅在 `~/.claude.json` 缺失时创建它；绝不更新这个活跃状态存储。`test-connection.ts` 是唯一的出站网络路径：发送 token 之前先确认目标主机，且绝不打印响应体。
- **opencode：** 各 Provider 共享同一个文档，位于 `provider.<id>` 配置块之下。`provider.<id>.models` 按模型 id 合并，被保留的模型自身设置不变。`paths.ts` 中的 `opencodeTarget` 选择已存在的 `.jsonc`，否则选择 `.json`；选定 `.jsonc` 时，旧的 `.json` 保持原样。ccset 不创建 `.jsonc`。上游合并顺序的证据与待完成的运行时核实作为 U6 记录在验证登记册中。
- **Codex：** Provider 密钥保存在 `config.toml` 之外的 `auth.<id>.json` Auth profile 中。保存 Provider 时会重新断言 `wire_api = "responses"` 与 `requires_openai_auth = true`，并拒绝与之冲突的 `env_key` 或 `experimental_bearer_token` 凭据来源。活跃的 `auth.json` 在备份之后整体复制；被收养的凭据保留 ccset 未建模的字段。切换先写路由、再写凭据，并显式处理失败。非交互切换要求显式给出凭据冲突的选择；`CODEX_HOME` 不一致与密钥链前置条件遵循 ADR 0011–0013。
- **pi：** 各 provider 共享 `~/.pi/agent/models.json`，以 `providers.<id>` 配置块存放；启动默认项（`defaultProvider`、`defaultModel`、`defaultThinkingLevel`）位于另一个文档 `settings.json`，因此 `provider.use` 写的两个叶子在另一个文件里，与 `provider.set` 不同。`models` 数组按成员 id 合并（它是 JSON 数组，不是映射），在保存时基于重新读取的内容生成；没有可用字符串 `id` 的成员原样保留。`models.json` 使用格式保留的 JSONC Codec 编辑，因为 pi 读取该文件时会剥离注释；`settings.json` 是纯 JSON。`auth.json` 是 pi 的 `/login` 凭据存储——Status 会如实标注它，ccset 绝不编辑。`PI_CODING_AGENT_DIR` 仅在本次运行指向真实主目录时生效，与 opencode 的 `XDG_CONFIG_HOME` 规则一致。

- **Grok Build：** ccset 管理的一切都集中在同一个 TOML 文档 `~/.grok/config.toml` 中：`[models].default` 指定启动模型，每个 `[model.<id>]` 表是一个 Provider。受管叶子是 `model`、`base_url`、`name`、`api_backend` 和内联的 `api_key` 密钥；Grok 按 `api_key` → `env_key` → 会话令牌 → `XAI_API_KEY` 的顺序解析凭据，因此没有任何密钥或端点是*必需的*——id 命名了内置模型的配置块可以只覆盖自己设置的字段，没有 `base_url` 的配置块只会被警告而不是被拒绝。`provider.use` 只写 `models.default` 这一个叶子，并在该 id 未定义 `[model.*]` 块时给出警告（它可能是内置模型）。`auth.json` 是 Grok 自己的凭据存储——Status 会如实标注它，ccset 绝不编辑。`GROK_HOME` 仅在本次运行指向真实主目录时生效，与 opencode 的 `XDG_CONFIG_HOME` 规则一致。Provider id 遵循共享的命名模式，因此带点的内置 id（`grok-4.6`）绝不会是 ccset 可管理的表 id；默认项通过自由文本的 `models.default` 指向它，手写的带引号表会原样保留。

opencode、Codex、pi 和 Grok Build 没有 Test connection：现有的探测请求说的是 Anthropic 协议，而任意 SDK/Responses 端点需要各自的契约。实际兼容性的未知项应记入登记册，而不是被当作理所当然的保证。

## 导航与终端渲染

`src/ui/useScreens.ts` 拥有一个由 `Frame` 组成的栈。只有 `list` 和 `status` 的 Frame 会保留当初生成它的任务，以便返回时重新加载，因为重跑它们只是读取。从成功消息返回绝不能重新运行产生它的那次写入。

由 `replace()` 返回的确认会叠放在表单之上，`App` 在提交之前把已填写的值暂存在表单的 Frame 上。拒绝替换无法解析的文件、或从失败的保存返回时，必须保留草稿，包括被遮掩的密钥。未保存修改的提示让表单保持挂载但隐藏；确认提示的光标初始落在安全的选择上。

Frame 标题出现在顶栏的导航路径中，空间不足时从前面开始省略。TUI 把输出留在终端的回滚缓冲区中，并对过长的区域做窗口化，而不是占用一个固定高度的屏幕（ADR 0002）。

- `terminal.ts` 负责字形、颜色、忙碌动画帧，以及七位终端上折叠文案目录文本的 `fold()`。新的绘制位置必须使用终端辅助函数。
- `Viewport.tsx` 负责终端尺寸、调整大小的处理、`windowAround()` 和 `WindowRegion`。列表、Status 和表单借助它把聚焦内容保持在行预算内。
- `keymap.ts` 负责按键绑定与帮助行。它在加载时拒绝重复的绑定和缺失的消息键。
- `useReviewForm.ts` 负责编辑状态、Advanced 字段、校验、行窗口化和 `ctrl+s`；`ReviewForm.tsx` 渲染这一状态。

## 界面语言与消息

Shell 文案目录位于 `src/i18n/en.ts` 与 `src/i18n/zh-Hans.ts`；Agent 特定的字符串位于各 Agent 的 `messages.ts`。两种语言必须一同交付。`t()` 可能回退到英文，也可能原样返回原始键，因此仅凭渲染成功并不能证明文案目录覆盖完整。键还会出现在字段、校验器、选项、错误对象和由模板拼出的键族中；只搜索直接的 `t()` 调用会漏掉它们。

CLI 在挂载主 App 之前解析界面语言（ADR 0005）。显式的 `CCSET_LOCALE` 覆盖已保存的选择且不持久化；否则 TUI 使用已保存的语言，或在首次使用时询问。最初的询问是双语的，并且绕过文案目录，因为此时还没有选定语言。帮助、版本以及非 TTY 时对交互模式的拒绝既不询问，也不持久化选择。

为上述任一边界选择 fixture 时，请使用[验证指南](verification.md)。把发布状态和带日期的证据保存在登记册中，而不要在编码助手指引中复制里程碑快照。
