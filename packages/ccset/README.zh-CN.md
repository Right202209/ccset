# ccset

[English](https://github.com/Right202209/ccset/blob/master/packages/ccset/README.md) | 简体中文

这是 [@droite/ccset](https://www.npmjs.com/package/@droite/ccset) 的官方转发包。
ccset 提供用于配置编程 Agent 的终端界面和命令行。

```bash
npx ccset
```

也可以全局安装：

```bash
npm install -g ccset
ccset --agent claude-code
```

本包在同一进程中运行 `@droite/ccset`，保留命令参数、标准输入、终端交互和退出码。
转发包 `0.1.0` 固定使用已经发布的 `@droite/ccset` `0.10.0`；
`ccset --version` 显示的是底层 CLI 的版本。

配置方法见[项目 README](https://github.com/Right202209/ccset/blob/master/README.zh-CN.md)
和[用户指南](https://github.com/Right202209/ccset/blob/master/docs/zh-CN/user-guide.zh-CN.md)。
需要 Node.js 18 或更新版本。采用 MIT 许可证。

## 发布

本包与主 CLI 分开发布。它的 GitHub Release 标签是 `ccset-v<version>`
（当前为 `ccset-v0.1.0`）；主 CLI 使用 `v<version>`。两者都通过
`.github/workflows/publish.yml`，在 `npm-publish` 环境中使用 npm 可信发布和
来源证明。首次发布前，需要配置 `ccset` 包的可信发布者和发布权限。
npm 在已有包的设置页里配置可信发布者，其文档没有说明如何为尚无已发布版本的
名称配置，因此打标签前要先确认第一个版本如何创建。
发布检查会拒绝本地发布、不干净的工作区，以及版本不符或属于主 CLI 的标签。

主 CLI 的下一版本发布后，更新精确依赖和两份 README 的版本说明，再从根目录运行
`npm run verify:release-artifact` 和完整 `npm test`，之后再发布转发包。
固定的版本必须已经可以从 npm 安装；fixture 会安装它，并对照该依赖核对转发行为。
