/**
 * opencode's own constants: the keys ccset writes for a custom provider, and
 * the values its enum fields take. Mirrors the published schema at
 * https://opencode.ai/config.json.
 */

/** Selected in the review form's `share` field. */
export const SHARE_MANUAL = 'manual'
export const SHARE_AUTO = 'auto'
export const SHARE_DISABLED = 'disabled'

/** `autoupdate` is `true | false | "notify"` in the schema. */
export const AUTOUPDATE_ON = 'true'
export const AUTOUPDATE_OFF = 'false'
export const AUTOUPDATE_NOTIFY = 'notify'

/** Blank in a choice field means "ccset does not manage this key". */
export const UNMANAGED = ''

/**
 * The AI SDK package that gives a custom provider its wire protocol. ccset's
 * users are pointing an agent at an Anthropic-compatible endpoint, so this is
 * the default; it is a suggestion, never a closed list.
 */
export const DEFAULT_PROVIDER_NPM = '@ai-sdk/anthropic'

export const PROVIDER_NPM_SUGGESTIONS = [
  '@ai-sdk/anthropic',
  '@ai-sdk/openai-compatible',
  '@ai-sdk/openai',
  '@ai-sdk/google',
]

/** `model` and `small_model` are written as "provider/model". */
export const MODEL_SEPARATOR = '/'

/**
 * Provider ids opencode ships itself. Reusing one from a ccset-managed block
 * would silently override the built-in rather than add a provider, so the name
 * field refuses them.
 */
export const RESERVED_PROVIDER_IDS = [
  'anthropic',
  'openai',
  'google',
  'azure',
  'bedrock',
  'vertex',
  'github-copilot',
  'openrouter',
]
