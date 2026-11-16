# Provider presets

Reviewed public data, bundled offline: no keys, downloads, or executable content. Inspect with `ccset presets list [search] --json`. Model suggestions are starting values, not live-compatibility claims. No sponsors, affiliate links, or paid placement; all contributions use the same criteria ([product decisions](../docs/project-plan.md#decisions)).

## Contribution SOP

1. Verify endpoint paths, protocols/SDKs, model IDs and credential precedence against current primary sources; include only supported Agent combinations.
2. Add JSON with `id`, `name`, `sources`, `agents`. Each Agent supplies `protocol` and existing `provider set` `options`; optional `useOptions` suggests selection fields (Codex model belongs to `use --model`).
3. Register the static import in [preset-catalog.ts](../src/commands/preset-catalog.ts). Never include credentials, shell commands, arbitrary paths or Provider-specific runtime branches.
4. Run root typecheck, `verify:short-commands`, `verify:code-gates`; shared command changes also need `npm test`.

The fixture saves every Agent/preset combination with placeholder keys into scratch homes, checking dry-run, idempotence, modes and output. It does not contact Providers. OpenRouter's Claude guide requires clearing conflicting `ANTHROPIC_API_KEY`; preserving unmanaged config means ccset cannot silently resolve that credential conflict.

## 中文

预设是随包离线发布的公共数据，不含密钥、下载或可执行内容。`ccset presets list [搜索词] --json` 查看。模型是初值建议，不是兼容性认证。不接受赞助、推广返利链接或付费排名，贡献使用相同标准，见[产品决策](../docs/zh-CN/project-plan.zh-CN.md#决策)。

1. 从当前一手来源核对端点、协议／SDK、模型与凭据优先级，只列支持的 Agent 组合。
2. JSON 包含 `id`、`name`、`sources`、`agents`；Agent 项使用 `protocol`、已有 `provider set` 的 `options`，可选 `useOptions` 建议选择字段（Codex 模型属于 `use --model`）。
3. 静态登记到 `preset-catalog.ts`；禁止密钥、shell 命令、任意路径、具名 Provider 运行时分支。
4. 运行根目录 typecheck、`verify:short-commands`、`verify:code-gates`；共享命令改动另需 `npm test`。

fixture 用占位密钥和临时 home 遍历所有组合，检查 dry-run／幂等／权限／输出，不联系 Provider。OpenRouter 的 Claude 指南要求清除冲突的 `ANTHROPIC_API_KEY`；保留非托管配置意味着 ccset 不能静默消除此凭据冲突。
