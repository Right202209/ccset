/**
 * Grok Build's own strings, shipped with the module so that adding an agent
 * stays a two-file change (PRD 2.2 criterion 5). Only text naming Grok Build,
 * its files, or its config keys belongs here; shared vocabulary comes from the
 * shell catalog.
 */
export const grokBuildMessages: Record<string, Record<string, string>> = {
  en: {
    /* --------------------------------------------------------- action detail */
    'grokBuild.action.globalDetail': 'Default model in ~/.grok/config.toml',
    'grokBuild.action.providersDetail':
      'Add or edit a [model.<id>] block in ~/.grok/config.toml',
    'grokBuild.action.providerAddDetail': 'Add a custom model block',

    /* ---------------------------------------------------------------- fields */
    'grokBuild.field.providerId': 'Model id',
    'grokBuild.field.modelId': 'Model name',
    'grokBuild.field.displayName': 'Display name',
    'grokBuild.field.apiBackend': 'API backend',
    'grokBuild.field.apiKey': 'API key',

    /* --------------------------------------------------------------- choices */
    'grokBuild.choice.backendChatCompletions': 'chat_completions',
    'grokBuild.choice.backendResponses': 'responses',
    'grokBuild.choice.backendMessages': 'messages',

    /* ------------------------------------------------------------------ help */
    'grokBuild.help.defaultModel':
      'Model id new sessions start with: a [model.*] block or a built-in. Blank removes the key.',
    'grokBuild.help.providerId':
      'Becomes the [model.<id>] table name: letters, digits, dashes and underscores. Naming a built-in model overrides only the fields you set, which is how Grok documents a key override.',
    'grokBuild.help.modelId':
      'Model identifier sent to the API. The section id is what /model and -m select; this is what the endpoint receives.',
    'grokBuild.help.baseUrl':
      'OpenAI-compatible endpoint, e.g. https://api.example.com/v1. A built-in id without one inherits the built-in endpoint.',
    'grokBuild.help.displayName': 'Label shown in Grok’s model picker.',
    'grokBuild.help.apiBackend':
      'Wire protocol Grok speaks with this endpoint. Unmanaged removes the key and Grok defaults to chat_completions.',
    'grokBuild.help.apiKey':
      'Stored inline in config.toml and masked everywhere ccset prints it. Grok resolves credentials as api_key, then env_key, the session token, and XAI_API_KEY.',

    /* ---------------------------------------------------------------- status */
    'grokBuild.status.noProviders': 'No [model.*] blocks in this file.',
    'grokBuild.status.noConfigFile': 'No config.toml yet; it is created on the first save.',
    'grokBuild.status.noBaseUrl':
      'No base_url in this block: a built-in id inherits its endpoint, a custom model needs one.',
    'grokBuild.status.authTitle': 'auth.json (not managed)',
    'grokBuild.status.authNote':
      'Credentials written by grok login live here. ccset does not edit this file; provider keys ccset saves go to config.toml.',

    /* --------------------------------------------------------------- warning */
    'grokBuild.warning.noBaseUrl':
      'Model {name} sets no base_url. A built-in id inherits its endpoint; a custom model cannot reach any endpoint without one.',
    'grokBuild.warning.modelNotInSection':
      'Model {name} has no [model.*] block in config.toml. If it is not a built-in model id, sessions will fail to find it.',

    /* ----------------------------------------------------------------- notes */
    'grokBuild.note.configPath': 'File: {path} — created on save.',

    /* ----------------------------------------------------------------- write */
    'grokBuild.write.activate': 'Grok Build reads config.toml on start. Run it with:',
    'grokBuild.write.providerSaved': 'Model block saved',
    'grokBuild.write.switched': 'Default model switched',
  },

  'zh-Hans': {
    /* --------------------------------------------------------- action detail */
    'grokBuild.action.globalDetail': '~/.grok/config.toml 中的默认模型',
    'grokBuild.action.providersDetail': '在 ~/.grok/config.toml 中添加或编辑 [model.<id>] 配置块',
    'grokBuild.action.providerAddDetail': '添加自定义模型配置块',

    /* ---------------------------------------------------------------- fields */
    'grokBuild.field.providerId': '模型 ID',
    'grokBuild.field.modelId': '模型名称',
    'grokBuild.field.displayName': '显示名称',
    'grokBuild.field.apiBackend': 'API 后端',
    'grokBuild.field.apiKey': 'API 密钥',

    /* --------------------------------------------------------------- choices */
    'grokBuild.choice.backendChatCompletions': 'chat_completions',
    'grokBuild.choice.backendResponses': 'responses',
    'grokBuild.choice.backendMessages': 'messages',

    /* ------------------------------------------------------------------ help */
    'grokBuild.help.defaultModel':
      '新会话启动时使用的模型 ID：可以是 [model.*] 配置块或内置模型。留空则删除该键。',
    'grokBuild.help.providerId':
      '将成为 [model.<id>] 表名：字母、数字、短横线和下划线。命名一个内置模型时只会覆盖你设置的字段，这正是 Grok 文档中覆盖密钥的用法。',
    'grokBuild.help.modelId':
      '发送给 API 的模型标识。/model 和 -m 选择的是配置块 ID；端点收到的是这里的值。',
    'grokBuild.help.baseUrl':
      'OpenAI 兼容端点，如 https://api.example.com/v1。内置 ID 不填则会继承内置端点。',
    'grokBuild.help.displayName': '在 Grok 模型选择器中显示的标签。',
    'grokBuild.help.apiBackend':
      'Grok 与该端点通信的协议。选择 Unmanaged 则删除该键，Grok 默认使用 chat_completions。',
    'grokBuild.help.apiKey':
      '以明文保存在 config.toml 中，ccset 打印它的所有位置都会掩码。Grok 解析凭据的顺序是 api_key、env_key、会话令牌、XAI_API_KEY。',

    /* ---------------------------------------------------------------- status */
    'grokBuild.status.noProviders': '此文件中没有 [model.*] 配置块。',
    'grokBuild.status.noConfigFile': '还没有 config.toml；首次保存时创建。',
    'grokBuild.status.noBaseUrl':
      '此配置块没有 base_url：内置 ID 会继承内置端点，自定义模型则必须提供。',
    'grokBuild.status.authTitle': 'auth.json（不受管理）',
    'grokBuild.status.authNote':
      'grok login 写入的凭据保存在这里。ccset 不会编辑此文件；ccset 保存的提供商密钥写入 config.toml。',

    /* --------------------------------------------------------------- warning */
    'grokBuild.warning.noBaseUrl':
      '模型 {name} 未设置 base_url。内置 ID 会继承内置端点；自定义模型没有它就无法连接任何端点。',
    'grokBuild.warning.modelNotInSection':
      '模型 {name} 在 config.toml 中没有对应的 [model.*] 配置块。如果它不是内置模型 ID，会话将找不到该模型。',

    /* ----------------------------------------------------------------- notes */
    'grokBuild.note.configPath': '文件：{path} — 保存时创建。',

    /* ----------------------------------------------------------------- write */
    'grokBuild.write.activate': 'Grok Build 启动时读取 config.toml。运行：',
    'grokBuild.write.providerSaved': '模型配置块已保存',
    'grokBuild.write.switched': '默认模型已切换',
  },
}
