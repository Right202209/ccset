# ccset

[English](README.md) | 中文说明

一个用于正确写入编程 Agent 设置文件的终端界面工具。

将编程 Agent 指向第三方 API 端点时，手动编辑 JSON 容易因字段名拼写错误而导致配置静默失效。ccset 会生成和编辑这些文件，并显示磁盘上已有的配置。

目前支持两个 Agent：**Claude Code** 和 **opencode**。ccset 会询问你要配置哪一个，也可以用 `--agent <id>` 指定。

**ccset 只生成配置，不会启用配置。** 对 Claude Code，启用时请运行 `claude --settings <path>`，每次成功写入后 ccset 都会打印该命令。opencode 在启动时自行读取配置文件，无需启用命令——ccset 会如实说明，而不是编造一条命令。

```bash
npx @droite/ccset
```

要求 Node.js 18 或更高版本。支持 macOS 和 Linux；Windows 为尽力支持。

ccset 是尽力维护的开源项目，并非托管服务。仅支持 npm 上的最新版本。平台与维护边界见
[支持政策](https://github.com/Right202209/ccset/blob/master/SUPPORT.md)，报告安全问题前请阅读
[安全政策](https://github.com/Right202209/ccset/blob/master/SECURITY.md)。

## 功能

### Claude Code

| 菜单项 | 操作对象 |
| --- | --- |
| Global settings | `~/.claude/settings.json` |
| Providers | `~/.claude/settings.<name>.json`，可添加、编辑、查看 |
| Status | 读取上述文件及 `~/.claude.json`，不会写入 |
| Test connection | 向选定的提供商发送一次需确认的连接请求 |

### opencode

| 菜单项 | 操作对象 |
| --- | --- |
| Global settings | `~/.config/opencode/opencode.json`：模型、分享、自动更新 |
| Providers | 同一文件中的 `provider.<id>` 配置块，可添加、编辑、查看 |
| Status | 读取上述内容，不会写入 |

opencode 将所有 provider 保存在同一个文件中，而不是每个 provider 一个文件，因此编辑某个 provider 只会重写对应的配置块。其中的 `models` 映射按条目合并：磁盘上已有的模型保留自身设置，新增的 id 会被添加，从列表中移除的 id 会被删除。

**ccset 不管理 opencode 的 `.jsonc` 配置。** opencode 也会读取 `opencode.jsonc`，其中可能包含注释，而注释无法在 JSON 重写后保留。ccset 从不写入该文件。如果该文件存在，Status 会指出它，并提示此次写入可能并非 opencode 实际读取的配置——请先确认要使用哪一个文件。

opencode 没有 Test connection：自定义 provider 的通信协议取决于你指定的 SDK 包，因此不存在 ccset 能够如实探测的单一端点。

方向键移动，`1`-`9` 选择当前窗口内对应编号的可见行，Enter 选择，Esc 返回。长列表会显示当前可见范围和总行数。表单在放弃未保存修改前会请求确认。进入嵌套界面后，标题会显示完整导航路径；终端较窄时仍保留最后两级路径。

## 文件与密钥安全

- 未管理的键会保留，包括 `hooks`、`statusLine`、`permissions`、`enabledPlugins` 及手动设置的环境变量。
- 只写入叶子节点，绝不整体覆盖其父对象，因此你手动写在被管理对象内部的同级键会被保留。
- 关闭代理时会删除 `HTTP_PROXY` 和 `HTTPS_PROXY`；空字段会被省略，而不是写入 `null` 或空字符串。
- 写入前会重新读取文件，写入采用同目录临时文件、权限设置和重命名，保证原子性。
- POSIX 系统写入文件权限为 `0600`。每次写入前会备份到该 Agent 配置目录下的 `backups/ccset/`：Claude Code 为 `~/.claude/backups/ccset/`，opencode 为 `~/.config/opencode/backups/ccset/`，最多保留每个文件十份。
- Token 仅在确认 **Test connection** 后发送，并在界面和错误信息中遮罩显示。备份仍可能包含旧 Token，可从对应 Agent 的 Status 中清除 ccset 备份。
- 无效 JSON 不会被静默覆盖；工具会提示你备份后重新创建。

## CLI

```text
ccset [--agent <id>]
  -v, --version
  -h, --help
```

`--agent` 可取 `claude-code` 或 `opencode`，指定后会跳过 Agent 选择界面。

这是交互式工具。通过管道或在 CI 中运行时会提示并以退出码 `2` 退出。

### 环境变量

| 变量 | 作用 |
| --- | --- |
| `CCSET_ASCII=1` | 使用七位 ASCII 界面：装饰字形、帮助和标点以及掩码值都会折叠为可打印 ASCII。不设置时使用 Unicode 字形。 |
| `CCSET_HOME` | 覆盖 ccset 读写的主目录，供隔离测试使用，不建议日常使用。 |

颜色开关不在 ccset：渲染经由 Ink，它已支持 `NO_COLOR`。

## 添加 Agent

只需改动两个文件，这一点是强制的而非愿景。在 `src/agents/<id>/` 下实现 `src/types.ts` 中的 `Agent` 接口（`detect()`、`getActions()`，以及该 Agent 界面所用的文案），然后将其加入 `src/registry.ts` 的静态数组。添加 opencode 时，`src/` 下没有改动任何其他文件。

通用文件读写、合并、备份、遮罩和路径解析位于 `src/core/`，应直接复用。完整指南见
[docs/adding-an-agent.md](docs/adding-an-agent.md)，该文档是在添加第二个 Agent 的过程中写成的。

## 开发

```bash
npm install
npm run typecheck
npm run build
```

`Important Documentation.md` 是需要实际运行工具验证的场景清单。
Pull Request 可以直接提出产品改动；验收和验证要求见
[贡献指南](https://github.com/Right202209/ccset/blob/master/CONTRIBUTING.md)。

## 许可证

MIT。
