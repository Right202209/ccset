# ccset 产品评审与修改意见

> **存档说明。** 这是 2026-11-10 收到的产品评审快照，除本说明外原样保留。评审依据的是当时已推送的仓库和 v0.10.0，部分结论已被之后的提交改变；其中的竞品数据和下载量未经本项目独立核实，引用前请重新查证一手来源。维护者据此做出的决定见[项目计划](../zh-CN/project-plan.zh-CN.md)。

- **评审对象**：[Right202209/ccset](https://github.com/Right202209/ccset)，master 分支，npm `@droite/ccset` v0.10.0，最后推送 2026-11-10
- **依据**：中英文 README、用户指南、`PRD.md`、`CONTEXT.md`、`docs/milestone-3-non-interactive.md`、`package.json`、npm 注册表、仓库目录。竞品信息取自各自的 README
- **局限**：没有实际运行 ccset，也没有读源码。标 ⚠ 的地方是从文档推断的，动手前请先核实

## 一句话结论

> 工程质量已经超出这个阶段的需要，但产品还没有回答访客的第一个问题：**「我为什么不直接用 CC Switch？」** 答案就在仓库里——不建数据库、不起代理、只改点名的键——只是既没有被说出来，也没有被做成用户看得见的功能。

按顺序做三件事：

1. **补上「启用」这最后一步。** 仓库简介的第一个词是 *Switch*，但对 Claude Code 和 opencode，保存之后并不会切换。见 P0-1
2. **把差异化搬上 README 首屏。** 现在最强的卖点藏在 FAQ 和用户指南里。见 P0-2
3. **不再为广度投入。** 5 个 Agent 对 12 个，这场比赛赢不了，也不必赢。见「不要做的事」

## 值得保留的

先说做对了的。下面每一项都是后面定位的原材料，改动时不要伤到它们。

| 已有的做法 | 为什么是资产 |
| --- | --- |
| 没有自己的数据库或提供商索引，每次都从 Agent 的配置文件读 | CC Switch 以自有 SQLite 为单一事实来源；ccset 卸载后一切照常，手改配置也不会和工具「打架」 |
| TOML / JSONC 就地编辑，注释、空行、键顺序逐字节保留 | 把配置放进 dotfiles 的人最在意这一点 |
| 做不到就拒绝并说明原因（Codex 的 keyring、`env_key`、`CODEX_HOME` 不一致） | 配置工具最糟的失败是「显示成功，实际没生效」 |
| 密钥只走 `CCSET_TOKEN` 或 stdin，永不出现在命令参数里 | 可以放心写进 CI |
| `--dry-run`、JSON 输出、分级退出码 | 脚本契约写得完整：输入、输出、退出码都有明确约定 |
| npm 包带 provenance 来源证明（v0.10.0） | 一个要碰 API 密钥的工具，「来源可验证」本身就是卖点 |
| 36 个 verify 脚本、成体系的 ADR、中英双语文档 | 「经得起核对」有证据，不是口号 |

## P0 定位与承诺

### P0-1 简介说「切换」，产品只「生成」

**现象。** 三处说法互相矛盾：

- 仓库简介：*Switch API providers for coding agents from any terminal.*
- PRD §1.2：*ccset generates configuration; it does not activate it.*
- README 的 FAQ 专门有一条：「为什么保存后没有切换到新提供商？」

保存之后要做什么，五个 Agent 各不相同：

| Agent | 保存之后 | CLI 的 `provider use` |
| --- | --- | --- |
| Claude Code | 手动运行 ccset 打印的 `claude --settings <path>` | 无 |
| opencode | 启动 opencode，由它读取配置 | 无 |
| Codex CLI | 在 TUI 里选「使用」 | 有 |
| pi | 在「全局设置」里改默认提供商和模型 | 有 |
| Grok Build | 在「全局设置」里改默认模型 | 有 |

**为什么重要。** 需要写进 FAQ 来解释的行为，就是产品问题。用户的任务是「换个提供商继续干活」，不是「得到一个正确的文件」。而用户最多的 Claude Code，拿到的恰好是最不完整的一段体验。

**建议。**

1. **五个 Agent 统一一个动词 `use`。** 能切换的就切换；暂时不能的，也让这条命令存在并给出下一步，而不是以「该 Agent 不支持此命令」（退出码 66）结束。对 Claude Code，`use` 的语义由你定：最保守的是打印并复制启动命令；更完整的是把该提供商的受管理键合并进 `~/.claude/settings.json`（先备份，可 `--dry-run`）——这和「全局设置」已经在做的写入是同一类。
2. **给 Claude Code 加会话级启动 `run`**，直接执行 `claude --settings <path>`。它不写任何文件，比全局切换更贴近「不改写配置」的原则，还顺带支持「两个终端用两个提供商」。PRD §2.3 把 launcher 列为非目标，建议用一份新 ADR 重新评估。
3. **TUI 保存成功后，把「启用」作为默认聚焦的下一步**，而不是一行需要手抄的命令。

```diff
  # Claude Code，今天：保存后手抄命令
- claude --settings ~/.claude/settings.relay.json
  # 建议：会话级启动，不写任何文件
+ ccset --agent claude-code run relay
  # 建议：和 codex / pi / grok-build 用同一个动词
+ ccset --agent claude-code provider use relay
```

需要说明：CC-Switch CLI 已经有 `start claude <id>`。所以这一条是**补齐**，不是差异化——但不补齐，差异化无从谈起。

**验收标准。**

- [ ] 从「保存」到「Agent 用上新提供商」，五个 Agent 都不需要离开 ccset 去查文档
- [ ] README 里「为什么保存后没有切换」这条 FAQ 可以删掉
- [ ] `run` 不写文件；加 `--dry-run` 时只打印将要执行的命令

### P0-2 最强的卖点不在首屏

**现象。** README 的第一句是功能清单：「在同一个终端界面或脚本化 CLI 中，为 Claude Code、opencode、Codex CLI、pi 和 Grok Build 配置第三方 API 提供商。」全文没有出现任何一个竞品的名字。真正的卖点分散在 FAQ 和用户指南「不会对你的文件做的事」一节。

反倒是仓库简介里有全仓库最好的一句定位——*No desktop app, no proxy, no rewritten config*——README 却没有沿用。

**为什么重要。** 这个品类有默认选项。CC Switch 管 12 个工具，带 90+ 预设、本地路由、MCP / Skills / Prompts、会话和用量统计；终端里还有覆盖 7 个工具的 CC-Switch CLI。访客是带着「为什么不用它」来的，十秒内找不到答案就会离开。

**建议。** 首屏只放四样东西：一句定位、几条能点开验证的证据、一张与 CC Switch 的对比表、一段「什么时候不该用 ccset」。完整草稿见《README 改写稿》。

```diff
- 在同一个终端界面或脚本化 CLI 中，为 Claude Code、opencode、Codex CLI、
- pi 和 Grok Build 配置第三方 API 提供商。
+ 给编程 Agent 换 API 提供商，只改你点名的那几个键。
+ 不装桌面应用，不起本地代理，不建自己的数据库。
```

一个提醒：**「保留注释和自定义键」不能再当头条。** CC Switch 的 README 现在也写明只替换关键字段、保留注释和格式。把它降级为证据，去支撑「没有第二份事实来源」这个对手说不了的主张。

**验收标准。**

- [ ] 不滚动就能看到：定位句、安装命令、与 CC Switch 的区别
- [ ] 首屏每条主张都链接到一份证据（verify 脚本、ADR 或用户指南的对应小节）

### P0-3 命令叫 ccset，但 npx ccset 不是你

**现象。** GitHub 是 `Right202209/ccset`，npm 是 `@droite/ccset`，命令是 `ccset`。三个名字里，只有 scope `droite` 在别处从未出现过，而它恰好是安装命令里必须敲对的那一段。

我查询了 npm 注册表：无 scope 的 `ccset` 返回 404，**目前没有人注册**。PRD §9.2 也记录过这个名字空闲。

**为什么重要。** 用户记住的是命令名，迟早有人会敲 `npx ccset`。这个名字一直空着，就意味着任何人都可以注册它——然后收到本该交给你的 API 密钥。对一个以「可信」立足的工具，这是最不该留的口子。

**建议。**

1. **现在就注册无 scope 的 `ccset`。** 哪怕只发布一个转发到 `@droite/ccset` 的薄包。之后再决定要不要把 `npx ccset` 作为官方入口。
2. README 的安装命令下面加两行「如何确认来源」：包由本仓库的 CI 发布；npm 包页面的 Provenance 一栏会指向构建它的提交。
3. 仓库 About 里的主页链接现在是 `http://`，改成 `https://`。

```diff
- npx @droite/ccset
+ npx ccset
```

**验收标准。**

- [ ] `npm view ccset` 显示的维护者是你
- [ ] 安装命令里出现的每个名字，都能在仓库首页找到出处

## P1 核心体验

### P1-1 不追 90+ 预设，让服务商替你维护

**现象。** 添加提供商要手动填 ID、API 地址、凭据和模型名。CC Switch 有 90+ 预设和 `ccswitch://` 一键导入链接。

**为什么重要。** 手敲 base URL 是最容易出错的一步，而消灭这类错误正是 ccset 的立项理由（PRD §1.1）。但自己维护预设目录是一份永远追不完的清单，也违背 `CONTEXT.md` 里「避免 Provider-specific behavior」的约定。

**建议。** 把维护成本交给最有动力的人——服务商自己。这个品类的分发渠道本来就是服务商：CC-Switch CLI 的 README 里列有 7 家赞助商，多数是 API 中转服务。

今天，服务商想在文档里放一条「密钥不进 shell 历史」的 ccset 命令，得这样写：

```bash
read -rs CCSET_TOKEN && export CCSET_TOKEN   # 粘贴密钥后回车
npx @droite/ccset --agent claude-code provider set myrelay --base-url https://api.example.com
unset CCSET_TOKEN
```

三行，还要求用户懂 shell。建议增加一个**带预填值进入 TUI** 的入口：非密钥字段来自命令行，密钥在遮罩输入框里手输，照常经过审阅界面再保存。

```diff
- read -rs CCSET_TOKEN && export CCSET_TOKEN
- npx @droite/ccset --agent claude-code provider set myrelay --base-url https://api.example.com
- unset CCSET_TOKEN
+ npx @droite/ccset --agent claude-code provider add myrelay --base-url https://api.example.com
```

这就是 ccset 版的「一键导入」：一行可以贴进任何服务商文档的命令，而且不破坏现有的任何一条安全约定。配套写一页《给服务商的接入说明》。

**验收标准。**

- [ ] 预填入口不接受任何形式的密钥参数；审阅界面显示完整的目标主机名
- [ ] 至少一家服务商的官方文档里出现这行命令

### P1-2 脚本能「加」，不能「删」

**现象。** 非交互命令只有 `status`、`global set`、`provider set`、`provider use`、`state init`。删除提供商和清除备份只在 TUI 里——里程碑 3 的设计文档明确把它们排除在外，理由是「需要单独的安全契约」（ADR 0007）。

**为什么重要。** 密钥轮换是脚本用户最常见的场景，而它恰好走不通：`provider set` 写入新密钥之后，旧密钥仍以明文留在最多十份备份里，而「清除 ccset 备份」只能进 TUI 的状态页去点。README 说「适合脚本与 CI」，但生命周期只覆盖了前半段。

**建议。** 把 ADR 0007 所说的那份安全契约写出来，然后放行：

```diff
  ccset --agent codex provider set relay --base-url https://api.example.com
  ccset --agent codex provider use relay
+ ccset --agent codex provider delete relay --yes   # 先备份；正被路由使用时拒绝
+ ccset --agent codex backup clear --yes            # 轮换密钥后清掉旧副本
```

契约建议：必须显式 `--yes`；支持 `--dry-run`；输出每个受影响的路径；`model_provider` 指向该提供商时拒绝删除（TUI 已有这条规则）。

**验收标准。**

- [ ] 「新增 → 启用 → 轮换密钥 → 清除旧备份 → 删除」可以全程不进 TUI
- [ ] 破坏性命令缺少 `--yes` 时以用法错误（64）退出，不做任何读写

### P1-3 「测试连接」只有 Claude Code 有

**现象。** 其余四个 Agent 没有连接测试。文档给出的理由很诚实：ccset 内置的探测是 Anthropic 形态，对其他协议「没有如实探测的办法」。

**为什么重要。** 「保存成功但连不上」是这类工具最高频的求助。五个 Agent 里有四个的用户，出问题时得不到任何帮助。

**建议。** 原则不用改，改适用范围：**协议在配置里写明了的，就可以如实探测。**

| Agent | 协议是否已知 | 建议 |
| --- | --- | --- |
| Codex CLI | 是，固定为 `wire_api = "responses"` | 增加 Responses 形态的探测 |
| Grok Build | 是，`api_backend` 三选一 | 按声明的后端探测 |
| pi | ⚠ 取决于配置块是否声明了 API 类型 | 声明了就探测，否则说明原因 |
| opencode | 否，取决于 SDK 包 | 维持现状，继续如实说明 |

所有探测沿用现有约束：发送前显示目标主机并确认，拒绝重定向，丢弃响应体。

**验收标准。**

- [ ] 协议已知的 Agent 都有连接测试；协议未知的，在同一个位置说明为什么没有

### P1-4 密钥明文落盘，备份又把它放大十倍

**现象。** 配置文件和备份都可能含明文凭据，每个文件最多保留十份备份。PRD 里的 `apiKeyHelper` 方案卡在一个没做完的实验上（§9.3 第 1 项）。但有两个 Agent 已经原生支持「文件里不放密钥」：pi 的 `apiKey` 接受 `$ENV_VAR` 和 `!command`；Grok Build 有 `env_key`，目前标为不受管理、需要手工设置。

**为什么重要。** 「配置只在本地」是 ccset 的信任基础，明文多副本是它最容易被质疑的地方。

**建议。**

1. 表单里把「凭据来源」做成一等选项：*直接保存* 或 *引用环境变量*，只在该 Agent 原生支持时出现。pi 和 Grok Build 可以先做。
2. 密钥变更保存成功后，就地询问「是否清除含旧密钥的备份」，而不是指望用户记得去状态页。
3. `apiKeyHelper` 的实验需要一个第三方凭据——在 README 里公开求助。这是很合适的第一个社区贡献点。

**验收标准。**

- [ ] 在支持引用的 Agent 上，用户可以全程不让密钥明文进入 ccset 写的任何文件
- [ ] 轮换密钥后，经用户确认，旧密钥的残留副本数为 0

## P2 项目卫生与增长

### P2-1 根目录在对访客讲另一个故事

**现象。** 根目录放着 `Important Documentation.md`（212 KB）、`PRD.md`、`Remediation-Guide.md`、`code-review.md`（与 `.claude/rules/code-review.md` 是同一份内容）。PRD 自称 v2，新旧内容并存：定位一节仍写「聚焦 Claude Code」，非目标里还列着「不做启用」「不做非交互配置」，§6.5 写着「不引入自己的配置文件」——而产品现在支持 5 个 Agent，有完整的 CLI，有 `provider use`，也有 `~/.ccset/settings.json`。

**为什么重要。** 想贡献的人第一件事是读根目录。PRD 和 README 互相矛盾，外人无从判断哪个是真的。

**建议。**

```diff
  ccset/
    README.md  README.zh-CN.md  LICENSE
    CONTRIBUTING.md  SECURITY.md  SUPPORT.md
+   CHANGELOG.md
-   PRD.md
-   Important Documentation.md
-   Remediation-Guide.md
-   code-review.md
    docs/
+     vision.md                    # 一页纸：定位、非目标、当前里程碑
+     history/prd-v2.md            # 标注「历史文档，不再维护」
+     history/verification-log.md  # 原 Important Documentation.md
```

搬动时记得同步 README、`AGENTS.md` 和验证指南里指向这些文件的链接。

**验收标准。**

- [ ] 根目录只剩社区标准文件和给编码助手看的约定文件
- [ ] 有一份不超过一页、与当前产品一致的定位文档

### P2-2 只支持最新版，却没有更新日志

**现象。** 支持政策是只维护 npm 上的最新版本；根目录没有 `CHANGELOG.md`。

**为什么重要。** 要求用户始终升级，就得让他们一眼看到升级改了什么——尤其是一个会写配置文件的工具。

**建议。** 新增 `CHANGELOG.md`，每个版本把「会改变写入行为的变更」单独列出。如果 GitHub Releases 已经在维护，README 直接链接过去即可。

**验收标准。**

- [ ] 从 README 一次点击，可以看到最近三个版本的变更

### P2-3 社区没有入口

**现象。** Discussions 没有开启；Issue 模板只有安全报告一种；当前没有 open 的 issue；2 个 star，0 个 fork。

**为什么重要。** 仓库里已经有一份质量很高的《添加 Agent》指南，却没有任何地方告诉外人「我们欢迎谁来加哪一个」。

**建议。**

1. 增加三个 Issue 模板：缺陷、功能建议、**Agent 接入请求**
2. 预置 6–8 个带 `good first issue` 或 `help wanted` 标签的 issue，草稿见《路线图》
3. 开启 Discussions，或者在 README 里明确写「提问请开 issue」

### P2-4 缺席的 Gemini CLI 需要一个公开的解释

**现象。** 两个主要对手都支持 Gemini CLI，ccset 不支持。原因写在 PRD 的里程碑备注里：评估过并否决，因为它的设置结构里没有第三方端点的概念。

**建议。** ⚠ 先重新核实这个结论是否仍然成立。成立，就写进 README 的 FAQ——「做不到如实配置，所以不接」本身就是定位的一部分。不成立，它就是下一个该接的 Agent。

### P2-5 Windows：用「已验证环境」替换「尽力支持」

**现象。** Windows 是尽力支持，原生交互行为「尚未验证」。

**为什么重要。** ⚠ 这是假设：国内使用第三方中转服务的开发者里，Windows 占比不低，而 CC Switch 原生覆盖 Windows。「尽力支持」四个字会直接劝退这部分人。

**建议。** 不必承诺全面支持。`CONTEXT.md` 已经定义了「已验证环境」这个概念——在 Windows Terminal + PowerShell 上把核心流程完整走一遍，把结果作为一行具体的环境组合写进 README。一条验证过的事实，比一句笼统的免责声明更有说服力。

## 不要做的事

| 不做 | 理由 |
| --- | --- |
| 本地代理、路由、协议转换、故障转移 | 这是 CC Switch 和 Claude Code Router 的主场，也直接违背「不起代理」 |
| MCP / Skills / Prompts / 会话 / 用量管理 | 每加一项，可审计的范围就大一圈 |
| 桌面 GUI、系统托盘 | 定位就是「不需要桌面」 |
| 自有数据库或提供商索引 | 无状态是最难被抄走的优势 |
| 追 Agent 数量 | 新 Agent 只通过社区 PR 进来，核心不主动铺 |
| 遥测 | 与「配置只在本地」的承诺冲突，用公开指标代替 |
| 自己维护预设目录 | 让服务商来维护，见 P1-1 |

## 资料来源

- ccset：[README](https://github.com/Right202209/ccset/blob/master/README.zh-CN.md)、[用户指南](https://github.com/Right202209/ccset/blob/master/docs/user-guide.md)、[PRD.md](https://github.com/Right202209/ccset/blob/master/PRD.md)、[CONTEXT.md](https://github.com/Right202209/ccset/blob/master/CONTEXT.md)、[里程碑 3 设计](https://github.com/Right202209/ccset/blob/master/docs/milestone-3-non-interactive.md)
- npm：[@droite/ccset](https://www.npmjs.com/package/@droite/ccset)
- CC Switch：[farion1231/cc-switch](https://github.com/farion1231/cc-switch)
- CC-Switch CLI：[SaladDay/cc-switch-cli](https://github.com/SaladDay/cc-switch-cli)
