/**
 * opencode's own strings, shipped with the module so that adding an agent
 * stays a two-file change (PRD 2.2 criterion 5). Only text naming opencode,
 * its file, or its config keys belongs here; shared vocabulary comes from the
 * shell catalog.
 */
export const opencodeMessages: Record<string, Record<string, string>> = {
  en: {
    /* --------------------------------------------------------- action detail */
    'opencode.action.globalDetail': '~/.config/opencode/opencode.json',
    'opencode.action.providersDetail': 'Add or edit a provider block in that file',
    'opencode.action.providerAddDetail': 'Add a provider block',

    /* ---------------------------------------------------------------- fields */
    'opencode.field.smallModel': 'Small model',
    'opencode.field.share': 'Sharing',
    'opencode.field.autoupdate': 'Auto-update',
    'opencode.field.username': 'Display name',
    'opencode.field.disabledProviders': 'Disabled providers',
    'opencode.field.providerId': 'Provider id',
    'opencode.field.displayName': 'Provider label',
    'opencode.field.apiKey': 'API key',
    'opencode.field.npm': 'SDK package',
    'opencode.field.models': 'Model ids',
    'opencode.field.timeout': 'Request timeout (ms)',

    /* --------------------------------------------------------------- choices */
    'opencode.choice.shareManual': 'Manual',
    'opencode.choice.shareAuto': 'Automatic',
    'opencode.choice.shareDisabled': 'Disabled',
    'opencode.choice.notify': 'Notify only',

    /* ------------------------------------------------------------------ help */
    'opencode.help.globalModel': 'Written as provider/model, e.g. my-router/claude-sonnet-5.',
    'opencode.help.smallModel': 'Used for cheap side tasks like title generation.',
    'opencode.help.share': 'Whether conversations can be shared. Blank removes the key.',
    'opencode.help.username': 'Shown instead of your system username. Blank removes the key.',
    'opencode.help.disabledProviders':
      'Comma-separated ids opencode should not load. Written as a JSON array.',
    'opencode.help.providerId':
      'Becomes the key under "provider". Letters, digits, - and _ only.',
    'opencode.help.displayName': 'Shown in opencode’s model picker. Blank removes the key.',
    'opencode.help.baseUrl': 'Endpoint root, e.g. https://api.example.com — no trailing path.',
    'opencode.help.apiKey': 'Written to options.apiKey. Masked everywhere ccset prints it.',
    'opencode.help.npm': 'The AI SDK package that gives this provider its wire protocol.',
    'opencode.help.models':
      'Comma-separated ids this provider serves. Existing entries keep their own settings.',
    'opencode.help.timeout': 'Blank removes the key. opencode then uses its own default.',

    /* ---------------------------------------------------------------- status */
    'opencode.status.noProviders': 'No provider blocks in this file.',
    'opencode.status.noBaseUrl': 'No options.baseURL in this block.',
    'opencode.warning.jsoncPresent':
      'An opencode.jsonc sits beside the managed config; the save may not be the file opencode reads.',
    'opencode.warning.noBaseUrl': 'Provider {name} has no options.baseURL.',
    'opencode.validate.providerBaseUrlRequired': 'A new provider needs --base-url.',
    'opencode.validate.providerTokenRequired':
      'A new provider needs a key from CCSET_TOKEN or --token-stdin.',
    'opencode.status.jsoncTitle': 'opencode.jsonc (not managed)',
    'opencode.status.jsoncNote':
      'opencode also loads this file. ccset never writes it, because a comment cannot survive a JSON rewrite — so a save here may not be the config opencode reads.',

    /* ----------------------------------------------------------------- notes */
    'opencode.note.configPath': 'File: {path} — created on save.',
    'opencode.note.singleFile':
      'Every provider lives in this one file. Only the block you are editing changes.',

    /* ----------------------------------------------------------------- write */
    'opencode.write.activate': 'opencode reads this file on start. Run it with:',
    'opencode.write.providerSaved': 'Provider block saved',
  },

  'zh-Hans': {
    /* --------------------------------------------------------- action detail */
    'opencode.action.globalDetail': '~/.config/opencode/opencode.json',
    'opencode.action.providersDetail': '在该文件中添加或编辑提供商配置块',
    'opencode.action.providerAddDetail': '添加提供商配置块',

    /* ---------------------------------------------------------------- fields */
    'opencode.field.smallModel': '小型模型',
    'opencode.field.share': '共享',
    'opencode.field.autoupdate': '自动更新',
    'opencode.field.username': '显示名称',
    'opencode.field.disabledProviders': '停用的提供商',
    'opencode.field.providerId': '提供商 ID',
    'opencode.field.displayName': '提供商标签',
    'opencode.field.apiKey': 'API 密钥',
    'opencode.field.npm': 'SDK 包',
    'opencode.field.models': '模型 ID',
    'opencode.field.timeout': '请求超时（毫秒）',

    /* --------------------------------------------------------------- choices */
    'opencode.choice.shareManual': '手动',
    'opencode.choice.shareAuto': '自动',
    'opencode.choice.shareDisabled': '停用',
    'opencode.choice.notify': '仅通知',

    /* ------------------------------------------------------------------ help */
    'opencode.help.globalModel': '以 provider/model 形式写入，例如 my-router/claude-sonnet-5。',
    'opencode.help.smallModel': '用于标题生成等廉价的辅助任务。',
    'opencode.help.share': '对话是否可以共享。留空则删除该键。',
    'opencode.help.username': '代替你的系统用户名显示。留空则删除该键。',
    'opencode.help.disabledProviders': '逗号分隔的 ID，opencode 不会加载它们。以 JSON 数组写入。',
    'opencode.help.providerId': '将成为 "provider" 下的键名。只能使用字母、数字、- 和 _。',
    'opencode.help.displayName': '显示在 opencode 的模型选择器中。留空则删除该键。',
    'opencode.help.baseUrl': '端点根地址，如 https://api.example.com — 不要带尾部路径。',
    'opencode.help.apiKey': '写入 options.apiKey。ccset 打印它的所有位置都会掩码。',
    'opencode.help.npm': '为该提供商提供通信协议的 AI SDK 包。',
    'opencode.help.models': '逗号分隔的 ID，是该提供商提供的模型。已有的条目保留各自设置。',
    'opencode.help.timeout': '留空则删除该键，opencode 使用自己的默认值。',

    /* ---------------------------------------------------------------- status */
    'opencode.status.noProviders': '此文件中没有提供商配置块。',
    'opencode.status.noBaseUrl': '此配置块中没有 options.baseURL。',
    'opencode.warning.jsoncPresent': '受管配置旁存在 opencode.jsonc；写入的文件可能不是 opencode 实际读取的。',
    'opencode.warning.noBaseUrl': 'Provider {name} 没有设置 options.baseURL。',
    'opencode.validate.providerBaseUrlRequired': '新建 provider 需要 --base-url。',
    'opencode.validate.providerTokenRequired': '新建 provider 需要 CCSET_TOKEN 或 --token-stdin 提供的密钥。',
    'opencode.status.jsoncTitle': 'opencode.jsonc（不受管理）',
    'opencode.status.jsoncNote':
      'opencode 也会读取此文件。ccset 绝不写入它，因为注释无法在 JSON 重写后保留 — 因此这里保存的内容可能不是 opencode 实际读取的配置。',

    /* ----------------------------------------------------------------- notes */
    'opencode.note.configPath': '文件：{path} — 保存时创建。',
    'opencode.note.singleFile': '所有提供商都保存在这一个文件中。只有你正在编辑的配置块会改变。',

    /* ----------------------------------------------------------------- write */
    'opencode.write.activate': 'opencode 启动时会读取此文件。运行：',
    'opencode.write.providerSaved': '提供商配置块已保存',
  },
}
