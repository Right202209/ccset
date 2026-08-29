# ccset

[English](README.md) | 中文说明

一个用于正确写入 Claude Code 设置文件的终端界面工具。

将 Claude Code 指向第三方 Anthropic 兼容端点时，手动编辑 JSON 容易因字段名拼写错误而导致配置静默失效。ccset 会生成和编辑这些文件，并显示磁盘上已有的配置。

**ccset 只生成配置，不会启用配置。** 启用时请运行 `claude --settings <path>`。每次成功写入后，ccset 都会打印可直接复制的完整命令。

```bash
npx @droite/ccset
```

要求 Node.js 18 或更高版本。支持 macOS 和 Linux；Windows 为尽力支持。

## 功能

| 菜单项 | 操作对象 |
| --- | --- |
| Global settings | `~/.claude/settings.json` |
| Providers | `~/.claude/settings.<name>.json`，可添加、编辑、查看 |
| Status | 读取上述文件及 `~/.claude.json`，不会写入 |
| Test connection | 向选定的提供商发送一次需确认的连接请求 |

方向键移动，`1`-`9` 跳转，Enter 选择，Esc 返回。表单在放弃未保存修改前会请求确认。

## 文件与密钥安全

- 未管理的键会保留，包括 `hooks`、`statusLine`、`permissions`、`enabledPlugins` 及手动设置的环境变量。
- 关闭代理时会删除 `HTTP_PROXY` 和 `HTTPS_PROXY`；空字段会被省略，而不是写入 `null` 或空字符串。
- 写入前会重新读取文件，写入采用同目录临时文件、权限设置和重命名，保证原子性。
- POSIX 系统写入文件权限为 `0600`。每次写入前会备份到 `~/.claude/backups/ccset/`，最多保留每个文件十份。
- Token 仅在确认 **Test connection** 后发送，并在界面和错误信息中遮罩显示。备份仍可能包含旧 Token，可从 Status 中清除 ccset 备份。
- 无效 JSON 不会被静默覆盖；工具会提示你备份后重新创建。

## CLI

```text
ccset [--agent <id>]
  -v, --version
  -h, --help
```

这是交互式工具。通过管道或在 CI 中运行时会提示并以退出码 `2` 退出。

## 添加 Agent

在 `src/agents/<id>/` 下实现 `src/types.ts` 中的 `Agent` 接口（`detect()` 和 `getActions()`），然后将其加入 `src/registry.ts` 的静态数组。通用文件读写、合并、备份、遮罩和路径解析位于 `src/core/`，应直接复用。

## 开发

```bash
npm install
npm run typecheck
npm run build
```

`Important Documentation.md` 是需要实际运行工具验证的场景清单。

## 许可证

MIT。
