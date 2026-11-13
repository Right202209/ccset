# Provider presets

Presets are reviewed public data, bundled into ccset for offline use. They hold
no keys and are never downloaded or executed at runtime. Use `ccset presets list
[search] --json` to inspect endpoints, model suggestions, and supported Agents.

To contribute, add a JSON file with `id`, `name`, primary-source `sources`, and
an `agents` map. Each entry has a `protocol` and `options` using the Agent's
existing `provider set` option names; `useOptions` can supply a suggested next
command (Codex models belong to `use --model`, not provider saves). Register the
static import in `src/commands/preset-catalog.ts`. Do not add credentials, shell
commands, arbitrary config paths, or Provider-specific runtime branches.

Check endpoint paths, the Agent's protocol/SDK, model IDs, and credential
precedence against current primary documentation. Include only supported
combinations. Model suggestions may age; users can override them. In particular,
OpenRouter's Claude Code guide requires clearing a conflicting
`ANTHROPIC_API_KEY`; ccset preserves unmanaged configuration, so a pre-existing
credential source may still require the user to resolve that conflict.

Run `npm run typecheck`, `npm run verify:short-commands`, and
`npm run verify:code-gates`; shared command changes also require `npm test`.
The preset fixture saves every registered Agent/preset combination with a
placeholder key into an isolated home and checks dry-run, idempotence, file
permissions, and secret-free output. It does not contact a Provider or establish
live compatibility. Record live evidence separately when available.

## 中文

预设是随包发布的公共数据，不包含密钥，不在运行时下载或执行。使用
`ccset presets list [搜索词] --json` 查看端点、模型建议和支持的 Agent。

贡献时新增 JSON，包含 `id`、`name`、一手文档 `sources` 和 `agents` 映射。
每个 Agent 项包含 `protocol` 及已有 `provider set` 选项组成的 `options`；
`useOptions` 用于建议下一条命令，Codex 模型通过 `use --model` 设置。
在 `src/commands/preset-catalog.ts` 静态注册导入。不要加入密钥、shell 命令、
任意配置路径或针对具名供应商的运行时代码分支。

核对官方端点、协议／SDK、模型和凭据优先级，只列出支持的组合。模型建议可能
过时，用户可覆盖。OpenRouter 的 Claude Code 文档要求清空冲突的
`ANTHROPIC_API_KEY`；ccset 保留非托管配置，已有凭据来源冲突仍需用户处理。

运行上方检查；fixture 遍历所有组合，在隔离目录使用占位密钥验证保存、dry-run、
幂等性、权限和输出遮蔽，不发送真实请求。真实兼容性证据需要另外记录。
