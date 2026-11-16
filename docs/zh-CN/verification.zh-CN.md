# 验证指南

[English](../verification.md) | 简体中文

[AGENTS.md](../../AGENTS.md) 定义工作流；本文选择检查。[登记册](<../../Important Documentation.md>) 保存人工场景、发布门槛（§6）与带日期的证据（§9）。

## 按改动范围选择检查

| 改动 | 必要检查 |
| --- | --- |
| 纯文档 | 链接、锚点、示例、源码事实、`git diff --check`；必要时执行改后的指令 |
| 运行时 TypeScript 或 fixture | 根目录 typecheck、build、`verify:code-gates`、相关 fixture |
| 共享写入／Codec／凭据、依赖、构建、测试／CI | 运行时检查加完整 `npm test`；检查相关产物和人工安全场景 |
| TUI 输入／布局／导航 | 运行时检查、相关 UI fixture、真实终端操作；按需验证窄屏与缩放 |
| 网站或渲染的 Markdown | 在 `pages/` 运行 typecheck、覆盖率测试、build、smoke；可见 UI 改动还需桌面／移动检查及 PR 截图 |
| 发布 | 登记册 §6 及适用平台证据 |

运行时／工具链改动合并前，完整套件必须在本地或适用平台的 CI 通过。工作流定义不代表某次运行已经成功。

## 安装与执行

CLI：Node ≥18；根目录 `npm ci`、`npm run typecheck`、`npm run build`。没有根目录 lint 命令或独立单元测试框架；`scripts/` 的可执行断言就是测试套件。[package.json](../../package.json) 是命令清单，`npm test` 顺序运行已登记 fixture。

**同一 checkout 禁止并行运行 fixture。** 它们清理共享 `.verify/`；部分还重建 `dist/`，也不能与 build 并行。POSIX shell／PTY 检查需要 Linux/macOS 和 `python3`；root/win32 上的权限跳过必须报告。

网站使用独立 package／lockfile，Node 范围是 `^22.22.2 || ^24.15.0 || >=26`。在 `pages/` 安装并运行检查，见[网站 SOP](../../pages/README.md)。

## Fixture 对照

运行所有受影响的行，共享行为需覆盖两种界面。下面名称均为 `npm run verify:<名称>` 的后缀；覆盖范围指 fixture 的断言，不代表任意非托管输入均已验证。

| Fixture | 检查边界 |
| --- | --- |
| `global-settings` | Claude 全局叶子、保留、代理删除、备份／权限 |
| `provider-safety` | Claude Provider 保留、命令引用、密钥轮换／遮蔽 |
| `provider-management` | 五 Agent 删除／忽略、Codex 路由拒绝／凭据文件、返回列表与重新读取 Edit |
| `write-safety` | 排他 create-only 发布、SIGKILL 原子性、备份／权限失败 |
| `opencode` | 全局／Provider 保存、模型映射合并、JSONC 目标／编辑语料 |
| `codex` | TOML 语料、Provider 不变量、Auth profile、切换／接管／恢复 |
| `pi` | TUI 保存、models 逐成员合并、JSONC 保留、检测／路径覆盖 |
| `grok-build` | TUI 保存、TOML 保留、内置模型覆盖、检测／路径覆盖 |
| `pi-screens`, `grok-build-screens` | 可达 Screen 字符串及间接目录键 |
| `ui-render` | Ink 流程、检测、焦点、遮蔽、字形、短 Viewport／滚动 |
| `header-path` | 导航标题、窄屏路径省略 |
| `layout` | Panel 边框／帮助、侧栏断点、超短终端 |
| `side-info` | 只读 Glance／Preview、刷新、SGR 鼠标、语言／宽高预算 |
| `review-form` | 改动行、提示、高级切换、保存快捷键、光标 |
| `error-recovery` | 草稿／脏状态、部分提交／回滚、备份清理失败／重试 |
| `malformed-dirty` | PTY 下损坏替换及未保存确认 |
| `pty-isolation` | PTY 子进程清除继承的 Agent home 覆盖 |
| `first-run-locale` | 首次选择／持久化、覆盖、取消、help／version／非 TTY |
| `status-terminal` | 刷新／滚动、窄屏、版本／非 TTY |
| `i18n-zh` | 两语言键／占位符、规范化、CLI 语言 |
| `short-commands` | 选择器／TTY 推断、所有预设组合、统一 use、Claude run／隐藏密钥 |
| `commands` | parser／operation、退出码、patch／unset、dry-run／no-op／恢复 |
| `commands-parser` | 整数规范化、拒绝把选项当值 |
| `commands-status` | Status DTO 断言、部分可读错误、state init |
| `commands-secret` | 密钥来源／拒绝、省略保留、输出断言 |
| `commands-opencode` | 全局／状态、类型、嵌套保留、JSONC 诊断 |
| `commands-opencode-provider` | Provider／模型 patch、密钥位置、损坏恢复 |
| `commands-pi` | Provider／模型 patch、密钥、unset、损坏恢复、零写入计划 |
| `commands-pi-use` | 全局 patch、两个启动叶子、模型警告／缺失拒绝 |
| `commands-grok-build` | Provider patch、内置形态、密钥／unset／替换／no-op |
| `commands-grok-build-use` | 全局／默认模型、内置自由输入、不可读配置 |
| `commands-codex` | 全局／状态、TOML／整数、环境诊断、替换 |
| `commands-codex-provider` | Provider／Auth profile patch、凭据前置条件、不改 live auth |
| `commands-codex-use` | 切换顺序、接管／恢复／路由、前置条件、部分失败 |
| `code-gates` | CLI／fixture／网站 TypeScript 大小／复杂度及基线棘轮 |
| `release-artifact` | 发布守卫／工作流、打包／安装／内容／shebang、主包与转发一致性 |

`commands`／`commands-*` 重建并运行 `dist/cli.js`，部分也直接验证 operation。`short-commands`、`malformed-dirty`、`first-run-locale`、`status-terminal`、`i18n-zh` 同样重建。Agent／Codec 语料与辅助模块在上述 fixture 内运行，不另算独立命令。

产物 fixture 构建／打包但不发布。转发包必须装进**另一临时项目**，从 npm 解析精确主包依赖；与本地 CLI tarball 同装会错误地由 checkout 满足版本锁定。此 fixture 需要 registry 网络访问，通过不代表 trusted publisher 已配置。

## 扩展验证

扩展对应 fixture，断言可观察的文件字节／值、保留成员、备份／权限、退出码、输出或终端绘制。复用 `cli-harness.ts`、`ui-session.ts`／`ui-assertions.ts`、`pty-session.ts`、`kill-harness.ts`，避免重写被测实现。

回归断言必须在撤销修复后失败；新 Agent／数据安全 fixture 还需主动变异使其失败，恢复后再通过，见[证明验证有效](adding-an-agent.zh-CN.md#证明验证有效)。独立 fixture 同时接入 `verify:*` 和顺序 `test`，再更新此表。禁止增加基线例外掩盖新质量违规。

直接挂载 `App` 会绕过 CLI：注入临时 `ctx.home`、终端字形及 Viewport；解析 Agent 消息前导入 `src/registry.js`。可选视觉输出：`CCSET_VISUAL=1 npm run verify:side-info`。

## 人工运行与证据

构建后在真实终端使用临时 home：

```bash
ccset_scratch="$(mktemp -d)"
CCSET_HOME="$ccset_scratch" CCSET_LOCALE=en node dist/cli.js --agent claude-code
```

只用占位密钥、检查临时文件；省略 locale 测试首次选择。没有子命令且 stdin 非 TTY 时退出 2。`CCSET_HOME` 隔离 ccset 写入，**不能**隔离 `run` 启动的上游 Agent；后者需另行隔离。

记录命令／场景、结果、OS／Node 及相关 Agent／终端／shell 版本，明确失败、跳过和待验证项。新运行时证据追加到登记册 §9，旧条目不改；日常文档检查写入交接／PR。合成文件不证明真实请求或其他平台。

## CI 与发布

[CLI CI](../../.github/workflows/ci.yml)：Ubuntu/macOS/Windows × Node 18/20/22 执行安装、类型检查、构建、版本／非 TTY smoke、pack dry-run；Ubuntu/macOS 另跑完整 `npm test`，Windows 跳过 POSIX 套件。

[网站 CI](../../.github/workflows/pages-ci.yml) 检查涉及网站／文档／根 Markdown／工作流的 PR。[Pages 部署](../../.github/workflows/deploy-pages.yml) 在每次 `master` 推送及人工触发时重跑，使用配置的 base path 发布 `pages/dist/`。根 CI 不构建网站。

[发布工作流](../../.github/workflows/publish.yml) 将 `v<version>` 路由到 `@droite/ccset`，`ccset-v<version>` 路由到转发包；均要求干净且匹配版本的 Release、`npm-publish` 中各包独立 trusted publisher 与 provenance。首次注册由维护者引导，后续版本走工作流。发布／平台要求见[登记册 §6](<../../Important Documentation.md#6-build-and-publish>) 和[支持政策](SUPPORT.zh-CN.md)。
