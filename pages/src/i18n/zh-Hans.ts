import type { Catalog } from './types.js'

/** Simplified-Chinese catalog for the website; keys must mirror en.ts. */
export const zhHans: Catalog = {
  /* ------------------------------------------------------------------- nav */
  'nav.docs': '文档',
  'nav.github': 'GitHub',
  'nav.language': '语言',

  /* ------------------------------------------------------------------ hero */
  'hero.tagline':
    '为 Claude Code、opencode、Codex CLI、pi 和 Grok Build 配置第三方 API 服务，既可以用交互式终端界面，也可以用可脚本化的命令。ccset 保留未被管理的设置，并在改动前备份现有文件。',
  'hero.eyebrow': '开源 · MIT 许可证',
  'hero.headline': '为编程 Agent 写入设置文件。',
  'hero.headlineAccent': '启用权在你手中。',
  'hero.quickStart': '快速开始',
  'hero.docs': '文档',
  'hero.demoTitle': '一次 ccset 会话',
  'hero.meta.node': 'Node.js 18+',
  'hero.meta.platforms': 'macOS 与 Linux；Windows 尽力支持',
  'hero.meta.languages': 'English / 简体中文',

  /* ------------------------------------------------------------------ copy */
  'copy.copy': '复制',
  'copy.copied': '已复制',

  /* ------------------------------------------------------------- highlights */
  'highlights.title': '为什么选择 ccset',
  'stats.agents': '支持的 Agent',
  'stats.languages': '界面语言',
  'stats.backups': '每个文件的备份',
  'stats.mode': 'POSIX 写入权限',
  'highlight.agents.title': '五个 Agent',
  'highlight.agents.body': 'Claude Code、opencode、Codex CLI、pi 和 Grok Build，各自的路径与规则互不干扰。',
  'highlight.cli.title': 'TUI 与可脚本化 CLI',
  'highlight.cli.body': '交互界面面向人，显式命令面向脚本和 CI，并支持 --dry-run 与 --json。',
  'highlight.i18n.title': 'English / 简体中文',
  'highlight.i18n.body': '首次使用时选择界面语言；命令与输出保持稳定。',
  'highlight.safety.title': '备份 ×10，写入 0600',
  'highlight.safety.body': '每个文件在 Agent 的 backups/ccset/ 目录下保留十份备份；POSIX 上以 0600 权限原子写入。',
  'highlight.preserve.title': '未管理的键不受影响',
  'highlight.preserve.body': '只写入受管理的叶子键；TOML 与 JSONC 编辑保留注释和格式。',

  /* ---------------------------------------------------------------- agents */
  'agents.title': '支持的 Agent',
  'agents.agentHeader': 'Agent',
  'agents.idHeader': '--agent ID',
  'agents.configHeader': '默认配置',

  /* -------------------------------------------------------------- features */
  'features.title': '面向真实的工作流',
  'feature.tui.title': '交互式核心流程',
  'feature.tui.body': '从本机检测到的 Agent 中选择一个，查看其设置并保存。方向键移动，Enter 选择，Esc 返回，Ctrl+S 保存表单。',
  'feature.commands.title': '可脚本化命令',
  'feature.commands.body': '每条命令都需要 --agent；用 --dry-run 预览而不写入，用 --json 得到结构化输出。',
  'feature.patch.title': '补丁而非替换',
  'feature.patch.body': 'set 只改你给出的字段。省略的字段保持原值；--unset 显式删除其中一个。',
  'feature.switch.title': '切换 Provider',
  'feature.switch.body': 'Codex 可同时切换路由与活动凭据；pi 设置启动默认值。已保存的 Auth profile 始终独立存放。',
  'feature.secrets.title': '严谨的密钥处理',
  'feature.secrets.body': '命令只通过 CCSET_TOKEN 或 --token-stdin 接受密钥，且令牌在界面中始终掩码显示。',
  'feature.activate.title': '激活权在你手中',
  'feature.activate.body': 'Claude Code 在保存后打印要运行的 claude --settings 命令；ccset 不会替你启动 Agent。',

  /* ------------------------------------------------------------ file safety */
  'fileSafety.title': '文件安全',
  'fileSafety.preserve.title': '未管理的键不受影响',
  'fileSafety.preserve.body': 'TOML 与 JSONC 编辑保留注释和格式。',
  'fileSafety.atomic.title': '原子写入，保存前重读',
  'fileSafety.atomic.body': '保存前重新读取目标文件，每个文件都以原子方式写入，POSIX 上权限为 0600。',
  'fileSafety.confirm.title': '不会静默覆盖',
  'fileSafety.confirm.body': '无效配置需要在界面中显式确认，或在受支持的命令上使用 --replace-invalid。',
  'fileSafety.mask.title': '令牌掩码',
  'fileSafety.mask.body': '令牌在界面中掩码显示。只有 Claude Code 可选的 Test connection 会经网络发送令牌。',
  'fileSafety.backups.title': '备份保留旧令牌',
  'fileSafety.backups.body': '每个文件在 Agent 的 backups/ccset/ 目录下保留十份备份。轮换凭据后请清理它们。',

  /* ------------------------------------------------------------- quickstart */
  'quickStart.title': '快速开始',
  'quickStart.run.title': '直接运行',
  'quickStart.run.body': '需要 Node.js 18+。从本机检测到的 Agent 中选择一个，查看其设置并保存。',
  'quickStart.install.title': '安装命令',
  'quickStart.install.body': '然后用 Agent id 直接运行。',
  'quickStart.cli.title': '写入脚本',
  'quickStart.cli.body': '显式命令可在脚本和 CI 中运行。API 密钥请通过 CCSET_TOKEN 或 --token-stdin 提供，绝不要放在命令参数里。',

  /* -------------------------------------------------------------- not found */
  'notFound.title': '未找到',
  'notFound.body': '该路由在本站点上不存在。',
  'notFound.home': '回到首页',

  /* -------------------------------------------------------------- docs view */
  'docs.search': '搜索文档',
  'docs.noResults': '没有匹配“{query}”的文档。',
  'docs.onThisPage': '本页内容',
  'docs.previous': '上一篇',
  'docs.next': '下一篇',
  'docs.unknownDoc': '该路由没有对应的文档。',
  'docs.allDocs': '全部文档',
  'docs.viewSource': '在 GitHub 查看源码',
  'docs.menu': '文档',

  /* ---------------------------------------------------------- sidebar groups */
  'group.getting-started': '入门',
  'group.reference': '参考',
  'group.project': '项目',

  /* -------------------------------------------------------------- doc labels */
  'doc.overview': '概览',
  'doc.user-guide': '使用指南',
  'doc.commands': '命令',
  'doc.glossary': '术语表',
  'doc.architecture': '架构',
  'doc.verification': '验证',
  'doc.adding-an-agent': '新增 Agent',
  'doc.add-agent-workflow': '新增 Agent 工作流',
  'doc.contributing': '参与贡献',
  'doc.support': '支持',
  'doc.security': '安全',

  /* ---------------------------------------------------------------- footer */
  'footer.docs': '文档',
  'footer.project': '项目',
  'footer.tagline': '为编程 Agent 写入设置文件，启用权在你手中。',
  'footer.npm': 'npm 包',
  'footer.license': 'MIT 许可证',
  'footer.builtFrom': '本站点由仓库自带的 Markdown 构建。',

  /* -------------------------------------------------------------- language */
  'lang.en': 'English',
  'lang.zh-Hans': '简体中文',

  /* ---------------------------------------------------------------- errors */
  'error.boundary': '渲染此视图时出了问题。',
  'error.reload': '重新加载',
}
