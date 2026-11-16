# 添加新 Agent：编码助手 SOP

适用于完整接入任务。通用规则以 [AGENTS.md](../../AGENTS.md) 为准，机制以[接入指南](../zh-CN/adding-an-agent.zh-CN.md)为准；本文只规定执行顺序和可审查产出。

| 步骤 | 行动 | 产出 |
| --- | --- | --- |
| 1 范围 | 查看 git status、需求／评论、术语／ADR；确认用户路径与可用验证环境 | 目标 Agent／版本、TUI／CLI 操作、托管范围、验证范围 |
| 2 追溯 | 查上游官方 schema／源码／测试，核实路径、格式／优先级、凭据与生效 | 来源／版本和逐字段契约；未证实假设记登记册 §1 |
| 3 划界 | 选择结构相似模块；列明共享能力扩展 | 文件职责表、回归范围；复用时 runtime 限模块＋registry |
| 4 实现 | 路径／manifest → read/seed/emit → save → status/actions → commands → 静态注册 | 完整配置路径，随行为扩展 public-boundary 断言 |
| 5 证明 | 临时 home 测保留／删除／凭据／备份／恢复／双语；主动变异使安全断言失败，再恢复 | 聚焦 fixture 的 red／green 证据、屏幕键遍历 |
| 6 交付 | 按验证指南顺序跑检查，更新双语文档、查看最终 diff | 实际命令／结果／限制、登记册追加运行时证据 |

字段契约至少包括：字段 ID、文件／叶子路径、磁盘类型／边界、TUI 播种／留空、CLI 选项／省略／unset、是否含凭据。模型集合还需说明保留成员的元数据规则。

可参考 [claude-code](../../src/agents/claude-code/) 的分文件、[opencode](../../src/agents/opencode/) 的 JSONC／模型 map、[codex](../../src/agents/codex/) 的 auth／路由、[pi](../../src/agents/pi/) 的双文件／模型数组、[grok-build](../../src/agents/grok-build/) 的 TOML／内置覆盖。认证规则必须由目标上游证据支持。

fixture 接入 verify:*、顺序 npm test 和[验证映射](../verification.md#fixture-map)。合成文件不是 live／跨平台证据；不执行 Agent 作检测，不写真实 home。共享接口冲突要说明，不在 parser／UI 加 Agent 分支；完整提案无需前置 issue。
