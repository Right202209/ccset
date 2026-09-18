# 添加 Agent

[English](adding-an-agent.md) | 简体中文

把现有的 Claude Code、opencode、Codex、pi 和 Grok Build 模块当作同一个扩展边界在不同文件布局下的示例。一次接入包括其运行时模块、注册表条目、验证 fixture 和文档。现有的 JSON、JSONC 和 TOML Codec 均可复用。

开始之前，先阅读 [`CONTEXT.md`](../CONTEXT.md) 了解术语（Screen、Frame、Agent、Provider）。阅读 [`CONTRIBUTING.md`](../CONTRIBUTING.md) 了解新接入必须跨过的门槛；本指南只讲具体机制。分步的编码助手工作流程、交付物和可复用的任务模板，见[中文工作流程](agents/add-agent-workflow.md)。

## 你实际在构建什么

Agent 模块把磁盘上的文件变成 `src/types.ts` 中五种 `ActionResult` 形态——`form`、`list`、`status`、`confirm`、`message`——再把提交的表单变回写入操作。它绝不从 `src/ui/` 导入。如果你发现自己产生了这种念头，说明你需要的形态在 `types.ts` 中缺失，那才是应当提出的改动。

## 扩展边界

PRD §2.2 准则 5 将 Agent 模块和 `src/registry.ts` 定义为扩展边界。该模块是一个包含多个文件的目录。复用既有能力的 Agent，除注册表外不改动其模块之外的任何运行时代码。fixture、`package.json` 接线和文档是预期的额外改动。

如果你还需要另一处运行时改动，先明确它属于什么职责：

- **你需要一条文案。**把它放进你自己的 `messages.ts`（见下文），而不是放进 `src/i18n/en.ts`。
- **你需要一个路径辅助函数。**把它放进你模块的 `paths.ts`。`src/core/paths.ts` 只容纳 `resolveHome`、`backupsDirFor` 和 `listNamedFiles`，其中 `listNamedFiles` 以回调形式接受你的命名规则。
- **你需要一项共享能力。**把核心/接口改动写明确，让它能单独评审，并为既有 Agent 和新 Agent 都配上检查。它可以作为完整实现提案的一部分；按 [CONTRIBUTING.md](../CONTRIBUTING.md)，前置 issue 是可选的。

## 模块布局

在模块内使用职责单一的文件，并遵守可执行的质量限制。这只是一种常见布局，不是对文件数量的硬性要求：

| 文件 | 内容 |
| --- | --- |
| `index.ts` | `Agent` 对象：`id`、`name`、`messages`、`detect`、`getActions`，以及可选的 `commands` |
| `manifest.ts` | **纯数据。**每个受管键只声明一次 |
| `constants.ts` | 模板默认值、枚举值和传输细节 |
| `paths.ts` | 配置存放在哪里，备份放到哪里 |
| `global.ts` | 顶层配置的 `seed*` / `emit*` / `save*` |
| `providers.ts` | 针对单个提供商的同套函数，外加发现逻辑 |
| `status.ts` | 只读视图。读取一切，不写入任何内容 |
| `actions.ts` | 组装菜单的各个 Action |
| `messages.ts` | 你的文案，位于唯一的 Agent 命名空间下，同时提供两种语言 |
| `commands.ts` | 命令声明与处理器，在暴露非交互命令时提供 |
| `status-dto.ts` | 结构化、不含密钥的 Status 数据，供命令输出共用 |

Codex 还把凭据处理拆分到 `auth.ts`、`activate.ts` 和 `provider-use.ts`，因为它的 Auth profile 存放在配置文档之外。当 Agent 的职责需要时，可以使用更多文件。

## 容易出错的部分

### 删除不是优化

带 `value: undefined` 的 `ManagedWrite` 表示**删除该键**。当字段契约要求省略时，TUI 里留空或选择 Unmanaged 都必须移除该键，而不是写入 `""` 或 `null`。关闭代理会删除其环境变量键，而像 `autoupdate = false` 这样受支持的布尔设置仍然是一个值。对应的表单类型转换请使用 `src/core/values.ts` 中的 `textOrUndefined`、`intOrUndefined` 和 `csvOrUndefined`。

### 写入前立即重新读取

在 ccset 打开期间，Agent 会改写自己的配置。`save*` 在保存时重新读取目标，而不是在启动时。沿用 Screen 打开时的解析结果，会覆盖 Agent 在这期间写入的任何内容。

### 绝不整体写入子树

写叶子，而不是它的父对象。opencode 的 provider options 看起来像一个适合整体赋值的对象：

```ts
// 错误：会毁掉 options.headers，以及用户放在那里的其他任何内容。
{ path: ['provider', id, 'options'], value: { baseURL, apiKey } }

// 正确：两个叶子，每个非受管的同级键都得以幸存。
{ path: ['provider', id, 'options', 'baseURL'], value: baseURL }
{ path: ['provider', id, 'options', 'apiKey'], value: apiKey }
```

如果映射里的条目用户也会编辑，道理相同。opencode 的 `provider.<id>.models` 按键合并——磁盘上已有的 id 保留自身设置，新增的 id 会被添加，从列表中移除的 id 会被删除——因为整体写入该映射会丢弃每个模型各自的设置。这需要当前磁盘状态，因此 `emitProvider` 把它作为参数接收。

### 备份归你所有

`backupFile(dir, path)` 接收的是目录。传入 `backupsDirFor(yourConfigDir)`，这样你的轮转就不会挤掉另一个 Agent 的备份，ccset 也绝不会写进目标 Agent 会按自己的节奏清理的目录。

### 文案随模块一起交付

```ts
export const yourMessages: Record<string, Record<string, string>> = {
  en: { 'yourAgent.field.apiKey': 'API key' },
  'zh-Hans': { 'yourAgent.field.apiKey': 'API 密钥' },
}
```

每个键都使用唯一的 Agent 命名空间。注册表会合并这些文案并**在遇到重复时抛出异常**，因此你无法悄然重定义一条 shell 通用文案。复用 `src/i18n/en.ts` 中的共享词汇——`field.baseUrl`、`action.status`、每一条 `write.*` 和 `confirm.*`——而不是重新表述一遍。

下面两个字段之所以存在，是因为两个 Agent 的说法不一致：

- `Action.detailKey`——两个 Agent 都把某个 Screen 标注为 “Global settings”，但描述的却是不同的文件。
- `WriteReport.activateKey`——Claude Code 需要 `claude --settings <path>`；opencode 在启动时读取自己的配置，没有什么可激活的。

### 说明你做不到的事

在 Status 中指明不受支持的格式、凭据存储或激活路径，并把验证缺口记录在案。把尚未解决的兼容性假设记录到 `Important Documentation.md` §1，而不是把合成的 fixture 当作真实环境下的兼容性结论。

例如，opencode 的 JSONC 缺口已用格式保留的 Codec（ADR 0004）解决：已存在的 `.jsonc` 现在是受管目标，其遗留的 `.json` 保持原样。复用这套选择逻辑与 Codec 行为；针对真实运行的合并顺序核查仍单独记录为 U6。

## 非交互命令

Agent 可以通过 `AgentCommands` 接口暴露 `commands`。在 Agent 模块内部声明其命令字段与处理器，使共享的解析器和分发器无需任何 Agent 特定分支。没有 `commands` 的 Agent 只服务 TUI；请明确记录其支持的界面范围。

命令是受管补丁：给出的字段被修改，省略的字段保留磁盘状态，`--unset` 删除一个受管键。从磁盘取初值而不带入 TUI 模板默认值，校验完整的提案，并复用 operation 与 commit 核心。不要通过调用 Screen 回调来实现命令。关于密钥来源、预检、输出与退出契约，遵循[命令规范](milestone-3-non-interactive.md)和 ADR 0006–0014。

## 注册它

```ts
import { yourAgent } from './agents/your-agent/index.js'

export const AGENTS: Agent[] = [claudeCode, opencode, codex, yourAgent]
```

这就是注册表的全部改动。没有动态 `import()`，没有扫描：发布的产物是一个 bundle，而 bundler 无法解析扫描出来的路径。

检查文件检测、Agent 选择和新的 `--agent <id>` 取值。更新枚举受支持 Agent 的 fixture，包括双语文案一致性，以及新 Agent 暴露的命令能力（若提供）。

## 证明它

新 Agent 需要在 `scripts/` 中有自己的 fixture，针对一个用 `mkdtemp` 创建的主目录运行。把它接入 `package.json` 中的某条 `verify:*` 命令**和**顺序执行的 `npm test` 链，并登记到[验证映射](verification.md#fixture-map)。至少覆盖：

- 非受管键在一次保存后幸存，包括你的配置嵌套到最深层时受管键的同级键；
- 留空的字段完全省略其键——没有 `null`，也没有 `""`；
- 选择 Unmanaged 或关闭代理会删除相应键，而布尔设置保留真实的布尔值；
- 密钥在 Status 中被遮罩，绝不会完整出现；
- 备份按 `MAX_BACKUPS` 轮转，且在 POSIX 上权限为 `0600`。

然后**变异你自己的代码，并确认这道关卡会失败。**`verify:opencode` 曾针对四个故意引入的缺陷运行——整体覆写 models、跳过一次删除、把留空写成 `""`、以及整块替换 `options` 子树——每一次都让它变红。从未失败过的数据安全关卡等于没有被测试过。

然后逐个走查你的 Screen，确认每条文案都解析成功。`t()` 在未命中时返回键名，因此 `messages.ts` 里的一个拼写错误会把 `yourAgent.field.apiKey` 直接显示给用户，而不是抛出异常。`verify-codex-auth.ts` 就有这套遍历：它执行每个 Action，逐层深入 list 项——只调用 `run()`，绝不调用 `confirm()` 或 `submit()`，因为那两者才是写入——并断言两点：绘制出的字符串都不是未解析的键，且每个 `labelKey`、`helpKey`、`detailKey` 和选项标签都存在。在 fixture 中导入 `src/registry.js`：`registerMessages` 是该模块加载时的副作用，缺少它时，你的整个文案目录都会被当成缺失。

既然已经在改 `messages.ts`，就把两种语言一起交付：一个 `en` 块和一个 `zh-Hans` 块。运行时，你的 Agent 未翻译的键会回退到英文而不是裸键名，但这不是跳过翻译的许可：`verify:i18n-zh` 要求每个 Agent 的两份文案目录逐键一致，缺块或缺键都会变红。未翻译的 Agent 是一道红色的关卡，而不是一个无声的缺口。

把你实际运行的检查记录到 `Important Documentation.md`。本地构建通过不能作为平台关卡的证据。

## 如果配置需要新的 Codec

JSON、JSONC 和 TOML 已受支持。当它们与 Agent 的格式匹配时，复用它们的读取器、严格检查和编辑器。需要另一种 Codec 的格式属于 Agent 模块与注册表之外的共享核心改动；请明确说明这一范围，并同时验证既有格式。

`ConfigFile` 携带一个 `codec`，`src/core/config-file.ts` 依据它分发。新增一个 Codec 意味着：

- 一个产出 `JsonObject` 的读取器，使各 Agent 和 Status 永远不需要了解具体格式；
- 一个与读取器分离的严格检查器，决定 ccset 到底能否改写该文件。未通过检查的文件会进入与解析失败的 JSON 目标相同的“备份后重新创建”确认；
- 一个应用 `ManagedWrite[]` 的写入器。

关键保证就落在写入器上。如果这种格式携带任何解析会丢弃的内容——注释、空行、键顺序、对齐——那么从解析结果重建文档就会删掉它们，“非受管键必须幸存”在第一次有人保存时就会变成假话。`src/core/toml/` 不做重建：它记录每个值*所在的位置*并对文本区间做拼接替换，因此它没有写入的每一个字节都会原样保留。在编写其他任何东西之前，先用一份语料证明它在空写入列表下逐字节不变。

`ConfigParseError` 是保存流程捕获的基类。用它派生你自己的子类并提供 `messageKey` 与 `titleKey`，让用户得知这份文件不是哪种格式，而不是被告知一份 TOML 文件是坏的 JSON。
