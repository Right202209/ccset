# ccset 用户指南

[English](../user-guide.md) | 简体中文 · [README](../../README.zh-CN.md)

## Agent 选择

TUI 展示由本地文件检测到的 Agent，唯一匹配时自动进入；显式 `--agent <id>`／`CCSET_AGENT` 可首次配置。Change agent 或从 Agent 菜单 Esc 返回本地检测。

命令也接受位置 Agent ID。脚本必须显式选择；仅 stdin 与 stdout 均为 TTY 的命令可推断唯一匹配。检测只读，不执行 Agent。

## 交互

方向键移动、Enter 选择、Esc 返回；1–9 对应编号可见行，SGR 鼠标点击打开可见菜单／列表行。Ctrl+S 保存；放弃脏表单需要确认。

每次 Edit 重读文件。保存失败／拒绝替换损坏文件保留草稿和脏 baseline；返回成功消息不重复保存；成功删除返回 Provider 列表。

Frame 随内容增高、保留 scrollback；≥100 列／16 行可显示侧 Panel，80–99 列／≥20 行可显示详情条，更小仅主 View。Preview 只显示密钥存在性、合法 URL origin，隐藏路径／查询／片段。`CCSET_ASCII=1` 替换装饰字形，不转写中文。

## Agent 配置

路径以本次 home 为准，上游覆盖规则见各节。

| Agent | 托管配置 | Provider 凭据 |
| --- | --- | --- |
| Claude Code | `~/.claude/settings.json`、每 Provider `settings.<id>.json` | Provider 的 `env.ANTHROPIC_AUTH_TOKEN` |
| opencode | 已有 `~/.config/opencode/opencode.jsonc`，否则 `opencode.json`；`provider.<id>` | 块内 `options.apiKey` |
| Codex CLI | `~/.codex/config.toml`、`model_providers.<id>` | 已存 `auth.<id>.json`，选择后整体替换 live `auth.json` |
| pi | `~/.pi/agent/settings.json`、`models.json` 的 `providers.<id>` | 块内 `apiKey`，login auth 非托管 |
| Grok Build | `~/.grok/config.toml` 的 `model.<id>` | 块内 `api_key`，login auth 非托管 |

另写 `~/.ccset/settings.json` 保存语言／忽略偏好，`~/.codex/ccset.auth-profiles.json` 保存接管路由。备份在选定 Agent 目录的 `backups/ccset/`。

### Claude Code

全局管理代理、流量／安装／工具搜索开关、清理天数、模型；Provider 管端点／token／模型及可选 fallback／模型重映射。ID 为字母／数字／下划线／连字符；保留 local、json、__proto__。

`~/.claude.json` 仅不存在时创建并标记 onboarding 完成，已有文件只读。Provider 通过 `claude --settings <path>` 生效；use 打印，run 执行。

Test connection 是可选、经确认的 Messages 请求：显示主机、警告非 loopback HTTP、拒绝跳转、不显示响应体。保存不发送请求，其他 Agent 无探测。

### opencode

已有 JSONC 是 ccset 唯一目标，旁边旧 JSON 不改且在 Status 注明；不创建 JSONC，不管理 config.json。上游优先级有源码依据，真实实验仍为登记册 U6。

模型逐 ID 合并：保留项留自定义设置，新项为空对象，移除项删除。use 默认首个或显式 model；缺失／禁用目标拒绝，不改 enable／disable 列表。

仅 ccset home 等于真实 home 时应用 XDG_CONFIG_HOME；临时 home 使用自身 `.config/opencode`。

### Codex CLI

保存重申 `wire_api = "responses"`、`requires_openai_auth = true`，要求 Responses 端点；拒绝包含 env_key／experimental_bearer_token 的块，避免覆盖已存凭据。

保存 profile 不改 live auth。CLI use 同步切换路由／auth，model 可选。未匹配 live login 必须 adopt-current-as 新 ID 保留或 replace-current-auth 替换，均备份。接管记录旧路由；恢复所需自定义表缺失时拒绝。

keyring 拒绝激活／恢复，因为 auth.json 无效。**CODEX_HOME 只提示、不跟随**：CLI 写入拒绝不匹配，TUI 提示但不强制相同拒绝；需要此前置条件时使用 CLI。

TUI 单独编排；密钥来源、接管名重用、部分进度缺口见[安全待办](../../review.md)。保存 profile／本地文件成功不证明真实 API 兼容。

### pi

settings.json 为普通 JSON，管理 defaultProvider／defaultModel／defaultThinkingLevel。models.json 用 JSONC 编辑；保留模型数组成员的元数据，没有有效字符串 ID 的成员原样通过。

可无 models 覆盖内置 Provider；有自定义 models 的块必须有有效 api。use 同写默认 Provider／model，无列表时需显式 model。

apiKey 原样保存，含 pi 的 `$ENV_VAR`／`!command` 引用形式，ccset 不执行。login auth／项目设置非托管；PI_CODING_AGENT_DIR 仅真实 home 应用。

### Grok Build

管理 model／base_url／name／api_backend／api_key，backend 为 chat_completions／responses／messages。内置覆盖可无 key／endpoint，缺 endpoint 警告。

use 仅写 models.default，未知 ID 警告（可能内置）。Provider ID 用字母／数字／下划线／连字符；带点内置 ID 走 `global set --model grok-4.6`，手写 quoted table 非托管。

凭据顺序 inline api_key → 非托管 env_key → session token → XAI_API_KEY；新增 inline key 可覆盖手设引用。GROK_HOME 仅真实 home 应用。

## 删除与忽略提供商

Provider Screen 提供 Edit、Ignore／Stop ignoring、Delete；忽略／取消忽略／删除均需确认，仅 TUI。

- Claude 删除先备份再删整文件，损坏也可删。
- 共享文档须可解析，删除整块含自定义键；保留其他 Provider 与无关 TOML／JSONC 文本。
- Codex 拒绝删除当前路由 Provider，先备份／删 profile 再删表。
- 目标不存在为 no-op；成功后清忽略项、关闭 Screen。
- 忽略仅改 ccset 偏好，常规列表／Claude 探测隐藏，列表可显示并取消忽略。
- 删除后清忽略项失败时，错误可能漏报已完成删除；重试可清记录。独立 Remove saved credential 直接删 Codex sidecar，保留表和旧备份。

删除／清理不会抹掉其他备份中的凭据。

## 不会对你的文件做的事

- 逐叶 set／delete 保留非托管成员；TUI 留空按契约删除，CLI 省略保留、unset 显式删，支持的 false 保持值。
- TOML／JSONC 保无关文本；普通 JSON 可重排版。inline TOML 可展开 dotted assignments 并留兄弟键。
- 保存重读，但托管字段仍按表单持有值写回，可能覆盖这些字段的外部修改。
- 配置替换／删除先备份；排他私有 stage、每文件原子 rename；create-only 状态／接管排他发布不覆盖已有目标。
- 损坏配置须确认或支持的 replace-invalid；Codex CLI provider set 不重建不可读 Auth profile。
- live Codex auth 整体替换，不合并未知 token 结构。
- 多文件失败报告已提交项和回滚错误；无跨文件事务、写锁或 fsync 断电保证。见[未解决安全项](../../review.md)。

## 密钥

TUI 少于 16 字符全隐藏，较长显示首尾四字符与固定宽度遮罩；命令不导出托管凭据字段。遮蔽不是加密，配置／profile／备份可能明文。

POSIX stage 以 0600 创建，不支持文件系统上的 chmod 重申为尽力执行；Windows ACL 非托管。每 Agent 备份目录每 basename 留十份，旧密钥留至 Status → Clear ccset backups。清理按成功数量报告失败路径、支持重试；中断复制显示 partial 警告。

Status 的任意 URL 成分／模型元数据有[投影缺口](../../review.md)，原始输出不能自动视为可分享。报告规则见[安全政策](SECURITY.zh-CN.md)。

## Windows

macOS／Linux 支持，WSL／Windows Terminal 配 PowerShell 尽力支持；Windows CI 不证明原生交互，cmd.exe 不支持。0600 仅 POSIX 文件系统，Node chmod 不控制 NTFS 访问，目录继承 ACL 决定权限，见[支持政策](SUPPORT.zh-CN.md)。

## CLI

```text
ccset [--agent <id>]           # TUI
ccset <agent> <command> …
ccset --agent <id> <command> …
ccset --help | --version
```

无子命令且 stdin 非 TTY 时退出 2；显式命令无界面运行。人类输出为逐行文本，json 为单 envelope。完整选项／unset ID／JSON 字段／退出码见[命令契约](milestone-3-non-interactive.zh-CN.md)。

### 选择、添加和使用供应商

```bash
ccset presets list
ccset claude-code add relay --preset openrouter
ccset claude-code use relay
ccset claude-code run relay -- --help
ccset codex add relay --preset openrouter
CCSET_AGENT=pi ccset use relay
```

预设 add 仅两端 TTY、人类输出、非 dry-run 可隐藏提示，Enter 保存，Ctrl+C 无写入取消。脚本／json／dry-run 需 CCSET_TOKEN 或 token-stdin，两来源冲突报错。

OpenRouter 包含五 Agent，DeepSeek 无 Codex Responses 条目。模型初值可能过时，不是 live 证据；重复预设会 patch 已有 Provider，覆盖前查看 dry-run。默认 ID 用 preset ID，保留名加 -ccset，见[贡献规则](../../presets/README.md)。

### 命令

五种支持 status、global set、provider set、use（别名 provider use）；Claude 另有 run／state init。

| Agent | use 效果 |
| --- | --- |
| Claude Code | 校验并打印会话命令，无写入 |
| opencode | 保存 provider/model，可选 model |
| Codex | 切路由／Auth profile，可选全局 model |
| pi | 保存默认 Provider／model，可选 model |
| Grok Build | 保存 models.default |

已有会话不变，上游 CLI／项目设置可覆盖启动默认。run 无 shell、继承 I/O、返回子进程状态；run dry-run json 仅预览，live run json 拒绝。

### 环境变量

| 变量 | 行为 |
| --- | --- |
| CCSET_LOCALE | zh-Hans 为中文，其他已设值为英文；覆盖 TUI 提示／持久化；命令用覆盖或英文，未设 TUI 用保存值或首次提示，不推断 LANG |
| CCSET_ASCII=1 | 装饰／标点 ASCII 化，中文不转写 |
| CCSET_AGENT | 显式 fallback，CLI 优先；空／未知报错 |
| CCSET_HOME | ccset 临时 home，不隔离上游 Agent |
| CCSET_TOKEN | provider set／预设 add 密钥，与 token-stdin 冲突 |

Ink 遵守 NO_COLOR，网站浏览器语言独立于 CLI 偏好。
