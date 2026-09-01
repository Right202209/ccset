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
}
