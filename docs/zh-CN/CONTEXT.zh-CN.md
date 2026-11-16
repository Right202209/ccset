# ccset

[English](../../CONTEXT.md) | 简体中文

本地编程 Agent 配置工具的术语。运行时规则见[架构](architecture.zh-CN.md)，维护承诺见[支持政策](SUPPORT.zh-CN.md)。

## 用语

### 配置

**Core user（核心用户）**：
为编程 Agent 配置第三方 API 的个人开发者。
_避免_：企业管理员

**Agent**：
ccset 管理其配置的编程工具。
_避免_：Provider

**Provider（提供商）**：
以某个 Agent 的本地配置表示的第三方 API 服务。
_避免_：Agent、模型

**Provider ID**：
用户为一个 Agent 内的 Provider 选择的标识符。
_避免_：Provider 名称、profile 名称

**Preset（预设）**：
经审查的公共端点、协议与模型初值，不含凭据或真实服务验证承诺。
_避免_：Provider 账户、已认证服务

**Managed key（托管键）**：
ccset 负责的配置叶子，其他键为非托管键。
_避免_：已知键、整个配置

**Managed patch（托管补丁）**：
仅改变显式提供的托管键及显式删除项的提案。
_避免_：完整配置、替换

**Codec**：
某种 Agent 配置格式的读写策略，包括非托管文本的保留方式。
_避免_：parser、serializer

**Auth profile（凭据档案）**：
供以后激活的已保存凭据，区别于 Agent 当前使用的凭据。
_避免_：live auth、账户

**Activation timing（生效时机）**：
Provider 选择生效的下次启动或指定会话。
_避免_：热切换、立即生效

**Settings file（偏好文件）**：
ccset 自有的语言与忽略 Provider 偏好，独立于 Agent 配置。
_避免_：Agent 配置、备份

**Ignored provider（已忽略提供商）**：
从 ccset 常规界面隐藏、但 Agent 配置仍存在的 Provider。
_避免_：已禁用、已删除

### 界面

**Non-interactive command（非交互命令）**：
无需 Screen 或提示即可完成、状态变更选择均显式提供的脚本操作。
_避免_：脚本化 Screen、无界面 TUI

**Secret source（密钥来源）**：
脚本调用中显式选择的 Provider 凭据输入通道。
_避免_：token 参数、位置参数密钥

**Screen**：
描述表单、列表、状态、确认或消息的 Action-result 数据，由 View 渲染。
_避免_：View、网页

**Frame**：
一个 Screen 在导航栈中的位置。
_避免_：Rendered paint

**Rendered paint（终端绘制）**：
一次终端绘制，与导航 Frame 不同。
_避免_：Frame、截图

**Viewport（视口）**：
TUI 内窗口区域的行列预算。
_避免_：全屏、应用高度

**Panel（面板）**：
包含 View 或 Agent 上下文的带边框布局区域。
_避免_：Screen、Frame

**Glance（概览）**：
由 Agent 只读状态产生的简要配置与诊断。
_避免_：Status Screen

**Preview（预览）**：
由列表已加载记录产生、针对焦点行的临时详情。
_避免_：选择结果、详情 Screen

**Terminal capability（终端能力）**：
当前终端可用的字形与颜色集合。
_避免_：语言偏好、主题

**Locale preference（语言偏好）**：
显式选择的界面消息目录。
_避免_：推断的终端语言

### 维护

**Verified environment（已验证环境）**：
成功检查记录中的具体 Agent／Node／OS／终端／shell 组合。
_避免_：兼容承诺

**Supported platform（支持平台）**：
其故障与必要检查可阻止发布的平台。
_避免_：尽力支持平台

**Best-effort platform（尽力支持平台）**：
不刻意排除、但不要求阻止一般发布的平台。
_避免_：支持平台

**Implementation proposal（实现提案）**：
通过实现提出范围变化、不预设接纳的 PR。
_避免_：已批准功能

**Provider-specific behavior（具名提供商行为）**：
针对某个 Provider 而非通用配置能力的逻辑。
_避免_：Agent 接入

**Experimental integration（实验性接入）**：
有用户场景但持续验证不足、可能修改或移除的接入。
_避免_：永久接入

**Release blocker（发布阻塞项）**：
已知数据丢失、凭据暴露、启动或强制发布检查失败。
_避免_：普通缺陷

**Core flow（核心流程）**：
从启动到读取、审查、安全保存和生效指令的用户路径。
_避免_：所有菜单动作
