/**
 * Codex CLI's own constants: the keys ccset writes, and the values its enum
 * fields take. Mirrors the schema Codex generates from `ConfigToml` and commits
 * at `codex-rs/core/config.schema.json` (read at v0.152.0).
 */

/** Blank in a choice field means "ccset does not manage this key". */
export const UNMANAGED = ''

/* ------------------------------------------------------------- provider */

/**
 * The only wire protocol Codex still accepts. `wire_api = "chat"` is a hard
 * error as of v0.152.0, so a provider ccset writes has to speak the OpenAI
 * Responses API -- there is no second value to offer the user.
 */
export const WIRE_API_RESPONSES = 'responses'

/**
 * Written on every ccset-managed provider, and load-bearing. Codex only falls
 * back to the credential in `auth.json` when this is true; the default, false,
 * makes a custom provider explicitly refuse ambient auth, so the block would be
 * written successfully and then fail to authenticate.
 */
export const REQUIRES_OPENAI_AUTH = true

/**
 * Provider ids Codex ships itself. `merge_configured_model_providers` refuses
 * to let a configured entry override a built-in, so reusing one of these names
 * is an error at Codex start rather than a provider ccset added.
 */
export const RESERVED_PROVIDER_IDS = [
  'openai',
  'amazon-bedrock',
  'amazon-bedrock-runtime',
  'ollama',
  'lmstudio',
  'ollama-chat',
]

/* ----------------------------------------------------------------- auth */

/** Keys inside auth.json. The API key field is spelled in upper case there. */
export const AUTH_MODE_KEY = 'auth_mode'
export const AUTH_API_KEY = 'OPENAI_API_KEY'
/** `AuthMode::ApiKey` serialises lower case. */
export const AUTH_MODE_API_KEY = 'apikey'

/**
 * When this is set to `keyring`, Codex stores the credential in the OS keyring
 * and never reads auth.json. ccset cannot write a keyring entry, so it reports
 * the setting rather than switching a profile the agent will ignore.
 */
export const AUTH_STORE_KEY = ['cli_auth_credentials_store']
export const AUTH_STORE_KEYRING = 'keyring'

/* --------------------------------------------------------------- global */

export const APPROVAL_ON_REQUEST = 'on-request'
export const APPROVAL_NEVER = 'never'

export const SANDBOX_READ_ONLY = 'read-only'
export const SANDBOX_WORKSPACE_WRITE = 'workspace-write'
export const SANDBOX_DANGER_FULL_ACCESS = 'danger-full-access'

export const VERBOSITY_LOW = 'low'
export const VERBOSITY_MEDIUM = 'medium'
export const VERBOSITY_HIGH = 'high'

/**
 * `model_reasoning_effort` is a free string in the schema -- the accepted set
 * comes from whichever model catalog is loaded -- so these are suggestions, not
 * a closed list.
 */
export const REASONING_EFFORT_SUGGESTIONS = ['minimal', 'low', 'medium', 'high', 'xhigh']

/* ----------------------------------------------------------------- bounds */

/**
 * Field-specific integer bounds. Codex's numbers do not share a scale with
 * Claude's cleanup horizon: a 200,000-token context window and a 300,000 ms
 * stream idle timeout are ordinary values, and zero is a meaningful retry
 * count ("never retry"), so each field gets its own validator and ceiling.
 */

/** A context window is a token budget; ten million is far past any model. */
export const CONTEXT_WINDOW_TOKENS_MAX = 10_000_000
/** Retries are small counts; zero is valid and means the retries are off. */
export const RETRIES_MAX = 100
/** One hour of idle-stream patience, in milliseconds. */
export const STREAM_IDLE_TIMEOUT_MS_MAX = 3_600_000

/* --------------------------------------------- other credential sources */

/**
 * Codex resolves a provider credential as `env_key` ->
 * `experimental_bearer_token` -> the ambient `auth.json`, in that order. A
 * block carrying either of the first two never reaches the credential ccset
 * saves, so a save into such a block is refused rather than misreported.
 */
export const CREDENTIAL_SOURCE_KEYS = ['env_key', 'experimental_bearer_token'] as const
