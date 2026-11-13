# ccset 差异化定位

> **存档说明。** 这是 2026-11-10 收到的产品评审快照，除本说明外原样保留。评审依据的是当时已推送的仓库和 v0.10.0，部分结论已被之后的提交改变；其中的竞品数据和下载量未经本项目独立核实，引用前请重新查证一手来源。维护者据此做出的决定见[项目计划](../zh-CN/project-plan.zh-CN.md)。

对应《评审意见》的 P0-2。这一篇回答三个问题：和谁比，比什么，怎么说。

## 竞争格局

| | **ccset** | **CC Switch** | **CC-Switch CLI** |
| --- | --- | --- | --- |
| 形态 | 终端：TUI + CLI，`npx` 即用 | 桌面应用（Tauri） | 终端：TUI + CLI（Rust） |
| 覆盖的工具 | 5 | 12 | 7 |
| 提供商数据存在哪 | 只在各 Agent 自己的配置目录 | 自有 SQLite 数据库，切换时写入配置 | CC Switch 的分支，同步数据与上游兼容 |
| 本地代理、协议转换 | 无（刻意） | 有 | 有 |
| 提供商预设 | 无 | 90+ | — |
| MCP、Prompts、会话 | 不管理（刻意） | 管理 | 管理 |
| 没有桌面环境时 | 可用 | 不可用，官方建议改用 CC-Switch CLI | 可用 |
| 会话级启动 | 仅 Claude Code，需手抄命令 | — | `start claude <id>`、`start codex <id>` |
| 赞助商 | 无 | — | README 列有 7 家 |

「—」表示我没有核实，不代表没有。数字取自各项目 README，引用前请再看一眼。

另有一类是路由代理（如 Claude Code Router），解决的是「在 Claude Code 里用别家协议的模型」，和 ccset 不在一条赛道上。

## 比什么，不比什么

**不比：** 工具数量、预设数量、功能面、图形界面。这些赢不了，也不该赢。

**该比的四件事：**

1. **没有第二份事实来源。** ccset 不保存提供商列表，Agent 自己的配置文件就是全部。卸载之后什么都不会坏；手改配置不会和工具「打架」；可以和 dotfiles、git 共存。
2. **没有常驻进程。** 不起代理，不驻托盘。在服务器、SSH、容器和 CI 里，行为和本机完全一致。
3. **不能如实完成就拒绝。** Codex 用了系统密钥链、配置块里有 `env_key`、`CODEX_HOME` 指向别处——这些情况下 ccset 会停下来说明，而不是写一个不会生效的文件。
4. **每一步都能核对。** `--dry-run` 先看计划；verify 脚本和 ADR 公开；npm 包带来源证明。

**已经失效的一条：「保留注释和自定义键」。** CC Switch 的 README 现在也写明只替换关键字段，保留注释和格式。它仍然是事实，但只能当证据，不能当头条。

**一个要现在就做的决定：要不要「中立」。** CC-Switch CLI 的 7 家赞助商多数是 API 中转服务——这是合理的商业模式，也说明服务商愿意为分发付费。ccset 目前没有任何赞助或推广链接。「不带货」可以成为第五个卖点，但它一旦写进定位就不能反悔。接受赞助或保持中立都可以，只是要先决定，并写进 `docs/vision.md`。

## 定位陈述

> 对于**在终端里工作、亲手维护配置文件的开发者**，ccset 是**给编程 Agent 换 API 提供商的命令行工具**。和 CC Switch 这类全功能管理器不同，它**不建数据库、不起代理、不留常驻进程**：只改你点名的键，而且每一步都能核对。

压缩成一句，三个候选：

1. 给编程 Agent 换 API 提供商，只改你点名的那几个键。
2. 你的配置文件，就是唯一的数据库。
3. 不装应用，不起代理，不建数据库。

推荐第 1 句做主标题，第 3 句做副标题。

```diff
- Switch API providers for coding agents from any terminal.
- No desktop app, no proxy, no rewritten config.
+ Switch API providers for coding agents by editing only the keys you name.
+ No desktop app, no proxy, no database.
```

改动只有两处：把 *from any terminal* 换成具体的做法，把对手也能说的 *no rewritten config* 换成对手说不了的 *no database*。

## 把看不见的优势做成看得见的功能

ccset 的优势全是「不做什么」，而没做的事是看不见的。访客看不见，就等于没有。

| 优势 | 现在藏在哪 | 怎么让人看见 |
| --- | --- | --- |
| 只改点名的键 | 用户指南、verify 脚本 | **保存前显示逐行 diff。** `--dry-run` 已经能生成变更计划，再输出统一 diff 格式；TUI 的审阅界面加一个「查看改动」 |
| 没有数据库 | PRD §4.2.4 | **README 加一节「ccset 在你的机器上留下什么」**，列出全部路径，就那么几行 |
| 诚实拒绝 | 散落在 Codex 小节 | **单开一页「ccset 会拒绝做的事」**，把拒绝当功能来讲 |
| 来源可验证 | npm 元数据 | **README 顶部放 provenance 和 CI 徽章**，链接到验证指南 |

第一条最重要。用户亲眼看到「只动了三行，注释一个没少」，比任何文案都管用。做完之后，让它成为 README 动图的主角。

CC Switch 的编辑器也会展示「切换后配置文件的样子」。所以 ccset 要做得更直接：展示逐行差异，而不是结果全文。

## 先打哪群人

1. **没有桌面的环境**：SSH 服务器、容器、Codespaces、WSL。CC Switch 的 FAQ 明确说桌面版不适用于这些场景。这里的直接对手只有 CC-Switch CLI，而它需要单独安装；ccset 在有 Node 的机器上 `npx` 即用。
2. **把配置放进 dotfiles 的人**：配置文件带注释、进 git、手工维护。他们最怕工具「接管」配置。
3. **写接入文档的服务商**：他们需要一条对任何用户都安全的命令。这不只是用户群，更是分发渠道，见《评审意见》P1-1。

**主动让出去的用户：** 想要图形界面的，想在 Claude Code 里用非 Anthropic 协议模型的，想统一管理 MCP 的——在 README 里直接推荐他们用 CC Switch。把不合适的用户让出去，是定位可信的一部分。

## 各处文案

| 位置 | 现在 | 建议 |
| --- | --- | --- |
| GitHub 简介 | Switch API providers for coding agents from any terminal. No desktop app, no proxy, no rewritten config. | Switch API providers for coding agents by editing only the keys you name. No desktop app, no proxy, no database. |
| npm description | Terminal UI and CLI that generate and edit Claude Code, opencode, Codex CLI, pi, and Grok Build configuration files for third-party API providers. | 与 GitHub 简介用同一句 |
| README 首句 | 功能清单 | 见《README 改写稿》 |
| Topics | 含 `developer-tools-ai-agent`，像是两个标签粘在了一起 | 拆成 `developer-tools` 和 `ai-agents`，再加 `tui`、`terminal`、`dotfiles` |

## 被质疑时怎么回答

| 质疑 | 回答 |
| --- | --- |
| 「CC Switch 功能多得多。」 | 是的。需要图形界面、预设或协议转换，请用它。ccset 只做一件事，并且不在你的机器上留第二份配置。 |
| 「CC-Switch CLI 也在终端里。」 | 它同样带代理、MCP 同步、会话和用量。ccset 选择不要这些，换来更小的可审计范围。 |
| 「才 5 个 Agent。」 | 每一个的配置契约都逐字段核对过。做不到如实配置的，宁可不接。 |
| 「没有预设，太麻烦。」 | 添加一个提供商只需要三个值。预填入口上线后（P1-1），服务商给你一行命令就够了，密钥仍由你自己输入。 |
| 「密钥是明文。」 | 是，和 Agent 自己的做法一致，README 里写明了。在支持环境变量引用的 Agent 上，密钥可以不落盘。 |
