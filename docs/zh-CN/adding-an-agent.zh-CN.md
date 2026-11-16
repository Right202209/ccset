# 添加 Agent

[English](../adding-an-agent.md) | 简体中文

先满足[贡献标准](CONTRIBUTING.zh-CN.md#新-agent)，阅读[术语](CONTEXT.zh-CN.md)、[架构](architecture.zh-CN.md)、[命令契约](milestone-3-non-interactive.zh-CN.md)。[编码助手 SOP](../agents/add-agent-workflow.md) 定义执行顺序。

## 交付内容

Agent 读取本地配置，返回 form／list／status／confirm／message 形态的 `ActionResult`，映射提交值为托管写入；View 渲染数据，模块不导入 `src/ui/`。

编码前记录上游来源／版本、路径／优先级、格式、托管叶子／类型、删除语义、ID、凭据优先级、生效时机、检测与验证限制。其他 Agent 仅作结构参考，不能证明新 Agent 的策略。

## 扩展边界

复用能力时运行时只改 `src/agents/<id>/` 和 `src/registry.ts`；fixture、npm 脚本、文档也是交付。新 Codec／Screen／operation 属共享接口扩展，要说明职责与已有 Agent 回归范围；前置 issue 仍可选。

## 模块布局

按职责拆分，不限定文件数量。

| 文件 | 职责 |
| --- | --- |
| index.ts | 身份、消息、检测、动作、可选 commands |
| paths.ts／constants.ts | 路径／覆盖、初值／边界／协议 |
| manifest.ts | 托管字段声明与映射 |
| global.ts／providers.ts | read／seed／emit／save、Provider 发现 |
| status.ts／status-dto.ts | 只读状态、显式安全投影 |
| actions.ts／messages.ts | Screen 组合与双语目录 |
| commands.ts | Agent 自有字段声明与结构化 handler |

Codex 分离 profile／激活／路由恢复；借鉴职责，不复制认证策略。

## 易错点

- **删除**：ManagedWrite 的 undefined 删除；TUI 空／Unmanaged 按契约省略，false 保持布尔。复用值转换；CLI 省略保留，unset 用声明 ID。
- **新鲜度**：每次表单进入重读，包括持续打开 Screen 的 Edit；保存再重读。托管字段仍可能覆盖外部同字段变更，不能声称有锁／CAS。
- **叶子／集合**：写 options.baseURL／apiKey，不替换 options；留下的模型 ID 保留元数据，仅增删选定成员。
- **安全**：复用 plan／apply、备份／原子／create-only／删除；备份用 backupsDirFor(configDir) 防止跨 Agent 清理。显式恢复留损坏原文，命令先 preflight 后写。
- **凭据**：明确上游优先级；DTO 不导出任意 model／header 对象或 URL 凭据成分。保留磁盘数据不代表可以打印。
- **字符串**：独立 Agent namespace，messages.ts 同供 en／zh-Hans，复用 shell 键；registry 拒绝重复。detailKey／activateKey 提供专属说明。
- **检测**：仅轻量本地文件／目录，不执行、不请求；覆盖规则确保临时 home 隔离。
- **限制**：不支持 store／format／activation 明确诊断与文档；真实兼容假设写入[登记册 §1](<../../Important Documentation.md#1-blocking-unknowns>)。

## 非交互命令

AgentCommands 的字段／handler 属模块；磁盘播种不带 TUI 默认值，校验最终结果并复用 executeOperation／commit。禁止 Screen 回调式脚本或共享 parser／UI 的 Agent-ID 分支。显式说明支持命令，不能推断界面或 Agent 功能一致。

## 注册

[registry.ts](../../src/registry.ts) 静态导入并加入列表，不扫描路径动态导入，bundle 无法解析。更新枚举 Agent 的检测／选择／命令／语言 fixture。

## 证明验证有效

独立 mkdtemp home、占位凭据；fixture 同接 verify:* 与顺序 npm test，再登记[验证范围](verification.zh-CN.md#fixture-对照)。至少断言：

- 最深托管层保留兄弟键，保留模型成员留元数据；
- 空／unset 删除、CLI 省略保留、布尔类型正确；
- 保存及每次 Edit 看到当前磁盘；
- 每 basename 备份轮换、损坏原文保留、POSIX 权限、no-op／dry-run 零写入；
- 输出不泄露密钥／控制序列，含间接元数据／错误；
- 损坏／部分失败报告文件、回滚、重试行为；
- 两语言可达 Screen 的 labelKey／helpKey／detailKey／choice 全解析。

消息检查先导入 src/registry.js；遍历只读 run，不为查看 Screen 提交／确认写入。主动变异保留／删除路径，使断言失败，再恢复并重跑。其他检查见[验证指南](verification.zh-CN.md)，实际环境／结果追加登记册 §9。

## 新 Codec

优先复用 JSON／JSONC／TOML。新增需产出 JsonObject 的 reader、严格写许可检查、ManagedWrite 编辑器、类型化 ConfigParseError，提交前重查生成语法。

有注释格式的 parse 后重序列化会丢原文。语料须证明空写入字节一致、托管编辑之外字节保留，并覆盖损坏、scalar parent 插入、inline、删除、深度边界、prototype 敏感自有键。Python tomllib 一致性不含 ccset 的刻意 TOML 扩展，不为错误 oracle 删除它们。
