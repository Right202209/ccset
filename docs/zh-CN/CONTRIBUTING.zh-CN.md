# 参与 ccset 贡献

[English](../../CONTRIBUTING.md) | 简体中文

欢迎缺陷修复、文档、测试和完整产品提案。PR 可以同时是提案与实现，前置 issue 可选。提交不产生接纳义务；除非明确委托，产品范围、合并和 npm 发布由维护者决定。

## 处理一个改动

遵循 [AGENTS.md](../../AGENTS.md) 和[按范围选择的验证](verification.zh-CN.md)。网站使用[独立 SOP](../../pages/README.md)。

## Pull request

使用[模板](../../.github/PULL_REQUEST_TEMPLATE.md)，说明用户问题、完整结果路径、范围／维护成本、实际检查与待验证证据。同步覆盖该行为的中英文文档；重要 TUI 改动附终端截图，可见网站改动附桌面／移动截图；行为变化附可重复人工场景。

[评审规则](../agents/code-review.md) 按数据丢失／凭据风险分级，未解决的 Blocker／High 阻止合并。欢迎草稿提案，只有完整且通过验证的改动才可合并。

## 新 Agent

接入必须面向具体用户场景，有可重复的格式／行为检查，复用核心安全且不恶化启动／交互。不打包目标 Agent，不为检测／配置执行它；显式会话启动属于独立能力。

交付模块、registry、fixture、双语文档和人工场景，见[接入机制](adding-an-agent.zh-CN.md)。明确共享核心扩展及回归范围。持续证据有限时可标为 experimental；合并不产生永久支持或贡献者终身维护义务。

具名 Provider 的运行时分支需要通用能力或广泛需求证据。预设是公共数据，遵守[中立贡献规则](../../presets/README.md)。

## 验证

使用[验证指南](verification.zh-CN.md)，不复制命令清单。运行时／工具链合并前需本地或 CI 完整套件证据，fixture 顺序运行。回归断言必须在撤销修复后失败；平台特定改动需要该平台证据。

新运行时结果追加到[登记册 §9](<../../Important Documentation.md#9-implementation-register-code-complete>)，保留旧条目。纯文档检查写入交接／PR；发布门槛仍在 §6。

## 许可证

贡献使用项目 MIT 许可证；确认你有权提交。不要求 CLA 或 DCO 签署。
