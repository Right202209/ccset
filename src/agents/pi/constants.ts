/**
 * pi's own constants: the files under its agent directory, and the values its
 * enum-shaped config fields take. Mirrors badlogic/pi-mono's coding-agent docs
 * and source — settings.md, models.md, providers.md, and
 * packages/coding-agent/src/{config,model-config,auth-storage,model-resolver}.ts
 * at main `71dca871bc80b6bc97be37f0ca3189399d651fff` (2026-09-11):
 * https://github.com/badlogic/pi-mono
 */

/** Everything pi reads lives under this directory inside the home. */
export const PI_DIR_SEGMENTS = ['.pi', 'agent']

export const SETTINGS_FILE_NAME = 'settings.json'
export const MODELS_FILE_NAME = 'models.json'
export const AUTH_FILE_NAME = 'auth.json'

/**
 * pi resolves its agent directory itself: PI_CODING_AGENT_DIR when set, else
 * ~/.pi/agent. ccset honours the override so it edits the files pi actually
 * reads (paths.ts applies it only on the real home, keeping scratch runs
 * deterministic).
 */
export const AGENT_DIR_ENV = 'PI_CODING_AGENT_DIR'

/** Wire protocol of a models.json provider, from models.md "Supported APIs". */
export const API_OPENAI_COMPLETIONS = 'openai-completions'
export const API_OPENAI_RESPONSES = 'openai-responses'
export const API_ANTHROPIC_MESSAGES = 'anthropic-messages'
export const API_GOOGLE_GENERATIVE_AI = 'google-generative-ai'

/** Blank in a choice field means "ccset does not manage this key". */
export const UNMANAGED = ''

/**
 * Template default for a new provider's wire protocol. ccset's users point an
 * agent at an Anthropic-compatible endpoint, and the field is a choice, never
 * a closed list.
 */
export const DEFAULT_PROVIDER_API = API_ANTHROPIC_MESSAGES

/** Startup thinking levels, from settings.md "Model & Thinking". */
export const THINKING_LEVELS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const
