/**
 * Claude Code's own strings. They live with the module rather than in
 * src/i18n/en.ts so that adding an agent stays a two-file change
 * (PRD 2.2 criterion 5). Keys are namespaced by agent id.
 *
 * Only text that names Claude Code, its files, or its environment variables
 * belongs here. Shared vocabulary -- "Base URL", "Status", every write and
 * confirm line -- stays in the shell catalog, where a second agent reuses it.
 */
export const claudeCodeMessages: Record<string, Record<string, string>> = {
  en: {
    /* --------------------------------------------------------- action detail */
    'claudeCode.action.globalDetail': '~/.claude/settings.json',
    'claudeCode.action.providersDetail': 'Add or edit settings.<name>.json',
    'claudeCode.action.providerAddDetail': 'Create a new settings.<name>.json',
    'claudeCode.action.projectModelMapping': 'Project custom model mapping',
    'claudeCode.action.createState': 'Create ~/.claude.json',
    'claudeCode.action.createStateDetail':
      'Only when absent — ccset never rewrites this file',

    /* ---------------------------------------------------------------- fields */
    'claudeCode.field.proxyEnabled': 'Proxy',
    'claudeCode.field.proxyUrl': 'Proxy URL',
    'claudeCode.field.disableNonessentialTraffic': 'Disable nonessential traffic',
    'claudeCode.field.attributionHeader': 'Attribution header',
    'claudeCode.field.disableInstallationChecks': 'Disable installation checks',
    'claudeCode.field.enableToolSearch': 'Enable tool search',
    'claudeCode.field.cleanupPeriodDays': 'Cleanup period (days)',
    'claudeCode.field.fallbackModel': 'Fallback models',
    'claudeCode.field.defaultOpusModel': 'Opus model remap',
    'claudeCode.field.defaultSonnetModel': 'Sonnet model remap',
    'claudeCode.field.defaultHaikuModel': 'Haiku model remap',
    'claudeCode.field.customModelMapping': 'Configure project model mappings',
    'claudeCode.field.anthropicModel': 'Main model ID',
    'claudeCode.field.subagentModel': 'Subagent model ID',

    /* ------------------------------------------------------------------ help */
    'claudeCode.help.proxyEnabled': 'Off deletes HTTP_PROXY and HTTPS_PROXY from the file.',
    'claudeCode.help.proxyUrl': 'Written to both HTTP_PROXY and HTTPS_PROXY.',
    'claudeCode.help.cleanupPeriodDays':
      'Blank removes the key. Claude Code then uses its own default.',
    'claudeCode.help.globalModel': 'Free text. Blank removes the key.',
    'claudeCode.help.providerName':
      'Becomes settings.<name>.json. Letters, digits, - and _ only.',
    'claudeCode.help.baseUrl':
      'Endpoint root, e.g. https://api.example.com — no trailing path.',
    'claudeCode.help.token':
      'Sent as an Authorization: Bearer header. Masked everywhere ccset prints it.',
    'claudeCode.help.providerModel':
      'Free text. Blank omits the key so the global model applies.',
    'claudeCode.help.fallbackModel': 'Comma-separated. Written as a JSON array.',
    'claudeCode.help.customModelMapping':
      'Off by default. Enable to edit project slots; disabling preserves mappings.',
    'claudeCode.help.projectModelMapping':
      'Free text; IDs stay verbatim. Blank clears only this slot.',

    /* ---------------------------------------------------------------- status */
    'claudeCode.status.stateTitle': 'Claude Code state (~/.claude.json)',
    'claudeCode.status.stateAbsentNote':
      'ccset can create it with hasCompletedOnboarding set.',
    'claudeCode.status.readOnlyNote': 'ccset never writes this file — Claude Code owns it.',
    'claudeCode.status.noProviders': 'No provider files found in ~/.claude.',
    'claudeCode.status.noBaseUrl': 'No ANTHROPIC_BASE_URL in this file.',

    /* ----------------------------------------------------------------- notes */
    'claudeCode.note.providerPath':
      'File: ~/.claude/settings.<name>.json — created on save.',
    'claudeCode.note.projectModelMappingPath': 'Project file: {path}',
    'claudeCode.note.providerSavedBeforeMapping': 'Provider file saved first: {path}',

    /* ----------------------------------------------------------------- write */
    'claudeCode.write.stateCreated': 'Created with hasCompletedOnboarding set.',
    'claudeCode.write.stateExists': 'Already present — left untouched.',
    'claudeCode.write.projectModelMappingSaved': 'Project model mappings saved',
    'claudeCode.write.projectModelMappingActivate': 'To apply these project-level mappings:',
    'claudeCode.write.projectModelMappingReload': 'restart Claude Code in this project',

    /* -------------------------------------------------------------- commands */
    'claudeCode.validate.proxyNeedsUrl':
      'The proxy is on, but no proxy URL was supplied and none is on disk.',
    'claudeCode.validate.proxyConflict':
      'The proxy toggle and the proxy URL in this command contradict each other.',

    /* --------------------------------------------------------- status warns */
    'claudeCode.warning.stateAbsent': '~/.claude.json is absent; state init can create it.',
    'claudeCode.warning.noBaseUrl': 'Provider {name} has no ANTHROPIC_BASE_URL.',
    'claudeCode.warning.modelMappingClaudeNames':
      'All known provider model names contain "claude"; double-check that your provider supports the selected slots.',
    'claudeCode.validate.providerBaseUrlRequired': 'A new provider needs --base-url.',
    'claudeCode.validate.providerTokenRequired':
      'A new provider needs a token from CCSET_TOKEN or --token-stdin.',
  },

  'zh-Hans': {
    /* --------------------------------------------------------- action detail */
    'claudeCode.action.globalDetail': '~/.claude/settings.json',
    'claudeCode.action.providersDetail': '添加或编辑 settings.<name>.json',
    'claudeCode.action.providerAddDetail': '新建 settings.<name>.json',
    'claudeCode.action.projectModelMapping': '项目自定义模型映射',
    'claudeCode.action.createState': '创建 ~/.claude.json',
    'claudeCode.action.createStateDetail': '仅当文件不存在时 — ccset 绝不重写此文件',

    /* ---------------------------------------------------------------- fields */
    'claudeCode.field.proxyEnabled': '代理',
    'claudeCode.field.proxyUrl': '代理 URL',
    'claudeCode.field.disableNonessentialTraffic': '禁用非必要流量',
    'claudeCode.field.attributionHeader': '署名标头',
    'claudeCode.field.disableInstallationChecks': '禁用安装检查',
    'claudeCode.field.enableToolSearch': '启用工具搜索',
    'claudeCode.field.cleanupPeriodDays': '清理周期（天）',
    'claudeCode.field.fallbackModel': '后备模型',
    'claudeCode.field.defaultOpusModel': 'Opus 模型重映射',
    'claudeCode.field.defaultSonnetModel': 'Sonnet 模型重映射',
    'claudeCode.field.defaultHaikuModel': 'Haiku 模型重映射',
    'claudeCode.field.customModelMapping': '配置项目模型映射',
    'claudeCode.field.anthropicModel': '主模型 ID',
    'claudeCode.field.subagentModel': '子代理模型 ID',

    /* ------------------------------------------------------------------ help */
    'claudeCode.help.proxyEnabled': '关闭会从文件中删除 HTTP_PROXY 和 HTTPS_PROXY。',
    'claudeCode.help.proxyUrl': '同时写入 HTTP_PROXY 和 HTTPS_PROXY。',
    'claudeCode.help.cleanupPeriodDays': '留空则删除该键，Claude Code 使用自己的默认值。',
    'claudeCode.help.globalModel': '自由文本。留空则删除该键。',
    'claudeCode.help.providerName': '将成为 settings.<name>.json。只能使用字母、数字、- 和 _。',
    'claudeCode.help.baseUrl': '端点根地址，如 https://api.example.com — 不要带尾部路径。',
    'claudeCode.help.token': '作为 Authorization: Bearer 请求头发送。ccset 打印它的所有位置都会掩码。',
    'claudeCode.help.providerModel': '自由文本。留空则省略该键，全局模型生效。',
    'claudeCode.help.fallbackModel': '逗号分隔。以 JSON 数组写入。',
    'claudeCode.help.customModelMapping':
      '默认关闭。启用后先保存此 provider，再编辑项目级模型槽位。关闭不会清除已保存的映射。',
    'claudeCode.help.projectModelMapping':
      '自由文本；模型 ID 会原样写入当前项目的 .claude/settings.json。留空只删除对应槽位。',

    /* ---------------------------------------------------------------- status */
    'claudeCode.status.stateTitle': 'Claude Code 状态（~/.claude.json）',
    'claudeCode.status.stateAbsentNote': 'ccset 可以创建它，并写入 hasCompletedOnboarding。',
    'claudeCode.status.readOnlyNote': 'ccset 绝不写入此文件 — 它归 Claude Code 所有。',
    'claudeCode.status.noProviders': '在 ~/.claude 中没有找到提供商文件。',
    'claudeCode.status.noBaseUrl': '此文件中没有 ANTHROPIC_BASE_URL。',

    /* ----------------------------------------------------------------- notes */
    'claudeCode.note.providerPath': '文件：~/.claude/settings.<name>.json — 保存时创建。',
    'claudeCode.note.projectModelMappingPath': '项目文件：{path}',
    'claudeCode.note.providerSavedBeforeMapping': '已先保存 provider 文件：{path}',

    /* ----------------------------------------------------------------- write */
    'claudeCode.write.stateCreated': '已创建，并写入 hasCompletedOnboarding。',
    'claudeCode.write.stateExists': '已存在 — 未做改动。',
    'claudeCode.write.projectModelMappingSaved': '项目模型映射已保存',
    'claudeCode.write.projectModelMappingActivate': '应用这些项目级映射：',
    'claudeCode.write.projectModelMappingReload': '在此项目中重启 Claude Code',

    /* -------------------------------------------------------------- commands */
    'claudeCode.validate.proxyNeedsUrl': '代理已开启，但未提供代理 URL，磁盘上也没有。',
    'claudeCode.validate.proxyConflict': '此命令中的代理开关与代理 URL 相互矛盾。',

    /* --------------------------------------------------------- status warns */
    'claudeCode.warning.stateAbsent': '~/.claude.json 不存在；state init 可以创建它。',
    'claudeCode.warning.noBaseUrl': 'Provider {name} 没有设置 ANTHROPIC_BASE_URL。',
    'claudeCode.warning.modelMappingClaudeNames':
      '所有已知 provider 模型名都包含“claude”；请确认你的 provider 支持所选槽位。',
    'claudeCode.validate.providerBaseUrlRequired': '新建 provider 需要 --base-url。',
    'claudeCode.validate.providerTokenRequired':
      '新建 provider 需要 CCSET_TOKEN 或 --token-stdin 提供的密钥。',
  },
}
