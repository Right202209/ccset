# 项目计划

[English](../project-plan.md) | 简体中文

维护者方向，不是发布日期或命令参考。[PRD](../../PRD.md) 记已实现范围，[后续契约](product-review-follow-up.zh-CN.md) 记未实现工作；源码／fixture 优先于带日期的产品评审。

## 当前基线

五 Agent use、位置／环境选择器、离线预设、显式 Claude run 已由 ceffd80 落地；TUI 删除／忽略见 831680d。每次 Edit 重读与删除导航见 3fdbce1／8e1fe11。主包 0.11.1 发布证据记于 2026-11-13 的[登记册 §9.78](<../../Important Documentation.md#978-v0111-published-forwarder-pinned-to-it-the-route-for-the-unscoped-name-2026-11-13>)。

转发源码精确依赖主包；2026-11-13 最近 registry 检查仍为无作用域 ccset 未注册。注册／trusted publisher 仍需外部步骤，不是新可用性声明；确认前用 @droite/ccset。

dry-run 只报告意图／目标，不显示遮蔽逐行 diff；无声明式 plan／apply、脚本删除／备份清理、通用 doctor 或 restore 命令。旧 Phase 0 未发布阻塞和一次性 checkout 杂务不再是操作指南。

## 定位

方向是**可审计的提供商切换工具**：本地托管编辑、公开 fixture／决策、显式拒绝、产物来源证明。不能据此声称逐行 diff 已有或 ccset 不存偏好／profile。[用户指南](user-guide.zh-CN.md#agent-配置)列实际路径与限制。

面向终端／远程开发者和直接维护 Agent 文件的人。SSH／容器／CI 需求仍是假设，需通过 recipe／外部请求验证；不按 Agent／预设数量竞争，不发布未经核实竞品数字。

## 交付顺序

| 顺序 | 可审查结果 | 门槛／证据 |
| --- | --- | --- |
| 安全 | 关闭[输出／并发／凭据／恢复缺口](../../review.md) | 失败复现与 public-boundary 回归 |
| 展示改动 | dry-run／TUI 共用遮蔽 diff，精简写入／拒绝证据 | 先定脱敏再编码；相邻非托管密钥 fixture、零写入预览 |
| 脚本生命周期 | Provider 检查／删除、备份清理、轮换后可选清理 | 显式破坏性契约／ADR、dry-run、活动路由／部分失败 |
| 凭据引用 | Agent 原生 literal／reference 与优先级契约 | 支持形态文件／备份无密钥字节；不支持形态先拒绝 |
| 可独立改进 | 协议探测、已发布命令 recipe、任意端点引导、备份恢复设计 | 范围明确、隔离 mock／任务证据，live 另记 |
| 门槛提案 | 声明式输入、额外分发、更多 Agent、Provider 文档推广 | 满足下表，不承诺日程 |

diff 上下文可能泄露其他 Provider 密钥或自定义 Authorization；脱敏需覆盖非托管邻居，不能只遮托管字段。清备份不等于轮换远程密钥或删除其他副本。

## 门槛提案

| 提案 | 开始条件 |
| --- | --- |
| 用户自有声明式输入／plan／apply | diff 与引用已发布，外部用户提出多机器／CI 需求，ADR 明确输入归属／部分失败 |
| 单一二进制／Homebrew | 有无需 Node 的用户需求，供应链／更新／平台计划齐备 |
| 新 Agent（含 Gemini CLI） | 具体需求、公开可写端点／认证契约、完整接入提案与可重复证据 |
| Provider 接入文档推广 | 任意端点入口已发布且 recipe 已验证；外部消息需显式授权 |
| 原生 Windows 已验证声明 | 真实 Windows Terminal／PowerShell 核心流程记录，不能只靠 CI smoke |

## 决策

维护者 2026-11-10 决策及 2026-11-13 发布／引导更新。变更需明确记录，不能从旧草稿推断新政策。

| ID | 决策 |
| --- | --- |
| D1 | 当前定位可审计，config-as-code 保持门槛 |
| D2 | README／预设不收赞助、返利链接、付费排名，贡献使用同一公共数据标准 |
| D3 | 保留无作用域名称作精确依赖转发；首次注册由维护者，后续独立标签／trusted publishing |
| D4 | 脚本生命周期／备份清理先于凭据引用，声明式 apply 有门槛 |
| D5 | docs/reviews 保留带日期结论，原始叙述在 git；数字引用前重查一手来源 |
| D6 | ADR 0012 保持：CODEX_HOME 提示、不跟随；CLI 拒绝不匹配，TUI 当前警告 |
| D7 | Important Documentation.md 留根目录作精简指南和可更新证据索引；摘要遵循 Trace → Distill → Prune，原始证据固定保存在 Git 中（[ADR 0021](../adr/0021-keep-the-active-register-concise-and-pin-historical-evidence.md)） |

## 信号与限制

无 telemetry，观察外部 issue／PR、已测 Provider recipe、远程／CI 需求；旧 star／下载量不作当前基线。五上游格式与单维护者使已验证范围比功能数量更重要，[支持政策](SUPPORT.zh-CN.md)定义承诺。

## 历史来源

[切换器评审](../reviews/2026-11-10-switcher-review.md)强调可见编辑／拒绝契约，[config-as-code 评审](../reviews/2026-11-10-config-as-code-review.md)提议声明式流程。二者均非安装试用或需求研究；重复路线／文案收敛到本文与后续契约。真实发布证据保留在[登记册 §9](<../../Important Documentation.md#9-implementation-register-code-complete>)。
