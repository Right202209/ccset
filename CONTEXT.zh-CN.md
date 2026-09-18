# ccset

[English](CONTEXT.md) | 简体中文

ccset 是一个公开的配置工具，面向把编程 Agent 接入第三方 API 服务的开发者。它的措辞
区分配置生成、兼容性证据和维护承诺。

## 用语

### 范围与维护

**Core user（核心用户）**:
正在配置编程 Agent 以接入第三方 API 服务的个人开发者。
_避免_: Enterprise administrator, every Claude Code user

**Provider（提供商）**:
核心用户选定的第三方 API 服务，经由某个 Agent 的配置访问。视具体 Agent 而定，一个
Provider 要么是独立文件（Claude Code 的 `settings.<name>.json`），要么是 Agent 单一配置
文档中的一个配置块（opencode 的 `provider.<id>`、Codex 的 `[model_providers.<id>]`）。
_避免_: Agent, model

**Provider ID**:
用户在某个 Agent 范围内选定的标识符，用来区分一个 Provider 配置，以及它保存的 Auth
profile（如果该 Agent 支持）。
_避免_: Provider name, profile name

**Auth profile（凭据配置）**:
ccset 为某个 Provider 保存的凭据，放在 ccset 自己拥有的文件里，与 Agent 的活跃凭据相互
独立。需要这个术语的是 Codex：它的密钥不在配置文档里，所以 Auth profile 保存在
`~/.codex/auth.<id>.json`，切换到该 Provider 时复制覆盖 `auth.json`。Auth profile 始终
不是 Agent 实际读取的那个文件。
_避免_: Credential, login, account

**Codec（编解码器）**:
读写某种序列化格式的配置文档的方式。如果 Codec 直接编辑原文，而不是把解析结果重新
序列化，它就是格式保留（format-preserving）的。ccset 的 TOML 和 JSONC Codec 就是这样，
因为注释和键顺序也属于“非受管键必须幸存”要覆盖的内容。
_避免_: Parser, serializer, file format

**Agent**:
ccset 可以读取或写入其配置的编程工具，目前是 Claude Code、opencode、Codex CLI、pi 和
Grok Build。
_避免_: Provider

**Managed key（受管键）**:
某个 Agent 配置中由 ccset 写入的路径，在该 Agent 的 `manifest.ts` 中声明一次。文件中的
其余一切都是非受管的，每次写入都原样幸存。写受管键就是只写叶子，绝不写它的父对象。
_避免_: Supported field, known key

**Managed patch（受管补丁）**:
只改动核心用户显式指定的受管键的非交互写入提案。省略的受管键保留当前值。
_避免_: Complete config, replacement

**Supported platform（支持的平台）**:
项目打算持续保持可用的平台。平台特定的改动需要在该平台上做发布阻塞级验证，其他发布
可以披露缺少某次人工冒烟测试。
_避免_: Probably compatible, best-effort platform

**Best-effort platform（尽力支持平台）**:
ccset 在设计上不排除的平台，但其上的故障不阻塞发布，也可能一直不修复。
_避免_: Supported platform

**Verified environment（已验证环境）**:
一项成文检查通过时所处的具体环境组合：Agent 版本、Node.js 版本、操作系统、终端和
shell。它是证据，不是一般性的兼容承诺。
_避免_: Supported version, compatibility window

**Implementation proposal（实现提案）**:
实现本身就是对 ccset 范围提出改变的 pull request。可以没有前置 issue 直接提交，也不预设
它会被接受。
_避免_: Approved feature, committed roadmap item

**Provider-specific behavior（特定 Provider 的行为）**:
只针对某个具名 Provider、而不是通用 Anthropic 兼容配置模型存在的配置或交互逻辑。
_避免_: Agent integration, general provider capability

**Experimental integration（实验性接入）**:
有真实用户场景、但持续验证不足以达到受支持标准的 Agent 或平台接入。它可能被修改、
降级或移除。
_避免_: Supported integration, permanent integration

**Release blocker（发布阻塞项）**:
涉及数据丢失、凭据暴露、无法启动，或某项强制发布检查失败的已知缺陷。无论日程如何，
发布阻塞项都阻止发布。
_避免_: Ordinary bug, known limitation

**Core flow（核心流程）**:
从启动 ccset，到读取、审阅并安全写入一份配置，直至打印对应启用命令的交互路径。
_避免_: Every menu action, exhaustive manual test suite

### 界面

**Non-interactive command（非交互命令）**:
面向脚本的稳定 ccset 操作，无需 Screen 或提示即可完成，并且所有改变状态的选择都必须
显式给出。
_避免_: Scripted Screen, headless TUI

**Secret source（密钥来源）**:
非交互命令接收 Provider 密钥的通道：`CCSET_TOKEN` 或显式选择的 stdin，绝不接受命令
参数。
_避免_: Token flag, positional token

**Screen（屏幕）**:
Action 返回给核心用户处理的数据，可能是 form、list、status、confirm 或 message。
渲染它的组件是 View，绝不是 Screen。
_避免_: Page, dialog

**Frame（导航帧）**:
导航栈上的一层 Screen。按 Esc 弹出一层 Frame。
_避免_: Rendered paint, history entry

**Rendered paint（渲染绘制）**:
终端的一次绘制。与 Frame 不同：Frame 是导航中的位置，Rendered paint 是渲染中的时刻。
_避免_: Frame, screenshot

**Viewport（视口）**:
窗口化区域被裁剪到的行列预算。ccset 不占有整个终端，因此 Viewport 界定的是一个区域，
绝不是整个应用。
_避免_: Screen size, full screen

**Terminal capability（终端能力）**:
核心用户面前的终端能够渲染的内容：字形集合与颜色集合。它是环境的属性，不是用户偏好。
_避免_: Theme, style

**Locale preference（界面语言偏好）**:
ccset 界面所用的文案目录选择。它要么是显式的 `CCSET_LOCALE` 调用覆盖，要么是保存在
ccset 自己设置文件中的选择；ccset 绝不从 `LANG` 或其他环境区域变量推断它。
_避免_: Terminal capability, detected locale

**Settings file（设置文件）**:
ccset 自己拥有的 `<home>/.ccset/settings.json` 文档，包含带版本号的界面语言偏好。它与
每一个 Agent 配置和备份都相互独立。
_避免_: Agent config, backup
