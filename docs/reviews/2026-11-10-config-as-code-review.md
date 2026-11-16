# 2026-11-10 Config-as-code 评审：历史结论

基于 v0.10.0 文档的案头评审，未安装试用／访谈；原始过程和配置草稿留在 git。主张面向 SSH／容器／CI 的声明式配置，但需求规模未验证，不能作为现有能力宣传。

维护者选择先做可审计切换，见[项目决策](../zh-CN/project-plan.zh-CN.md#决策)：脚本生命周期／备份清理先于引用，diff 与引用发布后、外部用户提出需求才启动声明式输入。当前没有 doctor、plan、apply、token-env 或配置 payload 接口。

| 历史结论 | 当前状态 |
| --- | --- |
| P0 动词／生效方式不一致 | use 覆盖五 Agent，Claude run 已落地；不热切已有会话 |
| P1 首次输入与脚本闭环 | 预设已落地；破坏性命令、备份恢复、额外协议探测仍为提案 |
| P2 凭据／路径／术语／文档 | 现行指南说明真实路径／优先级／限制；CODEX_HOME 的特殊政策保持 |
| 声明式输入会形成第二份配置事实 | 必须先明确用户输入归属、secret resolution、preflight、partial failure |

保留风险：diff 邻近非托管密钥会泄露；文件写对不证明 live API；多个上游格式带来持续验证成本。重复路线／文案收敛到[后续契约](../zh-CN/product-review-follow-up.zh-CN.md)。Star／下载量／竞品数量不再作为当前事实。参考 [CC Switch](https://github.com/farion1231/cc-switch)、[CC-Switch CLI](https://github.com/SaladDay/cc-switch-cli)；需重新验证才可比较。
