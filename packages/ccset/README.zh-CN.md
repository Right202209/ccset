# ccset 转发包

[English](README.md) | 简体中文

此独立包在同一进程导入已安装的 [@droite/ccset](https://www.npmjs.com/package/@droite/ccset)，保留参数、stdin、终端行为与退出状态。Node ≥18，MIT。转发包 `0.1.0` 精确依赖主包 `0.11.1`；`--version` 显示主包版本。两者以 [package.json](package.json) 为准。

最近的 registry 证据（2026-11-13）记录无作用域名称尚未注册；源码就绪不能证明已发布。确认注册／发布之前使用：

```bash
npx @droite/ccset
```

配置说明见[项目 README](../../README.zh-CN.md) 和[用户指南](../../docs/zh-CN/user-guide.zh-CN.md)。

## 发布

主包标签 `v<version>`，转发包 `ccset-v<version>`。[publish.yml](../../.github/workflows/publish.yml) 在 `npm-publish` 中使用独立 job、各包独立 trusted publisher 与 provenance。守卫拒绝本地发布、脏 checkout、版本不匹配和跨包标签。

首次注册需已登录 npm 的维护者。2026-11-13 决策为先用最小 `0.0.1` 保留名称，再由工作流发布转发版本；注册后配置该包的 trusted publisher。此引导方案不代表发布已完成。

主包发布后更新精确依赖、适用的转发版本／lockfile 和双语 README。顺序运行根目录 `verify:release-artifact` 与完整 `npm test`；fixture 在另一临时项目从 npm 安装精确依赖，不执行发布。见[发布门槛](<../../Important Documentation.md#6-build-and-publish>)。
