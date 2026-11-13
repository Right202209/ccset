# ccset 产品评审意见书：从「切换器」到「配置即代码」

> **存档说明。** 这是 2026-11-10 收到的产品评审快照，除本说明外原样保留。评审依据的是当时已推送的仓库和 v0.10.0，部分结论已被之后的提交改变；其中的竞品数据和下载量未经本项目独立核实，引用前请重新查证一手来源。维护者据此做出的决定见[项目计划](../zh-CN/project-plan.zh-CN.md)。

> - **评审对象**：[Right202209/ccset](https://github.com/Right202209/ccset)（npm 包 `@droite/ccset`，v0.10.0）
> - **评审视角**：资深产品经理。关注产品逻辑、市场位置与差异化，不评审代码实现
> - **数据快照**：2026-11-10（GitHub API、npm API 与各项目公开文档）
> - **方法与局限**：依据 README、`PRD.md`、`docs/user-guide.md`、`package.json` 与竞品公开资料做的案头评审；未安装试用，未做用户访谈。凡标注「待验证」「未核实」的都是假设，不是结论

---

## 0. 结论先行

**一句话**：ccset 的工程质量明显高于它现在的位置，但它正拿自己最弱的一面（「切换 provider」）去碰一个 15 万 Star 对手最强的一面。建议把定位从「终端里的切换器」改为「**Coding Agent 的配置即代码**」，主攻 SSH、容器、CI 和团队下发这些桌面应用到不了的地方。

**三个核心判断**

1. **定位自相矛盾。** `PRD.md` 写明「ccset generates configuration; it does not activate it」，仓库标语却是「Switch API providers」，实际产品则是 3 个 Agent 能切换、2 个不能。用户按标语建立预期，然后在 FAQ 里读到「为什么保存后没有切换」。
2. **正面战场已经结束。** CC Switch（桌面端）153,312 Star、支持 12 个工具、90+ 预设；它的终端分支 CC-Switch CLI 也有 5,464 Star。ccset 是 2 Star、近 30 天 npm 下载 46 次。在「支持多少工具、多少预设、多少周边功能」上追赶没有胜算。
3. **真正的资产被埋在第三屏。** 没有自有数据库、没有常驻进程、没有代理；patch 语义、`--dry-run`、JSON 输出、稳定退出码、36 组验证脚本。这是一套「可以写进脚本里信任」的契约，而主流竞品都是「人点界面」的产品形态。差异化的地基在这里，不在「五个 Agent 一个界面」。

**最该先做的三件事**

| 顺序 | 动作 | 为什么是它 |
| --- | --- | --- |
| 1 | 统一动词：所有 Agent 都有 `use`，再加一个只影响当前会话的 `run` | 消除「保存 ≠ 激活」的认知断层，成本最低、收益最大 |
| 2 | 补上闭环：`doctor` 按协议探测全部 5 个 Agent | 用户要的不是「文件写对了」，是「Agent 连上了」|
| 3 | `ccset.toml` + `plan` / `apply` | 把已有的 dry-run 能力产品化成桌面形态不擅长的东西 |

## 1. 产品现状快照

| 维度 | 现状（均来自仓库公开文档） |
| --- | --- |
| 仓库标语 | Switch API providers for coding agents from any terminal. No desktop app, no proxy, no rewritten config. |
| PRD 定位 | A TUI that generates and edits Claude Code settings files… it **does not activate** it（PRD 仍按 Claude Code 单 Agent 叙述） |
| 支持的 Agent | Claude Code、opencode、Codex CLI、pi、Grok Build，共 5 个 |
| 形态 | Ink TUI + 非交互 CLI（`--json`、`--dry-run`、`--unset`、`--token-stdin`） |
| 写入策略 | 只改受管字段；TOML / JSONC 原位编辑，保留注释与排版；写前备份（每文件 10 份）；原子写；POSIX `0600` |
| 激活方式 | Claude Code：复制 ccset 打印的 `claude --settings <path>`；opencode：启动时读取；Codex / pi / Grok Build：`provider use` |
| 连通测试 | 仅 Claude Code |
| 界面语言 | English、简体中文 |
| 平台 | macOS、Linux 正式支持；WSL、PowerShell 尽力支持；`cmd.exe` 不支持 |
| 分发 | 仅 npm，需要 Node.js 18+ |
| 体量 | 2 Star、0 Fork、0 Issue；npm 近 30 天下载 46 次；仓库创建于 2026-08-30 |

**做得好、应当保留并放大的部分**

- **写入安全是真功夫。** 写前重读、同目录临时文件原子改名、拒绝静默覆盖无法解析的文件、多文件操作中途失败会报出已写路径。
- **对做不到的事直说。** Codex 用 keyring 时明说「切了也没用」；配置块带 `env_key` 时拒绝写入而不是假装成功。
- **非交互契约完整。** patch 语义、dry-run、分类退出码（0 / 1 / 2 / 3 / 4 / 64 / 65 / 66）、密钥只允许走环境变量或 stdin。
- **决策留痕。** 19 篇 ADR，每个取舍都能查到理由。

**评分卡**

| 维度 | 评级 | 一句话 |
| --- | --- | --- |
| 工程与写入安全 | A | 36 组验证、19 篇 ADR、原位编辑，同体量项目里少见 |
| 定位清晰度 | C | 标语、PRD、实际行为三者不一致 |
| 核心闭环 | C+ | 能写对，不能证明连上；能备份，文档里找不到恢复 |
| 差异化潜力 | B+ | 无状态 + 脚本契约是真差异，但没被讲出来 |
| 分发与增长 | D | 目标用户还没看见它 |

## 2. 用户与任务

### 2.1 真实用户是谁

PRD 写的目标用户是「把 Claude Code 指向第三方 Anthropic 兼容端点的开发者」。产品自己的默认值说得更具体：全局设置里代理的默认值是 `http://127.0.0.1:7890`（国内常见的本地代理端口），界面首选语言之一是简体中文。**核心用户就是使用中转和第三方 API 的中文开发者**，但 README 里没有出现「中转」「镜像」「国产模型」这些他们自己会搜的词。

把这群人按使用环境再切一刀：

| 人群 | 典型场景 | 桌面竞品够用吗 | 对 ccset 意味着 |
| --- | --- | --- | --- |
| A. 本机个人用户 | 笔记本上装 1–3 个 Agent，在几家中转之间换 | 够用，且体验更好 | 不是主战场 |
| B. 远程与无桌面用户 | SSH 到云主机、WSL、devcontainer、Codespaces 里跑 Agent | 桌面应用到不了 | **核心人群** |
| C. 团队与平台工程 | 给十几个人、几十台机器下发同一套接入配置 | 靠截图和文档口口相传 | **最大增量** |
| D. 自动化 | CI、临时 runner、一次性容器里启动 Agent | 没有界面可点 | **最深壁垒** |

> 现在 README 的叙述顺序在争取 A，而 A 恰好是竞品护城河最深的人群。

### 2.2 待办任务与满足度

| # | 用户要完成的事 | 频率 | ccset 现状 | 评价 |
| --- | --- | --- | --- | --- |
| 1 | 第一次把某个 Agent 接到第三方 API | 低频，但决定去留 | 手填 ID、地址、密钥，无预设 | 可用，但慢且易错 |
| 2 | 确认「接上了」| 每次接入后 | 仅 Claude Code 可测 | **闭环缺口** |
| 3 | 在几家 provider 之间切换 | 高频 | 5 个 Agent 有 5 种做法，其中 2 个没有 `use` | **最大的体验断层** |
| 4 | 看清「现在用的是哪家」| 高频 | `status` 只读汇总 | 好 |
| 5 | 改坏了要回去 | 低频，但要命 | 有备份、有清理，文档未见恢复入口 | 半个功能 |
| 6 | 换密钥 | 中频 | 旧密钥留在最多 10 份备份里，需手动清 | 有隐患 |
| 7 | 把同一套配置搬到另一台机器，或发给同事 | 中频 | 无 | **空白，也是机会** |

## 3. 产品逻辑问题

按严重度排序。每条的结构是：现象 → 为什么是问题 → 建议。

### P0-1 标语说「切换」，PRD 说「不激活」，产品各做了一半

**现象**

- 仓库标语：Switch API providers for coding agents…
- PRD §1.2：ccset generates configuration; it does not activate it。§2.3 把「激活 provider」列为非目标。
- 实际：Codex、pi、Grok Build 已经有 `provider use`；Claude Code 只打印一条命令让用户复制；opencode 靠重启后读取。
- README 的 FAQ 里专门有一条「为什么保存后没有切换到新提供商？」

**为什么是问题**

FAQ 里出现「为什么它没有做标语说的那件事」，这不是文档问题，是定位问题。用户心里只有一个动词：「用这家」。现在他得记住五个 Agent 各自怎么才算「用上」。统一界面的全部价值就是替用户抹平差异，而激活这一步恰恰把差异原样还给了用户。

**建议**

承认产品已经越过了 PRD 的非目标，把「激活」升级为一等能力：一个动词管默认值，一个动词管当前会话。

```diff
  # 现在：同一个意图，三种做法
- ccset --agent codex provider use kimi         # 可以直接切
- ccset --agent claude-code provider set kimi   # 只保存，还要手动复制 claude --settings <path>
- ccset --agent opencode provider set kimi      # 只保存，还要去改全局 model 再重启

  # 建议：两个动词，五个 Agent 同一种说法
+ ccset use kimi --agent <任意 Agent>            # 设为这个 Agent 的默认
+ ccset run kimi -- claude                      # 只对这一次启动生效，不动全局
```

`run` 值得单独说：Claude Code 的「每个 provider 一个文件 + `--settings`」其实是个被低估的优点，它天然支持**不同终端同时用不同 provider、互不污染**。CC-Switch CLI 已经用 `start claude <id>` 做了同样的事，需求是被验证过的。ccset 只差把「打印命令让你复制」换成「替你执行」。

### P0-2 闭环缺最后一步：五个 Agent 里四个无法验证

**现象**

「测试连接」只有 Claude Code 有。文档给其余四个的理由是「没有一个可以诚实探测的通用端点」。

**为什么是问题**

用户的任务是「让 Agent 连上」，不是「让文件合法」。接入第三方 API 最常见的错误是地址少一段路径、协议选错、密钥贴错，这些都要到 Agent 里撞墙才发现。而按用户指南的描述，协议信息其实已经在配置里了：Codex 只接受 Responses API；Grok Build 的 `api_backend` 三选一；pi 的每个 provider 有 API 类型；opencode 指定了 SDK 包。「没有通用端点」是事实，但结论不该是「不测」，而是「按声明的协议分别测」。

**建议**

新增 `ccset doctor`，逐层检查并给出能区分原因的结论。下面是建议的输出形态（示意，非现有功能）：

```text
$ ccset doctor --agent codex

  ✓ config.toml 可解析
  ✓ model_provider = "kimi" 指向一张存在的表
  ✓ auth.json 与已保存的档案一致
  ✗ POST https://api.example.com/v1/responses → 404

  这个端点可能不支持 Responses API。
  Codex 只接受 wire_api = "responses"，Chat Completions 端点无法使用。
```

还有一个更底层的信号：PRD 自述 `apiKeyHelper` 的验证因为「没有可用的第三方凭据」而搁置；用户指南也写到 opencode 的合并顺序「读自源码，尚未运行确认」。36 组验证脚本保证了「不写坏文件」，但目前没有证据链保证「写完真的能用」。建议买一份最小额度的真实服务（选一家同时提供 Anthropic 兼容和 OpenAI 兼容端点的），给每个 Agent 建一条「写配置 → 发真实请求 → 成功」的冒烟用例。这笔钱是整个项目里回报率最高的投入。

### P1-3 首次接入全靠手填

**现象**

添加 provider 需要手动输入 ID、API 地址和凭据，字段因 Agent 而异。对比：CC Switch 有 90+ 预设；连只有 8 Star 的 bigwhite/cc-switch-cli 都支持 `--preset deepseek`。

**为什么是问题**

预设的价值不是少打几个字，是消灭「地址和协议填错」这一整类失败。没有预设，任务 1（首次接入）的成功率完全取决于用户自己查文档的能力，而这本来是工具该替他做的事。

**建议**

预设做成仓库里的一份纯数据文件，社区用 PR 维护，命令是 `ccset add --preset <名称>`，用户只需要填密钥。差异化做法是**中立、可审计、不设赞助位**：公开报道提到 CC Switch 的赞助商列表里有 18 家 API 中转服务，预设与商业关系绑定是它的结构性包袱，中立恰好是 ccset 可以占住的位置。

### P1-4 两个界面的能力不对称

| 能力 | TUI | CLI |
| --- | --- | --- |
| 新增、编辑 provider | ✓ | ✓ `provider set` |
| 列出 provider | ✓ | 只能看 `status` |
| 删除 provider | ✓ | ✗（ADR 0007 暂缓） |
| 忽略 provider | ✓ | ✗ |
| 切换 provider | Codex、pi、Grok Build | Codex、pi、Grok Build |
| 连通测试 | 仅 Claude Code | ✗ |
| 清理备份 | ✓ | ✗ |

**为什么是问题**

如果定位转向脚本和 CI，CLI 就是主产品，不能是 TUI 的子集。自动化场景里「下线一个 provider」和「上线一个」同样常见。

**建议**

以 CLI 定义能力全集，TUI 是它的一层界面。删除操作加上 `--yes` 和 `--dry-run` 就能满足现有的安全契约，不需要另立规则。

### P1-5 环境变量的跟随规则有一个例外

**现象**

opencode 跟随 `XDG_CONFIG_HOME`，pi 跟随 `PI_CODING_AGENT_DIR`，Grok Build 跟随 `GROK_HOME`。唯独 Codex 的 `CODEX_HOME` 是「只报告，不跟随」：TUI 里保存会落到 Codex 不读的目录（只在 Status 里提示），非交互写入则直接拒绝。

**为什么是问题**

用户只想记一条规则：「Agent 读哪里，ccset 就写哪里。」四条里有一条例外，而且例外的后果是「保存成功但不生效」，这正是 ccset 在其他地方极力避免的那种失败。

**建议**

统一成另外三个 Agent 已经在用的规则：在真实 home 下跟随 Agent 自己的环境变量；用 `CCSET_HOME` 做隔离运行时不跟随。

### P1-6 备份只进不出

**现象**

每次写入前备份，每个文件留 10 份，可以在 Status 里清空。但公开文档里没有「从备份恢复」的入口。

**为什么是问题**

备份的价值在恢复那一刻才兑现。没有恢复命令，用户出事时得自己去 `backups/ccset/` 里按时间戳找文件再手动复制回去，而这时候他多半已经不信任这个工具了。

**建议**

`ccset backup list`、`ccset backup restore <id>`，以及 `ccset undo`（撤销上一次写入）。`undo` 是「敢按保存」的心理安全网，对促成第一次使用的作用比十份备份都大。

### P2-7 明文密钥：现在是短板，可以变成卖点

**现象**

README 坦承「配置文件和备份可能包含明文凭据」。PRD 把钥匙串和 `apiKeyHelper` 列为待办，但卡在一项没做的实验上。

**机会**

用户指南已经记录了各 Agent 原生支持的「引用式密钥」：pi 的 `apiKey` 接受 `$ENV_VAR` 和 `!command`，Grok Build 有 `env_key`，Codex 也有 `env_key`（ccset 目前遇到它会拒绝写入）。

**建议**

提供「无明文模式」：ccset 往配置里写引用，真正的密钥放在环境变量、系统钥匙串或团队已有的密钥工具里。备份里从此也没有密钥，「换密钥要清十份备份」的问题一并消失。

```diff
  # ~/.pi/agent/models.json
- "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
+ "apiKey": "$KIMI_API_KEY"
```

对团队和 CI 用户，这一条本身就够构成选型理由。

### P2-8 「Provider」在不同 Agent 里不是同一个东西

**现象**

在 Grok Build 里，一个「provider」实际是一张 `[model.<id>]` 表，也就是一个模型条目；在 Codex 里是 `[model_providers.<id>]` 加一份凭据档案；在 Claude Code 里是一个独立的 settings 文件。

**为什么是问题**

词统一了，行为没统一：ID 规则、能不能带多个模型、「切换」到底改了什么，各不相同。

**建议**

在产品层定义一个明确的对象：**接入档案（Profile）= 端点 + 凭据 + 默认模型 + 协议**。文档和界面都只讲这一个定义；各 Agent 的差异降级为「这份档案在该 Agent 上如何落盘」的实现说明，不要求用户记住。

### P2-9 高频路径太长，入口不好记

**现象**

非交互命令必须带 `--agent`；包名是 `@droite/ccset`，免安装启动要敲 `npx @droite/ccset`。

**建议**

- 支持默认 Agent（环境变量 `CCSET_AGENT` 或一次性设置），或者把 Agent 做成位置参数：`ccset codex use kimi`。
- `ccset use` 不带参数时弹出模糊选择器；提供 shell 补全。
- **npm 上不带 scope 的 `ccset` 目前没有被注册**（2026-11-10 查询 registry 返回 404）。建议尽快注册并发布同名包，让入口变成 `npx ccset`。

### P2-10 PRD 已经落后于产品

**现象**

PRD 仍然写着「目前专注 Claude Code」「不引入自己的配置文件」「不服务无人值守场景」。而产品已经支持 5 个 Agent、有 `~/.ccset/settings.json`、有完整的非交互模式。PRD 全文没有竞品与市场一节；六条成功标准衡量的都是「产出是否正确」，没有一条衡量「用户是否成功」或「是否有人在用」。

**为什么是问题**

这不是文档洁癖。它意味着从「Claude Code 配置生成器」到「五 Agent 配置工具」的两次扩张，都没有重新回答「为谁、凭什么」。`ccset` 这个名字（cc 指 Claude Code）就是这段历史留下的痕迹。

**建议**

重写 PRD 第 1–2 章：定位、目标用户、竞品位置、非目标，以及以结果为导向的成功标准（见第 9 节）。

## 4. 市场与竞品

### 4.1 三个市场事实

1. **多 Agent 并行是常态。** CC Switch 支持的工具从 5 个扩到了 12 个，说明开发者没有收敛到单一 CLI。
2. **第三方 API 的供给在爆炸。** 中转、聚合、国产模型直连并存，「接入配置」成了刚需。这是整个品类存在的原因。
3. **品类已有绝对头部。** CC Switch 用一年多做到 15 万 Star，并且在桌面端把「切换」做到了托盘里点一下。

### 4.2 竞品矩阵

| 维度 | ccset | CC Switch | CC-Switch CLI | claude-code-router | 手改 + alias |
| --- | --- | --- | --- | --- | --- |
| 形态 | TUI + CLI | 桌面应用（Tauri） | TUI + CLI（Rust） | 本地代理，另有桌面端 | 编辑器 |
| GitHub Star | 2 | 153,312 | 5,464 | 38,081 | — |
| 支持的工具 | 5 | 12 | 7 | 从 Claude Code 起家 | 任意 |
| 核心动作 | 把配置文件写对 | 一键切换 | 一键切换 | 请求级路由与协议转换 | — |
| 预设 | 无 | 90+ | 未核实 | — | — |
| 接入后验证 | 仅 Claude Code | 健康监测 | 测速、流式检查、拉取模型列表 | — | 自己试 |
| 会话级启动 | 打印命令供复制 | 未核实 | `start claude <id>` | `ccr code` | alias |
| MCP / Skills / Prompts | 无 | 有 | 有 | — | — |
| 代理与故障转移 | 无 | 有 | 有 | 核心能力 | — |
| 用量统计 | 无 | 有 | 有 | — | — |
| 自有状态存储 | 几乎没有（仅语言与忽略列表） | SQLite 数据库 | 未核实 | 自有 `config.json` | 无 |
| 脚本化契约 | `--json`、`--dry-run`、分类退出码 | 非其形态 | 有 CLI 命令 | 部分 | — |
| 无桌面环境可用 | ✓ | ✗ | ✓ | ✓ | ✓ |
| 安装 | npm，需 Node 18+ | 安装包 | 预编译二进制 | npm 或安装包 | — |

### 4.3 需求对照：市场要什么，谁在满足

| 市场需求 | 头部竞品 | ccset 现状 | 判断 |
| --- | --- | --- | --- |
| 一键切换 provider | 托盘点一下，或一条命令 | 半数 Agent 要手动 | 补到及格线，但不指望靠它赢 |
| 开箱即用的预设 | 90+ | 无 | 补齐，走中立路线 |
| 接入后验证 | 测速、流式检查、健康监测 | 仅 Claude Code | **必须补齐** |
| 多工具统一管理 | 7–12 个 | 5 个 | 不追数量，降低贡献成本 |
| MCP / Skills / Prompts 同步 | 有 | 无 | **不跟** |
| 代理、故障转移、用量统计 | 有 | 无 | **不跟** |
| 远程、容器、CI 可用 | 桌面端不可用；CLI 分支可用 | 可用 | **主战场** |
| 变更可预览、可审计 | 弱 | 已有 `--dry-run` | **放大成核心卖点** |
| 团队统一下发 | 导入导出、WebDAV、深链接 | 无 | **用声明式文件切入** |
| 密钥不落盘 | 未见公开说明 | 无（PRD 有规划） | **潜在的独占卖点** |
| 工具本身零侵入 | 自有数据库或常驻进程 | 无状态 | **已具备，需要讲出来** |

### 4.4 竞争判断

- **对 CC Switch：互补，不是竞争。** 它是「本机的控制台」，ccset 应当是「哪里都能跑的那条命令」。在它的主场追功能没有意义。
- **对 CC-Switch CLI：这才是直接对手。** 同样是「交互式 TUI + 可脚本化 CLI」，功能面更宽，体量是 5,464 对 2。ccset 能赢的不是功能数，是「敢不敢把它写进 CI」：更窄的范围、更严的写入契约、声明式文件。
- **对 claude-code-router：不在同一层。** 它改的是请求，ccset 改的是配置。文档里直接写「需要按请求路由请用 CCR」，把非目标变成清晰的边界。
- **对「手改配置 + shell alias」：这是真正最大的竞品。** 多数远程用户今天就是这么干的。给他们的价值主张必须能一句话说完：比手改安全，比桌面应用轻。

## 5. 差异化策略

### 5.1 定位重写

```diff
- Switch API providers for coding agents from any terminal.
- No desktop app, no proxy, no rewritten config.
+ Config-as-code for coding agents.
+ Plan it, apply it, roll it back — over SSH, in containers, in CI.
+ No database, no daemon, no proxy. Your agent's files stay the only source of truth.
```

中文一句话：

> 把 Coding Agent 的配置当代码管：能预览，能回滚，能进 CI。

### 5.2 三根支柱

**支柱一：声明式（最重要）**

一份可以提交进 Git 的 `ccset.toml`，描述「哪个 Agent 用哪份接入档案」，密钥只写引用。字段名是建议形态，不是现有功能：

```toml
# ccset.toml：可以进仓库，里面没有密钥
[profiles.kimi]
base_url = "https://api.example.com/v1"
protocol = "openai-responses"
model    = "example-model"
secret   = "env:KIMI_API_KEY"

[agents.codex]
use = "kimi"

[agents.claude-code]
use = "kimi"
```

```bash
ccset plan     # 列出将要改动的每个文件、每一行，不写入
ccset apply    # 执行，写前备份
ccset undo     # 撤销上一次 apply
```

这是对现有 `--dry-run` 和 patch 语义的产品化，不是另起炉灶。它直接打开三个桌面形态不擅长的场景：新人入职一条命令、devcontainer 的 `postCreateCommand`、CI 临时 runner。

**支柱二：零影子状态**

ccset 没有自己的 provider 数据库，Agent 的配置文件就是唯一事实来源。这意味着手改和 ccset 可以混用而不会状态漂移；卸载后什么都不留；不存在「工具里显示 A、实际生效 B」。这一点今天已经成立，只是 README 没有把它当卖点讲。

**支柱三：无明文密钥**

见 P2-7。

**地基：可验证的写入契约（已具备）**

原子写、写前重读、只动受管键、保留注释、拒绝静默覆盖、稳定退出码、36 组验证。建议整理成一页可以逐条核对的《写入契约》，每一条链接到对应的验证脚本，让「安全」从形容词变成可以点开看的证据。

### 5.3 明确不做

| 不做 | 理由 |
| --- | --- |
| 桌面应用、托盘 | 头部已经做到极致 |
| 代理、路由、故障转移 | 与「无常驻进程」冲突；CCR 和 CC Switch 已覆盖 |
| MCP / Skills / Prompts 管理 | 范围蔓延，每一项都是独立的同步难题 |
| 用量与费用统计 | 需要常驻或解析会话，偏离配置层 |
| 追工具数量 | 从 5 到 12 不会改变任何人的选型 |
| 带赞助位的预设 | 中立是信任资产 |

## 6. 修改建议清单

| 优先级 | 建议 | 对应问题 | 规模 | 验收标准 |
| --- | --- | --- | --- | --- |
| P0 | 统一 `use`，新增会话级 `run` | P0-1 | S–M | README 的五行激活说明合并为一行；FAQ「为什么没切换」可以删掉 |
| P0 | `doctor`：按声明的协议探测 5 个 Agent | P0-2 | M | 地址错、协议错、密钥错能给出三种不同结论 |
| P0 | 重写 README 首屏和仓库描述 | 定位 | S | 首屏先讲场景（SSH、容器、CI），再讲功能 |
| P1 | 真实端点冒烟测试 | P0-2 | S | 每个 Agent 至少一条「写配置 → 真实请求成功」的自动化用例 |
| P1 | 预设库：纯数据、社区维护、无赞助位 | P1-3 | M | 用预设接入一家常见服务不超过 30 秒 |
| P1 | CLI 补齐：`list`、`delete`、`backup restore`、`undo` | P1-4、P1-6 | M | TUI 能做的事 CLI 都能做 |
| P1 | `CODEX_HOME` 跟随规则统一 | P1-5 | S | 四个环境变量适用同一条规则 |
| P1 | 注册不带 scope 的 `ccset` 包名 | P2-9 | S | `npx ccset` 可用 |
| P2 | `ccset.toml` + `plan` / `apply` | 支柱一 | L | 一份文件在全新机器上一条命令完成至少 2 个 Agent 的接入 |
| P2 | 无明文模式 | P2-7 | M–L | 开启后在配置和备份里检索不到密钥原文 |
| P2 | 单文件二进制、Homebrew、安装脚本 | 分发 | M | 没有 Node 的机器也能装 |
| P2 | 默认 Agent、位置参数、shell 补全 | P2-9 | S | 高频切换命令不超过 3 个词 |
| P2 | WSL 升为正式支持 | 人群 B | M | WSL 进入 CI 的交互测试矩阵 |
| P3 | 重新评估 Gemini CLI | 覆盖面 | 待定 | PRD 曾评估并否决；竞品均已支持，先确认可行的落盘方式再排期 |

规模是相对估计：S 约为几天，M 约为一到两周，L 为数周。不是承诺。

**目标命令形态**

```bash
# 高频：三个词以内
ccset use kimi                # 默认 Agent
ccset codex use kimi          # 指定 Agent
ccset run kimi -- claude      # 只影响这一次会话

# 接入
ccset add --preset <服务商>    # 只需要填密钥
ccset doctor                  # 真的连上了吗

# 自动化
ccset plan && ccset apply     # 声明式
ccset status --json           # 已有，保留
ccset undo                    # 后悔药
```

## 7. 路线图

**Now（2–4 周）：把现有产品讲清楚，补到及格线**

- 统一 `use` / `run`
- 改写 README 首屏与仓库描述，注册 `ccset` 包名
- 统一 `CODEX_HOME` 规则
- 建立真实端点冒烟测试
- 重写 PRD 第 1–2 章

**Next（1–2 个月）：闭环与信任**

- `doctor`
- 预设库
- CLI 补齐与 `undo`
- 《写入契约》页面

**Later（一个季度）：拉开差距**

- `ccset.toml` + `plan` / `apply`
- 无明文模式
- 单文件二进制
- devcontainer Feature 与 GitHub Action 封装

## 8. 增长与分发

2 Star 不是质量问题，是没人知道。按投入产出排序：

1. **让服务商的接入文档替你分发。** 每家中转和模型服务商都要写「如何在 Claude Code / Codex 里配置我」。今天它们给的是手改 JSON 的截图，或者「请下载 CC Switch」。ccset 能提供一条可以复制、可以在服务器上执行的命令，这是桌面应用给不了的。CC Switch 用 `ccswitch://` 深链接占住了「一键导入」，ccset 的对应物就是「一行命令」。主动给 3–5 家服务商的文档提 PR。
2. **占住场景关键词。** 写三篇以场景为标题的文档：在 SSH 服务器上配置 Claude Code 第三方 API；在 devcontainer 里预置 Codex 配置；在 CI 里无人值守配置 opencode。中文 README 用用户自己的词：中转、第三方 API、国产模型。
3. **进入目录型入口。** 各类 awesome 列表，以及各 Agent 的社区资源页。
4. **与头部互补，而不是对立。** 在 README 里直接写「本机图形界面推荐 CC Switch；服务器、容器、CI 用 ccset」。坦白的边界本身就是传播点，也符合这个项目一贯的气质。
5. **演示换一个故事。** 现在的动图演示的是「在 TUI 里填表、保存」，这恰好是竞品更强的场景。换成：SSH 进一台新机器 → 一条命令 → `doctor` 全绿 → Agent 跑起来。

## 9. 衡量指标

不加遥测（这是信任资产），用外部可观测的代理指标。目标值是建议，需要作者按投入校准。

| 层级 | 指标 | 当前 | 3 个月建议目标 |
| --- | --- | --- | --- |
| 北极星 | 首次成功时间：从 `npx` 到 Agent 发出第一个成功请求 | 未测 | 用预设不超过 60 秒 |
| 闭环 | `doctor` 覆盖的 Agent 数 | 1 / 5 | 5 / 5 |
| 触达 | npm 周下载 | 约 11（近 30 天 46） | 300+ |
| 认可 | GitHub Star | 2 | 200+ |
| 生态 | 引用 ccset 命令的第三方文档 | 未见 | 5 篇 |
| 质量 | 外部用户提交的 Issue | 0 | 大于 0，有人用才有 Issue |

PRD §2.2 的六条成功标准建议保留，再补两条：一条衡量「用户是否成功」（首次成功时间），一条衡量「是否有人在用」（周下载或外部 Issue）。

## 10. 风险与待验证假设

| 风险或假设 | 影响 | 应对 |
| --- | --- | --- |
| Agent 原生能力侵蚀「切换」的价值：Claude Code 有 `--settings`，opencode 原生支持多 provider，Codex 有 profile 机制（待核实） | 高 | 这正是从「切换」转向「配置即代码」的理由。原生能力越强，越需要一层声明式的统一入口 |
| 5 个上游的配置格式持续变化，单人维护 | 高 | 不扩数量；每个 Agent 标注「已验证版本」；格式变了宁可拒绝写入 |
| Claude Code 方案完全依赖 `--settings` 参数（PRD §8 已识别） | 中 | 让 `use` 落盘到全局 settings，作为第二条路径 |
| 假设远程与 CI 用户的规模足够大 | 高 | **待验证。** 先发场景文档和一行命令，看下载量与 Issue 来源，再投入 `plan` / `apply` |
| 假设服务商愿意在文档里放 ccset 的命令 | 中 | **待验证。** 先找 3 家提 PR，看接受率 |
| CC-Switch CLI 跟进声明式 | 中 | 速度和契约的严格程度是唯一防线，先做先占心智 |
| 预设库带来维护与中立性压力 | 中 | 纯数据、PR 审核、不收赞助；过期预设自动标注 |

## 附录 A：README 首屏改写示例

````markdown
# ccset

Config-as-code for coding agents.

Set up Claude Code, Codex CLI, opencode, pi and Grok Build for any API
provider — over SSH, in a container, or in CI. Preview every change
before it lands.

```bash
npx ccset use <profile>    # switch
npx ccset doctor           # verify it actually connects
npx ccset plan             # see the diff before writing
```

No database. No daemon. No proxy.
Your agent's own config files stay the only source of truth.

> Want a desktop app with a tray menu? Use CC Switch.
> ccset is for everywhere a desktop app can't go.
````

## 附录 B：信息来源

- ccset 仓库：`README.md`、`README.zh-CN.md`、`PRD.md`、`docs/user-guide.md`、`package.json`、`docs/adr/` 目录（2026-11-10 读取）
- GitHub REST API：各仓库的 Star、Fork、Issue 数与创建时间（2026-11-10）
- npm：`@droite/ccset` 在 2026-10-11 至 2026-11-09 的下载量为 46；registry 查询 `ccset` 返回 404
- [farion1231/cc-switch](https://github.com/farion1231/cc-switch) README
- [SaladDay/cc-switch-cli](https://github.com/SaladDay/cc-switch-cli) README
- [musistudio/claude-code-router](https://github.com/musistudio/claude-code-router) 仓库描述与公开介绍文章
- [bigwhite/cc-switch-cli](https://github.com/bigwhite/cc-switch-cli) README
- Augment Code：*CC Switch hits 75K stars*（2026-06）
