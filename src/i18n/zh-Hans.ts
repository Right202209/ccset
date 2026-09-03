/**
 * Simplified Chinese catalog, translated from en.ts and kept key-for-key
 * identical to it by verify:i18n-zh. Terminal folding passes a non-English
 * catalog through untouched (ui/terminal.ts), so CJK text reaches a Unicode
 * terminal as written and is never transliterated for a seven-bit one.
 */
export const zhHans: Record<string, string> = {
  /* ------------------------------------------------------------- app shell */
  'app.title': 'ccset',
  'app.tagline': '写入编码 Agent 的设置文件。是否启用由你决定。',
  'app.agent': 'Agent：{name}',
  'app.busy': '处理中…',
  'app.busyConnecting': '正在连接 {host}…',
  'app.busyWriting': '正在写入 {path}…',

  /* ------------------------------------------------------------------ menu */
  'menu.exit': '退出',
  'menu.help': '↑↓ 移动 · 1-9 跳转 · enter 选择 · esc 返回',
  'key.moveUp': '上移', 'key.moveDown': '下移', 'key.jump': '跳转', 'key.select': '选择', 'key.back': '返回',
  'key.change': '切换', 'key.next': '下一项', 'key.save': '保存', 'key.cancel': '取消', 'key.continue': '继续', 'key.choose': '选择', 'key.confirm': '确认',
  'menu.notDetected': '该 Agent 尚无配置 — ccset 会创建所需的文件。',
  'menu.agentTitle': '选择 Agent',

  /* --------------------------------------------------------------- actions */
  'action.global': '全局设置',
  'action.providers': '提供商',
  'action.status': '状态',
  'action.statusDetail': '只读查看磁盘上的内容',
  'action.test': '测试连接',
  'action.testDetail': '可选的网络检查',
  'action.providerAdd': '添加提供商',
  'action.providerEdit': '编辑提供商：{name}',
  'action.clearBackups': '清除 ccset 备份',
  'action.clearBackupsDetail': '备份中可能仍存有已轮换的令牌',

  /* ---------------------------------------------------------------- fields */
  'field.globalModel': '模型',
  'field.providerName': '提供商名称',
  'field.baseUrl': '基础 URL',
  'field.token': '认证令牌',
  'field.providerModel': '模型',

  /* ------------------------------------------------------------------ help */

  /* --------------------------------------------------------------- choices */
  'choice.on': '开',
  'choice.off': '关',
  'choice.unmanaged': '不受管理',

  /* ------------------------------------------------------------------ form */
  'form.save': '保存',
  'form.cancel': '取消',
  'form.showAdvanced': '显示高级字段',
  'form.hideAdvanced': '隐藏高级字段',
  'form.help': '↑↓/tab 移动 · ←→/space 切换 · enter 下一项 · esc 取消 · * = 与磁盘不同',

  /* ----------------------------------------------------------------- hints */
  'hint.suggestions': '建议：{list}',
  'hint.empty': '（留空 — 省略该键）',
  'hint.toggle': '  ←→/space 切换',

  /* ------------------------------------------------------------------ list */
  'list.empty': '没有可显示的内容。',
  'list.count': '显示 {start}-{end}，共 {total} 项',

  /* ---------------------------------------------------------------- status */
  'status.globalTitle': '全局设置',
  'status.providersTitle': '提供商',
  'status.providerTitle': '提供商：{name}',
  'status.backupsTitle': 'ccset 备份',
  'status.path': '路径',
  'status.present': '存在',
  'status.absent': '不存在',
  'status.mode': '权限',
  'status.count': '文件数',
  'status.command': '启用命令',
  'status.error': '错误',
  'status.onboarding': '初始设置已完成',
  'status.yes': '是',
  'status.no': '否',
  'status.unset': '（未设置）',
  'status.disabled': '关',
  'status.unreadable': '无法读取',
  'status.parseError': '不是有效的 JSON（{detail}）。',
  'status.parseErrorToml': '不是有效的 TOML（{detail}）。',
  'status.readError': '无法读取。',
  'status.fixHint': '手动应用：{fix}',
  'status.unmanagedNote': '每次保存都会原样保留 {count} 个 ccset 不管理的键。',
  'status.backupsNote': '备份中可能仍含有你已轮换的令牌。',
  'status.partials': '不完整的副本',
  'status.partialsNote': '{count} 个不完整的备份存有凭据；“清除 ccset 备份”可删除它们。',
  'status.help': '↑↓ 移动 · enter 选择 · esc 返回',

  /* ----------------------------------------------------------------- notes */
  'note.globalPath': '文件：{path}',
  'note.preserved': 'ccset 不管理的键会按磁盘上的原样保留。',
  'note.fixByHand': '手动修复该文件，或删除它后重新添加提供商。',

  /* ----------------------------------------------------------------- write */
  'write.globalSaved': '全局设置已保存',
  'write.providerSaved': '提供商已保存',
  'write.path': '路径：{path}',
  'write.mode': '权限：{mode}',
  'write.backup': '备份：{path}',
  'write.noBackup': '备份：无（文件原先不存在）',
  'write.activate': '启用命令：',
  'write.backupsCleared': '已删除 {count} 个备份文件。',

  /* --------------------------------------------------------------- confirm */
  'confirm.clear': '删除这些备份',
  'confirm.clearBackups': '这将永久删除所有 ccset 备份，包括你可能还需要的设置副本。',
  'confirm.send': '发送请求',
  'confirm.testHost': '目标主机：{host}',
  'confirm.testToken': '发送的令牌：{token}',
  'confirm.testWarning': '这会把真实凭据发送到第三方主机。在你确认之前不会发送任何内容。',
  'confirm.freshTitle': '文件不是有效的 JSON',
  'confirm.freshTitleToml': '文件不是有效的 TOML',
  'confirm.freshExplain': 'ccset 不会静默覆盖它。继续会先备份该文件，再写入一个只包含此表单内容的新文件 — 损坏文件中的其他所有键都会丢失。',
  'confirm.fresh': '备份后重新开始',

  /* ---------------------------------------------------------------- prompt */
  'prompt.exitTitle': '未保存的修改',
  'prompt.exitLine': '此表单中有尚未写入磁盘的修改。',
  'prompt.exitConfirm': '放弃并退出',
  'prompt.discardTitle': '未保存的修改',
  'prompt.discardLine': '此表单中有尚未写入磁盘的修改。',
  'prompt.discardConfirm': '放弃并返回',
  'prompt.stay': '继续编辑',

  /* ----------------------------------------------------------------- probe */
  'probe.host': '主机：{host}',
  'probe.status': '状态：{status}',
  'probe.noBody': '响应正文未经读取即被丢弃 — 它可能把令牌回显出来。',
  'probe.noTargets': '没有提供商文件带有可测试的 base URL。',
  'probe.ok': '可连接，令牌已被接受。',
  'probe.authRejected': '可连接，但令牌被拒绝。',
  'probe.notFound': '可连接，但 /v1/messages 不存在 — 请检查 base URL。',
  'probe.reachableBadRequest': '可连接且已通过认证；探测请求本身被拒绝（通常是模型名的问题）。',
  'probe.rateLimited': '可连接，但被限流。',
  'probe.serverError': '可连接，但提供商返回了服务器错误。',
  'probe.unexpectedStatus': '可连接；该状态码不在 ccset 的识别范围内。',
  'probe.timeout': '在超时之前没有收到响应。',
  'probe.dns': '主机名无法解析。',
  'probe.refused': '连接被拒绝。',
  'probe.reset': '连接被重置。',
  'probe.tls': 'TLS 证书被拒绝。',
  'probe.networkError': '请求在收到响应前失败。',

  /* -------------------------------------------------------------- validate */
  'validate.required': '必填。',
  'validate.nameEmpty': '需要提供商名称。',
  'validate.namePathSeparator': '名称不能包含路径分隔符。',
  'validate.nameCharset': '只能使用字母、数字、- 和 _。',
  'validate.nameReserved': '保留名称 — 会与该 Agent 使用的名称冲突。',
  'validate.urlEmpty': '需要 base URL。',
  'validate.urlMalformed': '不是有效的 URL。',
  'validate.urlProtocol': '只允许 http:// 和 https://。',
  'validate.urlHost': 'URL 没有主机名。',
  'validate.notInteger': '只能是整数。',
  'validate.notPositive': '必须大于零。',
  'validate.tooLarge': '超出了 ccset 接受的范围。',

  /* ----------------------------------------------------------------- error */
  'error.permission': '权限被拒绝：{path}（需要 {mode}）。',
  'error.invalidJson': '不是有效的 JSON：{path}（{position}）。',
  'error.invalidToml': '不是有效的 TOML：{path}（{position}）。',
  'error.unwritableValue': '{type} 类型的值无法写入这种文件格式。',
  'error.io': '无法访问 {path}（{code}）。',
  'error.unexpected': '意外失败（{detail}）。',
  'error.unsupportedCodec': '不支持的序列化格式（{codec}）。',
  'error.unknownAgent': '未知 Agent：{id}。',
  'error.screenTitle': '操作失败',
  'error.screenHint': '你输入的内容没有丢失 — 返回后重试即可。',

  /* ------------------------------------------------------------ non-interactive */
  'cmd.flag.dryRun': '显示将要更改的内容但不写入',
  'cmd.flag.json': '输出机器可读的 JSON',
  'cmd.flag.replaceInvalid': '用新文件替换无法读取的目标',
  'cmd.flag.unset': '移除一个字段（可重复）',
  'output.changed': '已更改：{path}',
  'output.unchanged': '未更改：{path}',
  'output.wouldChange': '将更改：{path}',
  'output.dryRun': '（试运行 — 未写入任何文件）',
  'warn.replacedInvalid': '用新文件替换无法读取的文件：{path}',

  /* ------------------------------------------------------------- error (new) */
  'error.unknownCommand': '未知命令：{command}。可用命令：{available}。',
  'error.agentRequired': '请用 --agent <id> 指定 Agent。',
  'error.agentNoCommands': '{agent} 没有非交互式命令。',
  'error.noCommand': '未指定命令。',
  'error.unknownOption': '未知选项：{option}。',
  'error.missingValue': '{option} 需要一个值。',
  'error.duplicateOption': '{option} 被指定了多次。',
  'error.noValueExpected': '{option} 不接受值。',
  'error.unexpectedArgument': '多余的参数：{value}。',
  'error.unknownField': '未知字段：{value}。',
  'error.requiredField': '缺少必填字段：{option}。',
  'error.emptyPatch': '未指定字段 — 无事可做。',
  'error.emptyValue': '{option} 不接受空值 — 请用 --unset 移除。',
  'error.invalidChoice': '{option} 必须是：{choices} 之一。',
  'error.conflictSetUnset': '不能同时设置和取消同一字段：{field}。',

  /* --------------------------------------------------------------- message */
  'message.continue': 'enter 继续 · esc 返回',

  /* ------------------------------------------------------------------- cli */
  'cli.description': '生成并编辑编码 Agent 的设置文件。',
  'cli.agentOption': '要配置的 Agent',
  'cli.notTty':
    'ccset 是交互式的，需要终端。请直接运行它，而不是通过管道或 CI 任务。',
}
