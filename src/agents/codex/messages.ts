/**
 * Codex CLI's own strings, shipped with the module so that adding an agent
 * stays a two-file change (PRD 2.2 criterion 5). Only text naming Codex, its
 * files, or its config keys belongs here; shared vocabulary comes from the
 * shell catalog.
 */
export const codexMessages: Record<string, Record<string, string>> = {
  en: {
    /* --------------------------------------------------------- action detail */
    'codex.action.globalDetail': '~/.codex/config.toml',
    'codex.action.providersDetail': 'Add, edit or switch to a provider',
    'codex.action.providerAddDetail': 'Add a [model_providers.<id>] table',
    'codex.action.edit': 'Edit settings',
    'codex.action.editDetail': 'Endpoint, key and retry limits',
    'codex.action.use': 'Use {id}',
    'codex.action.useDetail': 'Make this the live credential and the routed provider',
    'codex.action.removeProfile': 'Remove the saved credential',
    'codex.action.removeProfileDetail': 'Deletes the auth profile; the provider block stays',

    /* ---------------------------------------------------------------- fields */
    'codex.field.modelProvider': 'Model provider',
    'codex.field.reasoningEffort': 'Reasoning effort',
    'codex.field.approvalPolicy': 'Approval policy',
    'codex.field.sandboxMode': 'Sandbox mode',
    'codex.field.verbosity': 'Verbosity',
    'codex.field.contextWindow': 'Context window (tokens)',
    'codex.field.providerId': 'Provider id',
    'codex.field.displayName': 'Provider label',
    'codex.field.apiKey': 'API key',
    'codex.field.wireApi': 'Wire protocol',
    'codex.field.requiresOpenaiAuth': 'Uses auth.json',
    'codex.field.requestMaxRetries': 'Request retries',
    'codex.field.streamMaxRetries': 'Stream retries',
    'codex.field.streamIdleTimeoutMs': 'Stream idle timeout (ms)',
    'codex.field.adoptName': 'Save the current auth.json as',

    /* --------------------------------------------------------------- choices */
    'codex.choice.approvalOnRequest': 'Ask when the model asks',
    'codex.choice.approvalNever': 'Never ask',
    'codex.choice.sandboxReadOnly': 'Read-only',
    'codex.choice.sandboxWorkspaceWrite': 'Workspace write',
    'codex.choice.sandboxFullAccess': 'Full access (no sandbox)',
    'codex.choice.verbosityLow': 'Low',
    'codex.choice.verbosityMedium': 'Medium',
    'codex.choice.verbosityHigh': 'High',

    /* ------------------------------------------------------------------ help */
    'codex.help.globalModel': 'Model id, e.g. gpt-5.6. Must be one this provider serves.',
    'codex.help.modelProvider':
      'Key under model_providers. Switching a provider sets this for you.',
    'codex.help.reasoningEffort':
      'Accepted values come from the model, not from ccset. Blank removes the key.',
    'codex.help.approvalPolicy': 'When Codex stops to ask before running a command.',
    'codex.help.sandboxMode': 'What Codex may write while a command runs.',
    'codex.help.verbosity': 'Response length hint for GPT-5 models. Blank removes the key.',
    'codex.help.contextWindow': 'Blank removes the key. Codex then uses the model default.',
    'codex.help.providerId':
      'Becomes the [model_providers.<id>] table name. Letters, digits, - and _ only.',
    'codex.help.displayName': 'Shown by Codex when it names the provider. Blank removes the key.',
    'codex.help.baseUrl': 'Endpoint root ending in /v1 — Codex appends /responses to it.',
    'codex.help.apiKey':
      'Saved to ~/.codex/auth.<id>.json, not to config.toml. Masked everywhere ccset prints it.',
    'codex.help.retries': 'Blank removes the key. Codex then uses its own default.',
    'codex.help.streamIdleTimeout': 'How long to wait on a silent stream before retrying.',
    'codex.help.adoptName': 'Blank skips saving it. A backup is taken either way.',

    /* ---------------------------------------------------------------- status */
    'codex.status.noProviders': 'No [model_providers] tables in this file.',
    'codex.status.noBaseUrl': 'No base_url in this table.',
    'codex.status.noAmbientAuth':
      'requires_openai_auth is not set, so Codex will not read auth.json for this provider.',
    'codex.status.noProfileFor':
      'No saved credential for {id}. Edit the provider and enter its API key first.',
    'codex.status.authTitle': 'Live credential',
    'codex.status.authMode': 'Auth mode',
    'codex.status.activeProfile': 'Matches profile',
    'codex.status.noActiveProfile': 'none — not one of the saved profiles',
    'codex.status.authNote':
      'Codex reads this file on start. ccset replaces it whole when you switch provider, and never edits it in place.',
    'codex.status.profilesTitle': 'Saved credentials',
    'codex.status.profilesNote': 'One per provider, at mode 0600. Switching copies one into place.',
    'codex.status.noProfiles': 'None saved yet.',
    'codex.status.keyringTitle': 'Credential store (not managed)',
    'codex.status.keyringLabel': 'cli_auth_credentials_store',
    'codex.status.keyringNote':
      'Codex is set to keep credentials in the OS keyring, so it does not read auth.json. ccset cannot write a keyring entry — switching a profile here would change nothing.',
    'codex.status.homeOverrideTitle': 'CODEX_HOME is set (not followed)',
    'codex.status.homeOverrideLabel': 'CODEX_HOME',
    'codex.status.homeOverrideNote':
      'Codex reads its config from there, but ccset writes under the home this run was given — so a save here may not be the config Codex loads. Unset the variable, or edit that directory by hand.',

    /* ----------------------------------------------------------------- notes */
    'codex.note.configPath': 'File: {path} — created on save.',
    'codex.note.keyGoesToProfile':
      'The key is written to ~/.codex/auth.<id>.json. Codex reads it only after you switch to this provider.',
    'codex.note.wireApi':
      'Written with wire_api = "responses" and requires_openai_auth = true — the endpoint has to speak the OpenAI Responses API.',
    'codex.note.adoptFound':
      'auth.json currently holds an auth_mode of "{mode}" that is not one of the saved profiles.',
    'codex.note.adoptSkip': 'Name it to keep it as a switchable profile, or leave this blank.',

    /* ----------------------------------------------------------------- write */
    'codex.write.activate': 'Codex reads both files on start. Run it with:',
    'codex.write.authProfile': 'Key:    {path}',
    'codex.write.switched': 'Provider switched',
    'codex.write.authSwitched': 'Auth:   {path}',
    'codex.write.authBackup': 'Auth backup: {path}',
    'codex.write.routed': 'model_provider is now "{id}".',
    'codex.write.adopted': 'Kept the previous credential at {path}',
    'codex.write.profileRemoved': 'Removed the saved credential for {id}.',
    'codex.write.profileAbsent': 'There was no saved credential for {id}.',

    /* --------------------------------------------------------------- confirm */
    'codex.confirm.switchAuth': 'This replaces {path} with this provider’s saved credential.',
    'codex.confirm.switchRouting': 'model_provider in config.toml will be set to "{id}".',
    'codex.confirm.switch': 'Switch to it',
    'codex.confirm.removeProfile':
      'This deletes the saved credential for {id}. The provider block in config.toml is left alone.',
    'codex.confirm.remove': 'Delete the credential',

    /* ------------------------------------------------------------------ busy */
    'codex.busy.switching': 'Switching to {id}…',
  },

  'zh-Hans': {
    /* --------------------------------------------------------- action detail */
    'codex.action.globalDetail': '~/.codex/config.toml',
    'codex.action.providersDetail': '添加、编辑或切换提供商',
    'codex.action.providerAddDetail': '添加 [model_providers.<id>] 表',
    'codex.action.edit': '编辑设置',
    'codex.action.editDetail': '端点、密钥与重试限制',
    'codex.action.use': '使用 {id}',
    'codex.action.useDetail': '把它设为当前凭据，并把请求路由到该提供商',
    'codex.action.removeProfile': '移除已保存的凭据',
    'codex.action.removeProfileDetail': '删除该凭据配置；提供商配置块保留',

    /* ---------------------------------------------------------------- fields */
    'codex.field.modelProvider': '模型提供商',
    'codex.field.reasoningEffort': '推理强度',
    'codex.field.approvalPolicy': '审批策略',
    'codex.field.sandboxMode': '沙箱模式',
    'codex.field.verbosity': '回复详略',
    'codex.field.contextWindow': '上下文窗口（token）',
    'codex.field.providerId': '提供商 ID',
    'codex.field.displayName': '提供商标签',
    'codex.field.apiKey': 'API 密钥',
    'codex.field.wireApi': '通信协议',
    'codex.field.requiresOpenaiAuth': '使用 auth.json',
    'codex.field.requestMaxRetries': '请求重试次数',
    'codex.field.streamMaxRetries': '流式重试次数',
    'codex.field.streamIdleTimeoutMs': '流空闲超时（毫秒）',
    'codex.field.adoptName': '将当前 auth.json 保存为',

    /* --------------------------------------------------------------- choices */
    'codex.choice.approvalOnRequest': '模型发出请求时询问',
    'codex.choice.approvalNever': '从不询问',
    'codex.choice.sandboxReadOnly': '只读',
    'codex.choice.sandboxWorkspaceWrite': '工作区可写',
    'codex.choice.sandboxFullAccess': '完全访问（无沙箱）',
    'codex.choice.verbosityLow': '低',
    'codex.choice.verbosityMedium': '中',
    'codex.choice.verbosityHigh': '高',

    /* ------------------------------------------------------------------ help */
    'codex.help.globalModel': '模型 ID，例如 gpt-5.6。必须是该提供商支持的模型。',
    'codex.help.modelProvider': 'model_providers 下的键。切换提供商时会自动设置。',
    'codex.help.reasoningEffort': '可接受的值来自模型，而不是 ccset。留空则删除该键。',
    'codex.help.approvalPolicy': 'Codex 在运行命令前何时停下来询问。',
    'codex.help.sandboxMode': '命令运行期间 Codex 可以写入什么。',
    'codex.help.verbosity': 'GPT-5 模型的回复长度提示。留空则删除该键。',
    'codex.help.contextWindow': '留空则删除该键，Codex 使用模型默认值。',
    'codex.help.providerId': '将成为 [model_providers.<id>] 表名。只能使用字母、数字、- 和 _。',
    'codex.help.displayName': 'Codex 提到该提供商时显示的名称。留空则删除该键。',
    'codex.help.baseUrl': '以 /v1 结尾的端点根地址 — Codex 会在其后追加 /responses。',
    'codex.help.apiKey': '保存到 ~/.codex/auth.<id>.json，而不是 config.toml。ccset 打印它的所有位置都会掩码。',
    'codex.help.retries': '留空则删除该键，Codex 使用自己的默认值。',
    'codex.help.streamIdleTimeout': '流静默多久后重试。',
    'codex.help.adoptName': '留空则不保存。无论如何都会先备份。',

    /* ---------------------------------------------------------------- status */
    'codex.status.noProviders': '此文件中没有 [model_providers] 表。',
    'codex.status.noBaseUrl': '此表中没有 base_url。',
    'codex.status.noAmbientAuth': '未设置 requires_openai_auth，因此 Codex 不会为该提供商读取 auth.json。',
    'codex.status.noProfileFor': '{id} 没有已保存的凭据。请先编辑该提供商并填入它的 API 密钥。',
    'codex.status.authTitle': '当前凭据',
    'codex.status.authMode': '认证方式',
    'codex.status.activeProfile': '匹配的凭据配置',
    'codex.status.noActiveProfile': '无 — 不属于任何已保存的凭据配置',
    'codex.status.authNote': 'Codex 在启动时读取此文件。切换提供商时 ccset 会整体替换它，绝不就地编辑。',
    'codex.status.profilesTitle': '已保存的凭据',
    'codex.status.profilesNote': '每个提供商一份，权限 0600。切换时会把其中一份复制到位。',
    'codex.status.noProfiles': '尚未保存任何凭据。',
    'codex.status.keyringTitle': '凭据存储（不受管理）',
    'codex.status.keyringLabel': 'cli_auth_credentials_store',
    'codex.status.keyringNote':
      'Codex 被设置为把凭据保存在操作系统钥匙串中，因此不会读取 auth.json。ccset 无法写入钥匙串条目 — 在这里切换凭据配置不会产生任何效果。',
    'codex.status.homeOverrideTitle': '已设置 CODEX_HOME（不跟随）',
    'codex.status.homeOverrideLabel': 'CODEX_HOME',
    'codex.status.homeOverrideNote':
      'Codex 从那里读取配置，但 ccset 写入的是本次运行指定的主目录 — 因此这里保存的内容可能不是 Codex 加载的配置。请取消设置该变量，或手动编辑那个目录。',

    /* ----------------------------------------------------------------- notes */
    'codex.note.configPath': '文件：{path} — 保存时创建。',
    'codex.note.keyGoesToProfile': '密钥会写入 ~/.codex/auth.<id>.json。只有在你切换到该提供商之后 Codex 才会读取它。',
    'codex.note.wireApi': '以 wire_api = "responses" 和 requires_openai_auth = true 写入 — 端点必须支持 OpenAI Responses API。',
    'codex.note.adoptFound': 'auth.json 当前的 auth_mode 是"{mode}"，不属于任何已保存的凭据配置。',
    'codex.note.adoptSkip': '为它取个名字即可保存为可切换的凭据配置，或留空。',

    /* ----------------------------------------------------------------- write */
    'codex.write.activate': 'Codex 启动时会读取这两个文件。运行：',
    'codex.write.authProfile': '密钥：{path}',
    'codex.write.switched': '提供商已切换',
    'codex.write.authSwitched': '凭据：{path}',
    'codex.write.authBackup': '凭据备份：{path}',
    'codex.write.routed': 'model_provider 现为"{id}"。',
    'codex.write.adopted': '已把原有凭据保留在 {path}',
    'codex.write.profileRemoved': '已删除 {id} 的已保存凭据。',
    'codex.write.profileAbsent': '{id} 本来就没有已保存的凭据。',

    /* --------------------------------------------------------------- confirm */
    'codex.confirm.switchAuth': '这会用该提供商保存的凭据替换 {path}。',
    'codex.confirm.switchRouting': 'config.toml 中的 model_provider 将被设为"{id}"。',
    'codex.confirm.switch': '切换到它',
    'codex.confirm.removeProfile': '这将删除 {id} 的已保存凭据。config.toml 中的提供商配置块不受影响。',
    'codex.confirm.remove': '删除凭据',

    /* ------------------------------------------------------------------ busy */
    'codex.busy.switching': '正在切换到 {id}…',
  },
}
