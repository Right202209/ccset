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
}
