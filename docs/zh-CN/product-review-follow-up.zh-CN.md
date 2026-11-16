# 产品后续契约

[English](../product-review-follow-up.md) | 简体中文

以下为未实现提案，不是可用命令或日程。P0 01–04（选择器、短命令、预设、use／run）已落地；[产品决策](project-plan.zh-CN.md#决策)定义剩余顺序。当前操作／选项见[命令契约](milestone-3-non-interactive.zh-CN.md)。

| ID | 待明确依赖／契约 | 接受证据 |
| --- | --- | --- |
| F-05 声明式 apply | diff／引用已发布＋外部多机器／CI 请求；用户自有输入、密钥解析、Agent patch、全目标 preflight、部分失败 | 多 Agent fan-out、dry-run 零创建、末目标损坏阻止全部写入 |
| F-06 协议探测 | 主机确认、timeout／auth／协议分类、无跳转／响应体；opencode SDK 需明确映射 | 隔离 mock 失败／跳转、无 body／secret；live 另记 |
| F-07 备份生命周期 | 脚本清理／明确同意、轮换后可选清理、过期保留预期恢复证据 | 选择／dry-run、拒绝／部分删除、占位轮换／回滚 |
| F-08 脚本生命周期 | 检查／删除／忽略可见性、破坏性同意、活动路由、整文件／块；扩展 ADR 0007／0019 | add → inspect → use → delete → cleanup，拒绝不安全删除，仅凭据存在性 |
| F-09 凭据引用 | literal／reference、来源冲突、unset／缺变量、原生优先级；统一 Codex／Grok 策略 | 支持形态无密钥字节往返，不支持先拒绝，不能激活旧 inline 凭据 |
| F-10 Agent 接入 | 需求、上游可写端点／认证、完整提案，不强制前置 issue | 源码契约、可重复 fixture／人工，不追竞品数量 |
| F-11 分发 | registry 归属／发布证据，二进制／Homebrew 供应链／更新／平台 | tarball 安装、registry 依赖、原生 Windows 声明前真实交互 |
| F-12 Recipes | 已发布预设／命令，refs／apply 等实现后再用，上游 run 也需隔离 | 执行 SSH／devcontainer／CI，外部信号注明来源 |
| F-13 用户任务文档 | 已有动词／生效／路径／拒绝、双语锚点；比较需新一手资料 | 链接／搜索、首次切换 walkthrough；不把草稿当可用命令 |

F-08／F-07 先于 F-09，F-05 等门槛；F-06 可独立，F-12／F-13 跟随发布，F-10／F-11 等证据／权限。实际仍为 TUI 删除／清理、十备份、仅 Claude 探测，直到代码改变。
