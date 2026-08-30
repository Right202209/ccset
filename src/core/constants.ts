/** Named constants. No magic numbers anywhere else in the codebase. */

/** POSIX mode for every file ccset writes that can hold a credential. */
export const FILE_MODE = 0o600
/** POSIX mode for ccset-owned directories. */
export const DIR_MODE = 0o700

/** Backups kept per configuration file, pruned oldest-first. */
export const MAX_BACKUPS = 10

/* -------------------------------------------------- Claude Code defaults */

export const DEFAULT_CLEANUP_DAYS = 720
export const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'
export const DEFAULT_GLOBAL_MODEL = 'opus[1m]'

/** Tri-state values for the "1"/"0"/unmanaged env switches. */
export const SWITCH_ON = '1'
export const SWITCH_OFF = '0'
export const SWITCH_UNMANAGED = ''

/* ------------------------------------------------------------- filenames */

export const CLAUDE_DIR_NAME = '.claude'
export const CLAUDE_STATE_FILE = '.claude.json'
export const GLOBAL_SETTINGS_FILE = 'settings.json'
export const SETTINGS_PREFIX = 'settings.'
export const SETTINGS_SUFFIX = '.json'
export const BACKUP_INFIX = '.backup.'
export const BACKUPS_DIR_SEGMENTS = ['backups', 'ccset']

/** Names that would collide with a file Claude Code uses conventionally. */
export const RESERVED_PROVIDER_NAMES = ['local', 'json']
export const PROVIDER_NAME_PATTERN = /^[A-Za-z0-9_-]+$/

/* ------------------------------------------------------------- masking */

/** Characters shown at each end of a secret. */
export const MASK_VISIBLE_CHARS = 4
/** Fixed-width middle run, so masking never encodes the true length. */
export const MASK_MIDDLE_WIDTH = 8
export const MASK_CHAR = '•'

/* ---------------------------------------------------------- connection */

export const CONNECTION_TIMEOUT_MS = 10_000
export const CONNECTION_PATH = '/v1/messages'
export const ANTHROPIC_VERSION = '2023-06-01'
/** Smallest legal request; the response body is never read. */
export const PROBE_MAX_TOKENS = 1
export const PROBE_PROMPT = 'ping'
export const PROBE_FALLBACK_MODEL = 'claude-3-5-haiku-latest'

/* ---------------------------------------------------------------- misc */

export const ALLOWED_URL_PROTOCOLS = ['http:', 'https:']
export const MAX_BACKUP_NAME_ATTEMPTS = 1000
export const CLEANUP_DAYS_MAX = 36_500
