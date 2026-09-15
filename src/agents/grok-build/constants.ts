/**
 * Grok Build's own constants: the files under its home directory, and the
 * values its enum-shaped config fields take. Mirrors xai-org/grok-build's
 * user-guide docs — 05-configuration.md, 11-custom-models.md, and
 * 26-config-reference.md — at main `37949780c144e37df692e3d669051a21fec24f20`
 * (2026-09-14): https://github.com/xai-org/grok-build
 */

/** Everything Grok Build reads lives under this directory inside the home. */
export const GROK_DIR_SEGMENTS = ['.grok']

export const CONFIG_FILE_NAME = 'config.toml'
export const AUTH_FILE_NAME = 'auth.json'

/**
 * Grok resolves its config directory itself: GROK_HOME when set, else ~/.grok.
 * ccset honours the override so it edits the file Grok actually reads (paths.ts
 * applies it only on the real home, keeping scratch runs deterministic).
 */
export const GROK_HOME_ENV = 'GROK_HOME'

/** Wire protocol of a [model.<id>] entry, from 11-custom-models.md. */
export const API_BACKEND_CHAT_COMPLETIONS = 'chat_completions'
export const API_BACKEND_RESPONSES = 'responses'
export const API_BACKEND_MESSAGES = 'messages'

/** Blank in a choice field means "ccset does not manage this key". */
export const UNMANAGED = ''
