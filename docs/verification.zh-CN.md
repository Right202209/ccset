# 验证指南

[English](verification.md) | 简体中文

用本指南为一次改动选择检查。[AGENTS.md](../AGENTS.md) 定义共享的工作流程；[Important Documentation.md](<../Important Documentation.md>) 保存人工验证场景、发布要求、未知事项与已记录的证据。

## 按改动范围选择检查

| 改动 | 必需的本地检查 |
| --- | --- |
| 纯文档 | `git diff --check`；对照被引用的来源核对变更的链接、锚点、示例和论断。仅当某条被改动的说明或示例需要实际执行才能验证时，才需要运行时检查。 |
| 运行时 TypeScript 或验证 fixture | `npm run typecheck`、`npm run build`、`npm run verify:code-gates`，以及下方相关的 fixture。 |
| 由多个 Agent/界面共享的写入、Codec、凭据或行为 | 上述运行时检查外加 `npm test`；覆盖受影响的人工数据安全场景。 |
| 依赖、构建配置、包内容或测试/CI 接线 | `npm run typecheck`、`npm run build` 和 `npm test`；检查产物与受影响的 CI 任务。 |
| TUI 布局、导航或输入 | 运行时检查与相关的 UI fixture；在真实终端中手动走查被改动的流程，受影响时包括窄宽度/调整大小下的行为。 |
| 网站（`pages/`） | 在 `pages/` 下使用 Node 22.22+/24.15+/26+：`npm run typecheck`、`npm test`（强制覆盖率的 Vitest）、`npm run build`、`npm run smoke`；在桌面与移动宽度下手动检查开发服务器。见 [pages/README.md](../pages/README.md)。 |
| 发布 | 验证记录 §6 中的全部要求，包括自动化 fixture 与适用的平台证据。 |

开发时先跑与改动相关的 fixture。合并运行时或工具改动之前，完整套件必须在本地或适用的受支持平台的 CI 中通过。一条命令被纳入 CI 并不构成某次具体运行通过的记录。

## 准备与执行

使用 Node.js 18+ 并安装锁定版本的依赖：

```bash
npm ci
npm run typecheck
npm run build
```

没有单独的 lint 命令或单元测试框架。测试是 `scripts/` 下的可执行 TypeScript fixture，使用断言和随仓库交付的模块。用各自的 `npm run verify:<name>` 命令运行单个 fixture。`npm test` 顺序运行每一个具名的 `verify:*` fixture，包括语言对齐和错误恢复。[package.json](../package.json) 是命令清单；不要在入口说明中另行维护 fixture 数量。

**在检出中顺序运行 fixture。** 每个 fixture 都以 `--clean` 打包到 `.verify/` 并在结束后删除该目录。并发的 fixture 可能删除彼此的打包产物。若干 fixture 还会重建 `dist/`，因此不要与使用已构建 CLI 的 fixture 同时运行构建。

npm 脚本使用 POSIX shell 语法。PTY fixture 需要 `python3` 及其 POSIX `pty` 模块。请在 Linux 或 macOS 上运行完整套件；原生 Windows CI 运行下述的边界冒烟检查与打包检查。在 root/win32 上，fixture 可以跳过权限检查；这些跳过项应报告为未验证。

## 验证映射

选择本次改动会触及的所有行；当行为在 TUI 保存与非交互命令之间共享时，也要涵盖另一个界面。

| 命令 | 覆盖内容 |
| --- | --- |
| `npm run verify:global-settings` | Claude Code 受管写入、非受管键保留、代理删除、无操作重存、备份的字节与权限模式 |
| `npm run verify:provider-safety` | Claude Code 的 provider 保留、激活命令的引号处理、轮换、遮罩、无密钥失败 |
| `npm run verify:write-safety` | 仅创建状态、SIGKILL 下的原子写入、备份完整性、权限失败 |
| `npm run verify:opencode` | Global/provider 语义、models 映射按条目合并、JSONC 语料与目标选择、遮罩与备份 |
| `npm run verify:codex` | TOML 语料、provider 不变量、Auth profile、切换/采纳、恢复失败、Screen 文案解析 |
| `npm run verify:ui-render` | 完整的 Ink 组件流程、本地 Agent 过滤、焦点、遮罩、Unicode/ASCII 绘制、短视口与滚动 |
| `npm run verify:header-path` | 压栈/返回时的 Frame 标题，以及窄宽度下的路径省略 |
| `npm run verify:layout` | 应用框架与面板：Unicode 与 ASCII 下边框对齐；按键帮助位于边框中，或在两种语言、80 与 100 列下换行并预留行数；侧面板仅在 100 列以上出现且从不紧挨 message；过矮终端不绘制框架；变窄时清除可见屏幕 |
| `npm run verify:review-form` | 变更行、提示、Advanced 开关、`ctrl+s`、长值下的光标可见性 |
| `npm run verify:error-recovery` | 保存失败时草稿的保留，以及残缺备份的列出/清理 |
| `npm run verify:malformed-dirty` | 经由真实 PTY 的损坏目标确认与未保存修改提示 |
| `npm run verify:pty-isolation` | PTY 子进程忽略继承的 Agent 主目录覆盖并留在临时目录 |
| `npm run verify:first-run-locale` | 首次使用的语言选择、持久化、覆盖、取消，以及 help/version/non-TTY 边界 |
| `npm run verify:status-terminal` | Status 刷新/滚动、窄布局、version 与 non-TTY 行为 |
| `npm run verify:i18n-zh` | 英文/中文的键与占位符对齐、语言规范化与 CLI 语言选择 |
| `npm run verify:commands` | 解析器与 operation 边界、退出码、补丁的保留/删除、dry-run、无操作、恢复与输出 |
| `npm run verify:commands-parser` | 解析器自身的规范化契约：整数字段在没有字段校验器时拒绝 NaN，且后续标志绝不会被当作选项值 |
| `npm run verify:commands-status` | 无密钥的 status 载荷、发现项、部分可读的解析失败与状态创建 |
| `npm run verify:commands-secret` | 密钥来源/拒绝、provider 写入、省略密钥时的保留、输出遮罩 |
| `npm run verify:commands-opencode` | opencode 的 status/global 命令、类型化取值、嵌套保留、JSONC 发现项 |
| `npm run verify:commands-opencode-provider` | provider 补丁、按条目合并 models、token 放置、新 provider 校验、损坏恢复 |
| `npm run verify:pi` | pi settings/provider 经 TUI 接缝保存、按成员合并 models、注释保留、留空字段省略、外部修改后重读、逐字节一致的 JSONC 语料、备份轮换与权限模式、检测、`PI_CODING_AGENT_DIR` 规则、status 遮罩 |
| `npm run verify:pi-screens` | pi 的 screen 文案解析：运行并逐层进入每个 action，对照文案目录检查标签、帮助、详情和选项 |
| `npm run verify:commands-pi` | pi provider 补丁、models 合并与密钥来源（stdin 和 `CCSET_TOKEN`）、unset/dry-run 拒绝、无密钥 status、损坏恢复、dry-run/无操作零写入、退出码 |
| `npm run verify:commands-pi-use` | pi global 补丁与 provider use 写入两个启动叶子、列表外模型警告、不可读 models 与无模型拒绝 |
| `npm run verify:grok-build` | grok-build settings/provider 经 TUI 接缝保存、TOML 保留、留空字段省略、外部修改后重读、逐字节一致的语料、备份轮换与权限模式、检测、`GROK_HOME` 规则、status 遮罩 |
| `npm run verify:grok-build-screens` | grok-build 的 screen 文案解析：运行并逐层进入每个 action，对照文案目录检查标签、帮助、详情和选项 |
| `npm run verify:commands-grok-build` | grok-build provider 补丁、内置覆盖形态、密钥来源（stdin 和 `CCSET_TOKEN`）、unset/dry-run 拒绝、无密钥 status、损坏恢复、dry-run/无操作零写入、退出码 |
| `npm run verify:commands-grok-build-use` | grok-build global 补丁与 provider use 写入 `models.default`、未知 id 警告、通过自由文本指定内置 id、不可读配置拒绝 |
| `npm run verify:commands-codex` | Codex status/global 命令、TOML 保留、类型化整数、环境发现项与替换备份 |
| `npm run verify:commands-codex-provider` | provider 不变量、Auth profile 保留、凭据来源拒绝、活跃 auth 不被触碰 |
| `npm run verify:commands-codex-use` | 切换的先后顺序、采纳/替换选择、幂等性、环境前置条件、部分失败 |
| `npm run verify:code-gates` | `src/`、`scripts/` 与 `pages/` 上 TypeScript 文件/函数的规模与复杂度，以及基线中过时或新增的违规项 |
| `npm run verify:release-artifact` | 干净工作树与发布标签检查、SHA 固定 action 及最小权限/provenance 工作流契约、构建、打包、临时安装、允许的包内容、可执行位/shebang 与 CLI 冒烟 |

所有 `verify:commands` / `verify:commands-*` 脚本先构建再运行，演练的是 `dist/cli.js`；其中一些还会直接对 operation 接缝做断言。`verify:malformed-dirty`、`verify:first-run-locale`、`verify:status-terminal` 和 `verify:i18n-zh` 也先构建。release-artifact fixture 在内部完成构建，把 tarball 打包并安装到一个临时项目中；它不执行发布。其他 fixture 导入源码模块，由 tsup 打包后执行。

并非每个 `scripts/verify-*.ts` 文件都能独立运行。Codec 语料与 Codex 恢复辅助模块运行在 Agent fixture 内部；`verify-viewport.ts` 与 `verify-agent-discovery.ts` 运行在 `verify:ui-render` 内部，`layout-rules.ts` 运行在 `verify:layout` 内部。`ui-session.ts` 与 `ui-assertions.ts` 驱动组件测试；`pty-session.ts` 驱动真实终端；`cli-harness.ts` 以隔离 home 运行命令；`kill-harness.ts` 支撑 `verify:write-safety`。

## 新增或扩展验证

优先扩展受影响行为对应的 fixture。断言可观察的结果：文件内容与未被触碰的同级键、备份、权限、退出码、无密钥输出，或渲染绘制。当公开的 operation/CLI 边界正是被改动的契约时，就在该边界上进行演练。复用现有的 harness，而不是重造被测行为。

对于缺陷，要证明没有修复时回归断言会失败。新的 Agent 或数据安全 fixture 还需要一个让它失败的有意变异；见[添加 Agent](adding-an-agent.md#prove-it)。交接之前先恢复该变异，再运行一次 fixture。纯文档改动不需要新的运行时断言。

把新的独立 fixture 同时接入 `package.json` 中的某个 `verify:*` 脚本和顺序执行的 `test` 脚本，然后在上面的表格中登记它的范围。辅助模块不进入命令清单。不要为了让新的违规项通过而扩大代码质量基线。

## 手动运行与证据

每个本地写入场景都使用临时主目录。例如，构建之后，在真实终端中运行：

```bash
ccset_scratch="$(mktemp -d)"
CCSET_HOME="$ccset_scratch" CCSET_LOCALE=en node dist/cli.js --agent claude-code
```

只查看该目录下的文件，结束后将其删除。省略 `CCSET_LOCALE` 即可演练首次使用的语言选择。本地检查请使用 `sk-TEST-DO-NOT-USE` 这类占位 token。通过管道运行的交互式调用按设计以退出码 2 退出；输入/导航检查请使用真实 PTY。

直接挂载 `App` 的 fixture 绕过 `cli.tsx`：通过 `ctx` 提供临时主目录，通过 `terminal` 提供字形集合，测试布局时通过 `viewport` 提供固定尺寸。解析 Agent 文案键之前先导入 `src/registry.js`，因为文案注册发生在该模块加载时。

记录命令/场景、结果、操作系统、Node 版本，以及相关的终端/shell 或 Agent 版本。把新的运行时证据追加到验证记录的 §9；旧条目保留为历史。失败、跳过与待执行的检查都要显式记录。例行的文档检查写进交接说明或 PR 描述即可。使用合成文件的 fixture 不能证明一次真实的 Provider 请求，也不能证明其他平台。

## CI 与发布

[ci.yml](../.github/workflows/ci.yml) 是 CI 定义。它目前在 Ubuntu、macOS 和 Windows 上以 Node 18/20/22 运行 typecheck、构建、一次已构建 CLI 的冒烟检查和 `npm pack --dry-run`。冒烟检查要求 `--version` 输出非空且不含 ANSI 转义，并要求一次非 TTY 的交互式拒绝以退出码 2 退出且无 ANSI。Ubuntu 和 macOS 还运行 `npm test`；Windows 跳过 POSIX fixture 套件。

网站有自己的工作流。[pages-ci.yml](../.github/workflows/pages-ci.yml) 在触及 `pages/**`、`docs/**`、根目录 `*.md` 或工作流之一的 pull request 上运行网站检查（安装、typecheck、Vitest、构建、冒烟）。[deploy-pages.yml](../.github/workflows/deploy-pages.yml) 在每次推送到 `master` 时（无路径过滤，因此文档编辑不会让网站过期）以及 `workflow_dispatch` 时运行同样的检查，然后通过官方 Pages actions 部署 `pages/dist`；构建的 base path 取自 `actions/configure-pages`。这些工作流将 Actions 固定到 commit SHA；只有构建任务读取仓库内容，只有部署任务获得 Pages 与 OIDC 权限。[publish.yml](../.github/workflows/publish.yml) 从干净 checkout 发布版本标签匹配的 GitHub Release，通过 npm trusted publishing 自动生成 provenance，不使用长期 npm token。发布前必须为本仓库、该工作流和 `npm-publish` environment 配置 npm Trusted Publisher。根目录的 `ci.yml` 不构建网站。

发布检查与平台例外定义在验证记录的 §6 和 [SUPPORT.md](../SUPPORT.md) 中。平台特定的路径、权限或终端改动需要该平台上的手动证据。把这些要求与本地文档编辑所需的检查分开对待。
