/**
 * pi's own strings, shipped with the module so that adding an agent stays a
 * two-file change (PRD 2.2 criterion 5). Only text naming pi, its files, or
 * its config keys belongs here; shared vocabulary comes from the shell
 * catalog.
 */
export const piMessages: Record<string, Record<string, string>> = {
  en: {
    /* --------------------------------------------------------- action detail */
    'pi.action.globalDetail': 'Startup defaults in ~/.pi/agent/settings.json',
    'pi.action.providersDetail': 'Add or edit a provider block in ~/.pi/agent/models.json',
    'pi.action.providerAddDetail': 'Add a provider block',

    /* ---------------------------------------------------------------- fields */
    'pi.field.defaultProvider': 'Default provider',
    'pi.field.defaultModel': 'Default model',
    'pi.field.defaultThinkingLevel': 'Default thinking level',
    'pi.field.providerId': 'Provider id',
    'pi.field.api': 'API type',
    'pi.field.apiKey': 'API key',
    'pi.field.models': 'Model ids',

    /* --------------------------------------------------------------- choices */
    'pi.choice.apiOpenaiCompletions': 'OpenAI Chat Completions',
    'pi.choice.apiOpenaiResponses': 'OpenAI Responses',
    'pi.choice.apiAnthropicMessages': 'Anthropic Messages',
    'pi.choice.apiGoogleGenerativeAi': 'Google Generative AI',
    'pi.choice.levelOff': 'Off',
    'pi.choice.levelMinimal': 'Minimal',
    'pi.choice.levelLow': 'Low',
    'pi.choice.levelMedium': 'Medium',
    'pi.choice.levelHigh': 'High',
    'pi.choice.levelXhigh': 'Extra high',
    'pi.choice.levelMax': 'Max',

    /* ------------------------------------------------------------------ help */
    'pi.help.defaultProvider':
      'Startup provider id from models.json or a built-in. Blank removes the key.',
    'pi.help.defaultModel': 'Startup model id. pi uses it only together with a default provider.',
    'pi.help.defaultThinkingLevel': 'Startup thinking level. Unmanaged removes the key.',
    'pi.help.providerId':
      'Becomes the key under "providers". Reusing a built-in id such as anthropic overrides it, which is how pi documents a proxy.',
    'pi.help.baseUrl': 'Endpoint root, e.g. https://api.example.com/v1.',
    'pi.help.api':
      'Wire protocol pi speaks with this provider. Required once the block serves its own models.',
    'pi.help.apiKey':
      'Accepts pi value forms: a literal, $ENV_VAR, or !command. Masked everywhere ccset prints it.',
    'pi.help.models':
      'Comma-separated ids this provider serves. Entries already on disk keep their own settings; without models the block only overrides a built-in provider.',

    /* ---------------------------------------------------------------- status */
    'pi.status.noProviders': 'No provider blocks in this file.',
    'pi.status.noBaseUrl': 'No baseUrl in this block.',
    'pi.status.noModelsFile': 'No models.json yet; providers appear here once it exists.',
    'pi.status.authTitle': 'auth.json (not managed)',
    'pi.status.authNote':
      'Credentials written by pi’s /login live here. ccset does not edit this file; provider keys ccset saves go to models.json.',

    /* --------------------------------------------------------------- warning */
    'pi.warning.noBaseUrl': 'Provider {name} has no baseUrl.',
    'pi.warning.modelNotInList':
      'Model {model} is not in provider {name}’s models; pi will fall back at startup.',

    /* -------------------------------------------------------------- validate */
    'pi.validate.providerBaseUrlRequired': 'A new provider needs --base-url.',
    'pi.validate.providerTokenRequired':
      'A new provider needs a key from CCSET_TOKEN or --token-stdin.',
    'pi.validate.apiRequired':
      'Provider {name} serves its own models, so it needs an api value; pass --api or choose one in the form.',
    'pi.validate.modelsUnreadable':
      'models.json at {path} does not parse, so no default model can be read from it; pass --model explicitly.',
    'pi.validate.providerModelRequired':
      'Provider {name} has no models ccset can read; pass --model explicitly.',

    /* ----------------------------------------------------------------- notes */
    'pi.note.settingsPath': 'File: {path} — created on save.',
    'pi.note.modelsPath': 'File: {path} — created on save.',
    'pi.note.modelsMerge':
      'Model entries already in this file keep their own settings; only the ids you list change.',

    /* ----------------------------------------------------------------- write */
    'pi.write.activate': 'pi reads these files on start. Run it with:',
    'pi.write.providerSaved': 'Provider block saved',
    'pi.write.switched': 'Default provider switched',
  },

  'zh-Hans': {
    /* --------------------------------------------------------- action detail */
    'pi.action.globalDetail': '~/.pi/agent/settings.json 中的启动默认项',
    'pi.action.providersDetail': '在 ~/.pi/agent/models.json 中添加或编辑提供商配置块',
    'pi.action.providerAddDetail': '添加提供商配置块',

    /* ---------------------------------------------------------------- fields */
    'pi.field.defaultProvider': '默认提供商',
    'pi.field.defaultModel': '默认模型',
    'pi.field.defaultThinkingLevel': '默认思考级别',
    'pi.field.providerId': '提供商 ID',
    'pi.field.api': 'API 类型',
    'pi.field.apiKey': 'API 密钥',
    'pi.field.models': '模型 ID',

    /* --------------------------------------------------------------- choices */
    'pi.choice.apiOpenaiCompletions': 'OpenAI Chat Completions',
    'pi.choice.apiOpenaiResponses': 'OpenAI Responses',
    'pi.choice.apiAnthropicMessages': 'Anthropic Messages',
    'pi.choice.apiGoogleGenerativeAi': 'Google Generative AI',
    'pi.choice.levelOff': '关闭',
    'pi.choice.levelMinimal': '极少',
    'pi.choice.levelLow': '低',
    'pi.choice.levelMedium': '中',
    'pi.choice.levelHigh': '高',
    'pi.choice.levelXhigh': '超高',
    'pi.choice.levelMax': '最大',

    /* ------------------------------------------------------------------ help */
    'pi.help.defaultProvider': '启动提供商 ID，来自 models.json 或内置提供商。留空则删除该键。',
    'pi.help.defaultModel': '启动模型 ID。pi 只有在同时设置默认提供商时才会使用它。',
    'pi.help.defaultThinkingLevel': '启动思考级别。选择 Unmanaged 则删除该键。',
    'pi.help.providerId':
      '将成为 "providers" 下的键名。复用内置 ID（如 anthropic）会覆盖内置项，这正是 pi 文档中代理的用法。',
    'pi.help.baseUrl': '端点根地址，如 https://api.example.com/v1。',
    'pi.help.api': 'pi 与该提供商通信的协议。配置块一旦带有自己的模型就需要该值。',
    'pi.help.apiKey': '支持 pi 的取值形式：字面量、$ENV_VAR 或 !command。ccset 打印它的所有位置都会掩码。',
    'pi.help.models':
      '逗号分隔的模型 ID，是该提供商提供的模型。已有条目保留各自设置；不填模型时该配置块仅用于覆盖内置提供商。',

    /* ---------------------------------------------------------------- status */
    'pi.status.noProviders': '此文件中没有提供商配置块。',
    'pi.status.noBaseUrl': '此配置块中没有 baseUrl。',
    'pi.status.noModelsFile': '还没有 models.json；文件创建后提供商会显示在这里。',
    'pi.status.authTitle': 'auth.json（不受管理）',
    'pi.status.authNote':
      'pi 的 /login 写入的凭据保存在这里。ccset 不会编辑此文件；ccset 保存的提供商密钥写入 models.json。',

    /* --------------------------------------------------------------- warning */
    'pi.warning.noBaseUrl': 'Provider {name} 没有设置 baseUrl。',
    'pi.warning.modelNotInList': '模型 {model} 不在提供商 {name} 的模型列表中；pi 启动时会自行回退。',

    /* -------------------------------------------------------------- validate */
    'pi.validate.providerBaseUrlRequired': '新建 provider 需要 --base-url。',
    'pi.validate.providerTokenRequired': '新建 provider 需要 CCSET_TOKEN 或 --token-stdin 提供的密钥。',
    'pi.validate.apiRequired':
      'Provider {name} 带有自己的模型，因此需要 api 值；请传入 --api 或在表单中选择。',
    'pi.validate.modelsUnreadable':
      '{path} 的 models.json 无法解析，因此无法从中读取默认模型；请显式传入 --model。',
    'pi.validate.providerModelRequired': 'Provider {name} 没有 ccset 可读取的模型；请显式传入 --model。',

    /* ----------------------------------------------------------------- notes */
    'pi.note.settingsPath': '文件：{path} — 保存时创建。',
    'pi.note.modelsPath': '文件：{path} — 保存时创建。',
    'pi.note.modelsMerge': '文件中已有的模型条目保留各自设置；只有你列出的 ID 会改变。',

    /* ----------------------------------------------------------------- write */
    'pi.write.activate': 'pi 启动时会读取这些文件。运行：',
    'pi.write.providerSaved': '提供商配置块已保存',
    'pi.write.switched': '默认提供商已切换',
  },
}
