# ccset 路线图建议

> **存档说明。** 这是 2026-11-10 收到的产品评审快照，除本说明外原样保留。评审依据的是当时已推送的仓库和 v0.10.0，部分结论已被之后的提交改变；其中的竞品数据和下载量未经本项目独立核实，引用前请重新查证一手来源。维护者据此做出的决定见[项目计划](../zh-CN/project-plan.zh-CN.md)。

顺序的逻辑：**先改说法，再补闭环，最后扩能力**。维护者的人力是最紧的约束（⚠ 推断：npm 上只有一位维护者），所以第一阶段全是不动产品代码的事。编号对应《评审意见》。

## Now：不动产品代码就能做完

| 事项 | 对应 | 完成标志 |
| --- | --- | --- |
| 注册 npm 上无 scope 的 `ccset` | P0-3 | `npm view ccset` 的维护者是你 |
| README 首屏改写，中英两份 | P0-2 | 首屏出现定位句和对比表 |
| GitHub 简介、npm description、Topics 统一 | 定位 | 三处是同一句话 |
| 主页链接改为 `https://` | P0-3 | About 一栏更新 |
| 根目录清理，新增一页 `docs/vision.md` | P2-1 | 根目录不再有 PRD 和过程文档 |
| 新增 `CHANGELOG.md` | P2-2 | README 一次点击可达 |
| Issue 模板 ×3，预置下面的 8 条 issue | P2-3 | Issues 页不再是空的 |
| README 新增「留下什么」「如何确认来源」「为什么没有 Gemini CLI」 | P0-3、P2-4 | 三节上线 |

## Next：把闭环补上

| 事项 | 对应 | 备注 |
| --- | --- | --- |
| `provider use` 覆盖五个 Agent | P0-1 | 先定 Claude Code 上 `use` 的语义 |
| Claude Code 会话级启动 `run` | P0-1 | 需要新 ADR，修订 PRD §2.3 的非目标 |
| CLI 增加 `provider delete`、`backup clear` | P1-2 | 需要新 ADR，补上 ADR 0007 所缺的安全契约 |
| `--dry-run` 输出统一 diff，TUI 加「查看改动」 | 定位 | 做完后重录 README 动图 |
| Codex、Grok Build 的连接测试 | P1-3 | 沿用现有的确认与拒绝重定向约束 |
| 密钥变更后就地询问是否清除旧备份 | P1-4 | 只改交互，不改备份机制 |

## Later：验证了需求再做

| 事项 | 对应 | 先验证什么 |
| --- | --- | --- |
| 带预填值进入 TUI：`provider add … --base-url` | P1-1 | 至少一家服务商愿意把它写进文档 |
| 凭据来源可选「引用环境变量」 | P1-4 | 有用户提出，或 `apiKeyHelper` 实验有了结论 |
| Windows 已验证环境 | P2-5 | 有 Windows 用户报告问题 |
| 重新评估 Gemini CLI | P2-4 | 它的设置结构是否已支持第三方端点 |
| 不含密钥的提供商配方导入、导出 | P1-1 | 预填入口被用起来之后 |

## 怎么判断做对了

不加遥测——它和「配置只在本地」的承诺冲突。用公开可得的信号：

| 信号 | 现在 | 下一个台阶 | 为什么看它 |
| --- | --- | --- | --- |
| 非作者提交的 issue 或 PR | open 的为 0 | 第 1 个 | 最早的真实需求信号 |
| 服务商文档里出现 ccset 命令 | 未知 | 第 1 家 | 分发渠道是否成立 |
| GitHub star | 2 | 看斜率，不看绝对值 | README 改写有没有起效 |
| 「它为什么没按我想的工作」类 FAQ | 1 条：保存后未切换 | 0 条 | 每删掉一条这样的 FAQ，就是修掉一个产品问题 |

## 可直接提交的 Issue 草稿

每条的正文都可以单独复制。

### 1. provider use 覆盖全部五个 Agent

```md
**背景**
`provider use <id>` 目前只有 codex、pi、grok-build 支持。claude-code 和 opencode 调用它会以「该 Agent 不支持此命令」结束，README 为此专门写了一条 FAQ。

**提议**
- 五个 Agent 都接受 `provider use <id>`
- 无法真正切换的 Agent，输出下一步该做什么（例如启动命令），并以 0 退出
- TUI 保存成功后，默认聚焦「启用」

**验收**
- [ ] 五个 Agent 的 `provider use` 都有明确、可预期的结果
- [ ] README 的 FAQ「为什么保存后没有切换」可以删除

**不在范围**
修改 shell rc 文件。
```

### 2. 新增 run：以指定提供商启动 Claude Code

```md
**背景**
Claude Code 的提供商通过 `claude --settings <path>` 生效。用户现在要手抄 ccset 打印的路径。

**提议**
`ccset --agent claude-code run <id> [-- <claude 参数>]`：直接以该提供商启动 Claude Code。不写任何文件，只影响这一个会话。

**验收**
- [ ] 执行前后，`~/.claude/` 下没有任何文件被修改
- [ ] `--dry-run` 只打印将要执行的命令
- [ ] 两个终端可以同时用两个不同的提供商

**需要决定**
PRD §2.3 把 launcher 列为非目标。本 issue 需要一份新 ADR 说明为什么调整。
```

### 3. 非交互命令：provider delete 与 backup clear

```md
**背景**
删除提供商和清除备份只能在 TUI 里做（ADR 0007）。结果是脚本轮换密钥后，旧密钥仍以明文留在备份里，没有办法用命令清除。

**提议**
- `provider delete <id> --yes`
- `backup clear --yes`
- 安全契约：必须显式 `--yes`；支持 `--dry-run`；输出每个受影响的路径；当前路由指向该提供商时拒绝删除

**验收**
- [ ] 缺少 `--yes` 时以用法错误退出，不做任何读写
- [ ] 「新增 → 启用 → 轮换 → 清备份 → 删除」可以全程不进 TUI
```

### 4. --dry-run 输出统一 diff，TUI 增加「查看改动」

```md
**背景**
ccset 最大的优势是「只改点名的键，其余原样保留」，但用户看不见这一点。

**提议**
- `--dry-run` 增加统一 diff 格式的输出，密钥值一律遮罩
- TUI 审阅界面增加「查看改动」，保存前显示将要写入的逐行差异

**验收**
- [ ] 带注释的 TOML 上改一个键，diff 只显示那一行
- [ ] 任何输出里都不出现密钥明文
- [ ] README 动图换成这个流程
```

### 5. Codex 与 Grok Build 的连接测试

```md
**背景**
连接测试目前只有 Claude Code 有，因为内置探测是 Anthropic 形态。但 Codex 固定使用 Responses API，Grok Build 的 `api_backend` 写明了后端类型——协议是已知的。

**提议**
协议在配置里写明了的 Agent，按声明的协议发送一次最小探测。沿用现有约束：发送前显示目标主机并确认，拒绝重定向，丢弃响应体。

**验收**
- [ ] Codex、Grok Build 的菜单里出现「测试连接」
- [ ] opencode 在同一位置说明为什么没有
```

### 6. 带预填值进入 TUI：provider add

```md
**背景**
服务商希望在文档里给用户一行命令。现在的非交互写法需要先用 `read -rs` 导出 `CCSET_TOKEN`，一共三行。

**提议**
`ccset --agent <agent> provider add <id> --base-url <url> [--model <m>]`：打开 TUI，审阅表单已按参数预填，光标停在遮罩的密钥输入框。

**验收**
- [ ] 不接受任何形式的密钥参数
- [ ] 审阅界面显示完整的目标主机名
- [ ] 用户不保存就退出时，磁盘上没有任何变化
```

### 7. 文档：ccset 在本机留下的文件清单

```md
标签：good first issue

**背景**
「没有数据库、卸载后一切照常」是 ccset 的核心主张，但 README 里没有一处把它列清楚。

**提议**
在 README 增加一节，列出 ccset 会创建的全部路径及其内容：ccset 自己的设置文件、各 Agent 的 `backups/ccset/` 目录、Claude Code 的提供商文件、Codex 的凭据档案。请对照 `src/core/paths` 核对是否完整。

**验收**
- [ ] 清单与源码一致
- [ ] 中英文 README 同步
```

### 8. 需要第三方凭据来完成 apiKeyHelper 实验

```md
标签：help wanted

**背景**
PRD §9.3 第 1 项：当 `ANTHROPIC_BASE_URL` 指向第三方端点时，Claude Code 是否会使用 `apiKeyHelper` 的输出，目前未知。这决定了 ccset 能否让密钥不落盘。

**需要的帮助**
如果你有任意一家 Anthropic 兼容第三方服务的凭据，请按下面的步骤做一次请求并回报结果：
1. 在 settings 文件里设置 `apiKeyHelper`，不设置 `ANTHROPIC_AUTH_TOKEN`
2. 用 `claude --settings <path>` 启动，发送一条消息
3. 回报：是否认证成功；Claude Code 版本号

不需要提供密钥或服务商名称。
```

## 风险与取舍

| 决定 | 代价 | 判断 |
| --- | --- | --- |
| 增加 `run` | 推翻 PRD「不做 launcher」 | 值得。会话级启动不改任何文件，比全局切换更贴近原则 |
| CLI 放开删除 | 改变 ADR 0007 的现状 | 值得，但必须先把安全契约写出来 |
| 预填入口 | 别人可以替你填 base URL | 可以接受。密钥不来自命令行，写入前必经审阅界面 |
| 不追预设和 Agent 数量 | 功能对比表上永远落后 | 接受。定位就是不比这个 |
| 不加遥测 | 看不到真实使用数据 | 接受。用公开信号代替 |
