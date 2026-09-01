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

    /* ----------------------------------------------------------------- write */
    'claudeCode.write.stateCreated': 'Created with hasCompletedOnboarding set.',
    'claudeCode.write.stateExists': 'Already present — left untouched.',
  },
}
