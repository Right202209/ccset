/**
 * English catalog. Every user-facing string resolves through t() and lives
 * here (PRD 5.5); a second locale is a new file plus one line in index.ts.
 * No locale detection in v1.
 */
export const en: Record<string, string> = {
  /* ------------------------------------------------------------- app shell */
  'app.title': 'ccset',
  'app.tagline': 'Writes coding-agent settings files. Activation stays yours.',
  'app.agent': 'Agent: {name}',
  'app.busy': 'Working…',
  'app.busyConnecting': 'Connecting to {host}…',
  'app.busyWriting': 'Writing {path}…',

  /* ------------------------------------------------------------------ menu */
  'menu.exit': 'Exit',
  'menu.help': '↑↓ move · 1-9 jump · enter select · esc back',
  'key.moveUp': 'move up', 'key.moveDown': 'move down', 'key.jump': 'jump', 'key.select': 'select', 'key.back': 'back',
  'key.change': 'change', 'key.next': 'next', 'key.save': 'save', 'key.cancel': 'cancel', 'key.continue': 'continue', 'key.choose': 'choose', 'key.confirm': 'confirm',
  'menu.notDetected': 'No config for this agent yet — ccset will create what it needs.',
  'menu.agentTitle': 'Select an agent',

  /* --------------------------------------------------------------- actions */
  'action.global': 'Global settings',
  'action.providers': 'Providers',
  'action.status': 'Status',
  'action.statusDetail': 'Read-only view of what is on disk',
  'action.test': 'Test connection',
  'action.testDetail': 'Opt-in network check',
  'action.providerAdd': 'Add a provider',
  'action.providerEdit': 'Edit provider: {name}',
  'action.clearBackups': 'Clear ccset backups',
  'action.clearBackupsDetail': 'Backups can still hold a rotated token',

  /* ---------------------------------------------------------------- fields */
  'field.globalModel': 'Model',
  'field.providerName': 'Provider name',
  'field.baseUrl': 'Base URL',
  'field.token': 'Auth token',
  'field.providerModel': 'Model',

  /* ------------------------------------------------------------------ help */

  /* --------------------------------------------------------------- choices */
  'choice.on': 'On',
  'choice.off': 'Off',
  'choice.unmanaged': 'Unmanaged',

  /* ------------------------------------------------------------------ form */
  'form.save': 'Save',
  'form.cancel': 'Cancel',
  'form.showAdvanced': 'Show advanced fields',
  'form.hideAdvanced': 'Hide advanced fields',
  'form.help': '↑↓/tab move · ←→/space change · enter next · esc cancel · * = differs from disk',

  /* ----------------------------------------------------------------- hints */
  'hint.suggestions': 'Suggestions: {list}',
  'hint.empty': '(blank — key omitted)',
  'hint.toggle': '  ←→/space to toggle',

  /* ------------------------------------------------------------------ list */
  'list.empty': 'Nothing to show.',
  'list.count': 'Showing {start}-{end} of {total}',

  /* ---------------------------------------------------------------- status */
  'status.globalTitle': 'Global settings',
  'status.providersTitle': 'Providers',
  'status.providerTitle': 'Provider: {name}',
  'status.backupsTitle': 'ccset backups',
  'status.path': 'Path',
  'status.present': 'Present',
  'status.absent': 'absent',
  'status.mode': 'Mode',
  'status.count': 'Files',
  'status.command': 'Activate with',
  'status.error': 'Error',
  'status.onboarding': 'Onboarding completed',
  'status.yes': 'yes',
  'status.no': 'no',
  'status.unset': '(unset)',
  'status.disabled': 'off',
  'status.unreadable': 'unreadable',
  'status.parseError': 'Not valid JSON ({detail}).',
  'status.parseErrorToml': 'Not valid TOML ({detail}).',
  'status.readError': 'Could not be read.',
  'status.fixHint': 'Apply by hand: {fix}',
  'status.unmanagedNote': '{count} key(s) ccset does not manage are preserved on every save.',
  'status.backupsNote': 'A backup can still contain a token you have since rotated.',
  'status.partials': 'Partial copies',
  'status.partialsNote': '{count} partial backup(s) hold a credential; Clear ccset backups removes them.',
  'status.help': '↑↓ move · enter select · esc back',

  /* ----------------------------------------------------------------- notes */
  'note.globalPath': 'File: {path}',
  'note.preserved': 'Keys ccset does not manage are preserved exactly as they are on disk.',
  'note.fixByHand': 'Fix the file by hand, or delete it and add the provider again.',

  /* ----------------------------------------------------------------- write */
  'write.globalSaved': 'Global settings saved',
  'write.providerSaved': 'Provider saved',
  'write.path': 'Path:   {path}',
  'write.mode': 'Mode:   {mode}',
  'write.backup': 'Backup: {path}',
  'write.noBackup': 'Backup: none (the file did not exist)',
  'write.activate': 'Activate it with:',
  'write.backupsCleared': 'Removed {count} backup file(s).',

  /* --------------------------------------------------------------- confirm */
  'confirm.clear': 'Delete the backups',
  'confirm.clearBackups': 'This permanently deletes every ccset backup, including copies of settings you may still want.',
  'confirm.send': 'Send the request',
  'confirm.testHost': 'Destination host: {host}',
  'confirm.testToken': 'Token sent:      {token}',
  'confirm.testWarning': 'This transmits a live credential to a third-party host. Nothing is sent until you confirm.',
  'confirm.freshTitle': 'File is not valid JSON',
  'confirm.freshTitleToml': 'File is not valid TOML',
  'confirm.freshExplain': 'ccset will not overwrite it silently. Continuing backs the file up, then writes a fresh one containing only the settings on this form — every other key in the broken file is lost.',
  'confirm.fresh': 'Back it up and start fresh',

  /* ---------------------------------------------------------------- prompt */
  'prompt.exitTitle': 'Unsaved edits',
  'prompt.exitLine': 'This form holds edits that have not been written to disk.',
  'prompt.exitConfirm': 'Discard them and exit',
  'prompt.discardTitle': 'Unsaved edits',
  'prompt.discardLine': 'This form holds edits that have not been written to disk.',
  'prompt.discardConfirm': 'Discard them and go back',
  'prompt.stay': 'Keep editing',

  /* ----------------------------------------------------------------- probe */
  'probe.host': 'Host:   {host}',
  'probe.status': 'Status: {status}',
  'probe.noBody': 'The response body was discarded unread — it can echo the token back.',
  'probe.noTargets': 'No provider file has a base URL to test.',
  'probe.ok': 'Reachable, and the token was accepted.',
  'probe.authRejected': 'Reachable, but the token was rejected.',
  'probe.notFound': 'Reachable, but /v1/messages is not there — check the base URL.',
  'probe.reachableBadRequest': 'Reachable and authenticated; the probe request itself was rejected (model name is the usual cause).',
  'probe.rateLimited': 'Reachable, but rate limited.',
  'probe.serverError': 'Reachable, but the provider returned a server error.',
  'probe.unexpectedStatus': 'Reachable; the status is not one ccset interprets.',
  'probe.timeout': 'No response before the timeout.',
  'probe.dns': 'The host name did not resolve.',
  'probe.refused': 'The connection was refused.',
  'probe.reset': 'The connection was reset.',
  'probe.tls': 'The TLS certificate was rejected.',
  'probe.networkError': 'The request failed before a response arrived.',

  /* -------------------------------------------------------------- validate */
  'validate.required': 'Required.',
  'validate.nameEmpty': 'A provider name is required.',
  'validate.namePathSeparator': 'A name cannot contain a path separator.',
  'validate.nameCharset': 'Use letters, digits, - and _ only.',
  'validate.nameReserved': 'Reserved — it would collide with a name this agent uses.',
  'validate.urlEmpty': 'A base URL is required.',
  'validate.urlMalformed': 'Not a valid URL.',
  'validate.urlProtocol': 'Only http:// and https:// are allowed.',
  'validate.urlHost': 'The URL has no host.',
  'validate.notInteger': 'Whole numbers only.',
  'validate.notPositive': 'Must be greater than zero.',
  'validate.tooLarge': 'That is larger than ccset accepts.',

  /* ----------------------------------------------------------------- error */
  'error.permission': 'Permission denied: {path} (needs {mode}).',
  'error.invalidJson': 'Not valid JSON: {path} ({position}).',
  'error.invalidToml': 'Not valid TOML: {path} ({position}).',
  'error.unwritableValue': 'A {type} value cannot be written to this file format.',
  'error.io': 'Could not access {path} ({code}).',
  'error.unexpected': 'Unexpected failure ({detail}).',
  'error.unsupportedCodec': 'Unsupported serialization format ({codec}).',
  'error.unknownAgent': 'Unknown agent: {id}.',
  'error.screenTitle': 'Action failed',
  'error.screenHint': 'Nothing you typed was lost — go back and try again.',

  /* --------------------------------------------------------------- message */
  'message.continue': 'enter to continue · esc back',

  /* ------------------------------------------------------------------- cli */
  'cli.description': 'Generate and edit coding-agent settings files.',
  'cli.agentOption': 'agent to configure',
  'cli.notTty':
    'ccset is interactive and needs a terminal. Run it directly rather than through a pipe or a CI job.',
}
