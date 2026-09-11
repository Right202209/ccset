# 添加新 Agent：编码助手工作流程

本文供执行“为 ccset 添加其他 Agent 支持”任务的编码助手使用。这里的 **Agent**
指 ccset 管理配置的编程工具；Provider 指该工具连接的第三方 API 服务。
接入的交付物包括可用的配置流程、验证脚本和文档。

按下面的顺序推进，每一步都留下可检查的产出。接口细节见
[Adding an Agent](../adding-an-agent.md)，通用贡献要求见
[AGENTS.md](../../AGENTS.md)。本流程不预设要接入哪个 Agent，也不改变已有支持承诺。

## 1. 确定任务范围

先运行 `git status --short`，保留无关的本地修改；阅读目标目录适用的 `AGENTS.md`。
用户提供了 issue 或 PR 时，连同评论一起阅读。可以直接提交完整的实现提案，
无需先创建 issue。

从用户需求、issue 和现有资料中整理下面的任务卡；无法确定的项明确标记待确认。
关键配置事实未确定时，继续做独立的只读调研和已有接口梳理。

| 项目 | 需要确定的内容 |
| --- | --- |
| 用户场景 | 谁需要配置什么，接入后如何完成这条路径 |
| 目标身份 | 上游项目地址、显示名称、小写 kebab-case 的 Agent ID、待验证版本 |
| TUI 范围 | 全局设置、Provider 新建/编辑、Status、激活说明等实际需要的动作 |
| CLI 范围 | 是否提供非交互命令；逐项列出支持的操作 |
| 管理范围 | 文件和 Managed key，明确本次不管理的设置 |
| 验证条件 | 可用的系统、终端、上游版本及能重复执行的手动场景 |

开始实现前，简述预期行为和验证范围。例如：“保存一个 Provider，保留所有未管理
字段，Status 隐藏密钥；提供 TUI 和 `provider set`，通过临时 home 的文件断言
与构建后 CLI 验证。”具体功能随任务确定。

阅读顺序：

1. [CONTEXT.md](../../CONTEXT.md)：Agent、Provider、Managed patch、Auth profile 等术语。
2. [贡献要求](../../CONTRIBUTING.md#new-agents)、[PRD](../../PRD.md) 和
   [架构](../architecture.md)：接入范围、模块边界和文件安全保证。
3. [扩展指南](../adding-an-agent.md)：接口、模块布局和已有实现的易错点。
4. 涉及 CLI 时，阅读[命令规范](../milestone-3-non-interactive.md)、
   [已实现的 CLI 行为](../user-guide.md#cli) 和规范链接的 ADR 0006–0014。
5. [验证指南](../verification.md) 与
   [验证记录](<../../Important Documentation.md>)：所需检查、兼容性未知项和历史证据。

命令规范保留了已接受设计及实现差异；例如当前实现使用 `--json`。核对当前
源码和用户指南，遇到与已接受 ADR 的冲突要说明差异及处理方案。

**本步产出：**任务卡、预期行为、验证范围。

## 2. 核实目标 Agent 的配置契约

优先查阅上游官方文档、schema、源码和测试。每条关键结论记录来源链接及版本或
提交号；需要运行验证的结论单独列出。其他 Agent 的实现可作结构参考，配置字段
和凭据规则必须由目标 Agent 的证据支持。

| 核实项 | 需要留下的结论 |
| --- | --- |
| 配置位置 | 各平台默认路径、home/XDG/上游环境变量的作用，临时 `CCSET_HOME` 如何保持隔离 |
| 格式与优先级 | JSON、JSONC、TOML 或其他格式；多个文件并存、全局与项目配置并存时谁生效 |
| Managed key | 每个叶子路径、类型、必填条件、校验规则、默认值及删除含义 |
| Provider ID | 是文件名还是对象键；合法字符、保留名、冲突规则及路径穿越防护 |
| 凭据 | 保存位置、实际读取来源、环境变量或 keyring 是否覆盖文件、是否需要 Auth profile |
| 生效方式 | 自动读取、需要启动参数，还是需要显式切换；如何验证实际生效 |
| 检测与 Status | 哪些文件可用于检测，缺失/损坏/不受支持的状态如何报告 |

为每个管理字段填写一行映射，后续据此实现 manifest 和断言：

| 字段 ID | 文件与叶子路径 | 磁盘类型/校验 | TUI 初值与留空语义 | CLI 选项/省略/`--unset` | 是否含密钥 |
| --- | --- | --- | --- | --- | --- |
| 待填写 | 待填写 | 待填写 | 待填写 | 未提供 CLI 时填“不适用” | 待填写 |

TUI 的模板默认值与 CLI 的 Managed patch 要分别定义。还要明确编辑集合时哪些
成员由 ccset 管理，防止更新模型列表等操作时丢失保留成员的附加设置。

对尚未确认的配置优先级、认证方式或激活路径，写出可重复实验、通过条件和受影响
功能，记录到验证记录 §1。缺少依据的部分不能作为已可用行为交付；足以支持
安全接入但缺少持续验证的情况，应说明是否建议标为 experimental。

**本步产出：**配置契约、字段映射、来源与待验证项。

## 3. 划定改动边界并选择参考实现

复用已有能力时，运行时代码的改动范围是 `src/agents/<id>/` 和
[`src/registry.ts`](../../src/registry.ts)。验证脚本、npm 脚本接入及文档也是交付内容。

| 目标配置形态 | 优先参考 | 重点阅读 |
| --- | --- | --- |
| 全局配置与各 Provider 分文件 | [claude-code](../../src/agents/claude-code/) | `paths.ts`、`global.ts`、`providers.ts`、`provider-commands.ts` |
| 同一文档内嵌多个 Provider | [opencode](../../src/agents/opencode/) | `manifest.ts`、`providers.ts`、`commands.ts`；逐模型合并和 JSONC 目标选择 |
| 配置与凭据分离、需要显式切换 | [codex](../../src/agents/codex/) | `auth.ts`、`activate.ts`、`provider-use.ts`；多文件提交及失败处理 |

按职责借鉴代码，只带入目标 Agent 已核实的规则。例如 Claude Code 的
create-only 状态文件、Codex 的整文件凭据替换，以及现有 Anthropic 连接探测，
各有自己的契约。

若需要新 Codec、新的 Screen 形状或超出现有 `OperationId` 的命令，先在改动清单
中明确共享接口的责任、设计依据及现有 Agent 的回归范围。不要在 UI、通用 parser
或 core 中添加针对某个 Agent ID 的分支。新 Codec 还需严格检查、保留原文的编辑
策略及语料验证，参见[Codec 接入说明](../adding-an-agent.md#if-the-config-needs-a-new-codec)。

**本步产出：**文件改动清单、参考模块、共享能力扩展及其验证范围（如有）。

## 4. 实现完整配置路径

按下面的顺序实现，并随行为补充聚焦的可执行断言。文件布局按职责拆分，详细说明见
[模块布局](../adding-an-agent.md#layout)。

1. **路径和 manifest。** 在 `paths.ts` 中集中处理目标选择和备份目录；路径以
   `ctx.home` 为基础。`CCSET_*` 在 CLI 边界读取并向内传递。`manifest.ts` 保持
   声明式数据，集中管理叶子路径和字段规则；Agent 默认值、常量与字符串留在模块内。
2. **读取和写入映射。** 实现磁盘值到表单值的 `seed*`、表单值到 Managed writes
   的 `emit*`，区分磁盘 baseline 与模板初值。Status 的读取路径保持无写入。
3. **保存。** `save*` 在保存时重新读取目标，通过
   [`src/operations/commit.ts`](../../src/operations/commit.ts) 计划和提交，复用
   core 的 Codec、合并、备份、原子写入及错误处理。TUI 通过
   [`runSave`](../../src/core/save.ts) 等已有接口生成恢复与成功 Screen。
4. **TUI 与文案。** `actions.ts` 返回现有 `ActionResult`，不导入 `src/ui/`。
   补齐读取、编辑、review、保存、失败恢复、Status 和正确的生效说明；所有 Agent
   字符串在 `messages.ts` 同时提供 `en` 和 `zh-Hans`，使用唯一命名空间。
5. **模块入口与注册。** 按 [`Agent`](../../src/types.ts) 实现 `id`、`name`、
   `messages`、`detect(ctx)`、`getActions()` 及选定的 `commands`。检测仅查文件，
   不捆绑或执行目标 Agent；尚无配置也能进入创建流程。静态注册仅增加 import 和
   `AGENTS` 数组项，不做动态扫描；保持导入与检测轻量，检查对既有 Agent 启动的影响。

实现中逐项保持以下语义：

- 写入管理叶子，保留所有层级的未管理键；TOML/JSONC 保留无关注释、格式和顺序。
- `ManagedWrite.value === undefined` 表示删除。TUI 留空或 Unmanaged 按字段契约
  删除；关闭代理删除对应环境键；受支持的布尔 `false` 保持布尔值。
- 备份放在该 Agent 配置目录的 `backups/ccset/`，复用 `backupsDirFor` 和轮转逻辑。
  POSIX 下目标和备份权限为 `0600`。
- 损坏文件先走 TUI 确认或受支持命令的显式 `--replace-invalid`；替换前备份原始字节。
- 多目标命令在首次写入前读完、验证并计划所有目标；提交中途失败报告已写路径，
  不声称跨文件事务或自动回滚。
- 密钥输入使用 secret 字段；review、Status、成功/错误信息和 busy 文案不泄漏密钥。
  若范围包含 Test connection，须有目标协议依据，确认时展示目的主机，不打印响应体。

### 需要 CLI 时

`Agent.commands` 可选；仅提供 TUI 时在任务卡和用户文档写明。提供 CLI 时：

1. 在模块内用 [`AgentCommands`](../../src/operations/types.ts) 声明支持的操作、
   字段、secret 和安全选项，由共享 parser 和 `executeOperation` 分发。
2. 用结构化请求/结果和 typed errors；不调用 Screen 的 `submit()` 或 `confirm()`
   来实现命令，保持命令模式不加载 Ink。
3. 提供的字段才修改，省略保留磁盘值，`--unset` 显式删除；不带入 TUI 模板默认值。
   校验应用 patch 后的完整提案，新 Provider 检查必填项。
4. 密钥只经 `CCSET_TOKEN` 或显式 `--token-stdin` 接收，两者同时提供报错；不隐式
   读取 stdin。省略密钥时保留已有值，缺少必需密钥则失败。
5. 复用 plan/apply，并令 dry-run 和无变化命令均不写文件、不创建备份。Status DTO
   不含凭据；human/JSON 输出与进程退出码遵循共享实现。

现有命令树包括 `status`、`global.set`、`provider.set`、`provider.use`、`state.init`。
仅声明确实支持的项；新 Agent 不必复制其他 Agent 的全部动作。当前非交互范围不含
连接探测、清理备份或删除 Auth profile，见 ADR 0007。

**本步产出：**可完整走通的目标配置路径、双语文案、静态注册及选定的 CLI 能力。

## 5. 验证行为与失败路径

新增 `scripts/verify-<id>.ts`，用 `mkdtemp` 创建隔离 home 并在结束时清理。
CLI 场景复用 [`cli-harness.ts`](../../scripts/cli-harness.ts)，同时覆盖
`executeOperation` 和构建后的 `dist/cli.js` 边界。按接入范围至少验证：

| 场景 | 应断言的可观察结果 |
| --- | --- |
| 全新配置、已有配置 | 新建结果有效；编辑仅改变预期叶子，其他 Provider 和深层未管理兄弟键保留 |
| Status | 正确报告配置及异常状态，不创建或修改配置、凭据和备份 |
| 表单打开后文件被修改 | 保存时保留外部新增的未管理内容 |
| 删除与类型 | 留空/Unmanaged/代理关闭按契约删除；布尔、整数、列表保持正确磁盘类型 |
| 集合字段（如有） | 保留成员的附加设置不变，新增和删除成员符合契约 |
| 多配置文件/格式（如有） | 选中实际生效目标，其他文件不变；格式保留型 Codec 的空写入逐字节不变 |
| 损坏文件与保存失败 | 未确认不覆盖，替换有原始备份；TUI 取消或失败返回后草稿保留 |
| 备份及权限 | 原始字节可恢复，按 `MAX_BACKUPS` 轮转；POSIX 目标/备份均为 `0600` |
| 密钥 | 输入和界面遮罩；stdout、stderr、JSON、错误及状态 DTO 无完整测试密钥 |
| 凭据独立/切换（如有） | 正确目标、冲突处理、覆盖来源检查、提交顺序和部分失败报告 |
| 多目标命令（如有） | 后续目标在解析/校验阶段失败时，先前目标也未写入或备份 |
| CLI（如有） | patch 省略/删除、新建必填、secret 来源、dry-run/no-op 零写入和零备份、退出码 |
| 注册与双语 | 文件检测、Agent 选择、`--agent <id>`、所有 Screen 字符串可解析、两语言 key/占位符一致 |

把 fixture 接入 `package.json` 的 `verify:<id>` 和顺序执行的 `test` 链，并在
[验证映射](../verification.md#fixture-map) 中登记。新命令 fixture 如单独拆出，也需
接入这三处。更新涉及 Agent 枚举和命令能力的既有断言。

新 Agent 的验证还必须做一次有意义的变异验证：临时引入错误，例如跳过删除或
用父对象覆盖叶子，运行对应 fixture 确认断言失败；恢复该改动，再运行确认通过。
记录变异点和失败断言，避免只验证测试脚本能启动。

文案检查需导入 `src/registry.js` 完成 catalog 注册。可参考
[`verify-codex-auth.ts`](../../scripts/verify-codex-auth.ts) 的 Screen 遍历：只执行
读取用的 `run()`，不为查文案执行 `submit()`/`confirm()`；另行验证写入流程。

Node.js 18+，使用 `npm ci` 安装锁定依赖。开发中先运行聚焦 fixture，然后完成：

```bash
npm run typecheck
npm run build
npm run verify:code-gates
npm test
git diff --check
```

新增 Agent 会修改测试接入，因此需要完整 `npm test`。所有 fixture 必须顺序运行，
它们共用 `.verify/`，部分还会重建 `dist/`。完整 POSIX fixture 套件在 Linux/macOS
运行；平台要求及跳过规则见[验证指南](../verification.md)。质量门槛同时覆盖
`src/` 和 `scripts/`：文件 ≤ 300 行、函数 ≤ 50 个非空行、复杂度 ≤ 10；另需人工
检查嵌套 ≤ 3、位置参数 ≤ 3。不要通过新增 baseline 例外掩盖违规。

在真实终端手动走通 TUI。下面的 `new-agent` 在接入后替换为实际 ID：

```bash
ccset_agent_id='new-agent'
ccset_scratch="$(mktemp -d)"
CCSET_HOME="$ccset_scratch" CCSET_LOCALE=en node dist/cli.js --agent "$ccset_agent_id"
CCSET_HOME="$ccset_scratch" CCSET_LOCALE=zh-Hans node dist/cli.js --agent "$ccset_agent_id"
```

在该临时目录内构造新建、嵌套未管理键、损坏文件等场景，使用占位密钥
`sk-TEST-DO-NOT-USE`。检查写入文件后清理临时目录。显著 TUI 变化附终端截图；
影响布局时验证窄屏和 resize。

运行上游 Agent 验证生效属于另一个场景：`CCSET_HOME` 只改变 ccset 的目标，
不会自动隔离上游工具。先按上游支持的参数或环境变量指定临时配置和凭据位置，
再由验证者执行已记录场景；所有写入测试都使用临时 home。

**本步产出：**自动化结果、变异验证结果、可重复手动步骤，以及明确的未验证项。

## 6. 更新文档并交付

- 更新 [README.md](../../README.md)、[README.zh-CN.md](../../README.zh-CN.md) 和
  [用户指南](../user-guide.md) 中相关的 Agent ID、配置路径、能力、使用方法及限制。
- 更新[验证映射](../verification.md)；若扩展了共享能力，更新相关架构/规格说明。
  术语或设计决策变化遵循[领域文档指南](domain.md)。
- 新运行时证据追加到验证记录 §9，记录命令/场景、结果、OS、Node、相关终端和上游
  Agent 版本；保留历史条目。未完成的兼容性实验保留在 §1。
- 检查最终 diff 与 `git diff --check`，确认没有生成目录或临时变异混入交付。
  按 [PR 模板](../../.github/PULL_REQUEST_TEMPLATE.md) 报告行为、验证和维护影响。

交付时写清：实现了哪些用户路径；哪些命令实际执行并通过；哪些检查失败、跳过或
仍待执行及原因；是否建议 experimental。合成配置 fixture 通过只能证明该场景的
读写行为，真实 Provider 请求及其他平台需要各自的证据。

**完成条件：**约定范围的主流程可用，安全与回归检查满足验证指南，文档与实际实现
一致，验证局限已披露。合并和发布要求另外遵循贡献指南及验证记录 §6。

## 可直接使用的任务模板

将尖括号内容替换后交给编码助手；资料中能查明的项由助手补齐。

```text
请为 ccset 添加对 <目标 Agent 名称> 的支持，Agent ID 为 <小写 kebab-case id>。
上游项目/官方文档：<链接>
目标版本和用户场景：<版本；需要完成的配置路径>
功能范围：<TUI 动作；是否提供 CLI，提供哪些操作>
已知限制或相关 issue：<内容或链接>

遵循 AGENTS.md 和 docs/agents/add-agent-workflow.md：
先核实配置文件、优先级、Managed key、凭据来源及生效方式，说明来源和未知项；
列出预期行为、改动范围及验证范围，再通过已有接口完成实现。
复用共享读写、合并、备份、遮罩和 plan/apply 核心，补齐双语文案和静态注册。
添加隔离 home 的 fixture，完成变异验证，接入 npm test 并顺序执行所需检查。
更新用户文档和验证映射，将实际运行时证据追加到 Important Documentation.md §9。
交付时报告实现范围、实际验证结果及仍未验证的兼容性，不把待执行场景写成已通过。
```
