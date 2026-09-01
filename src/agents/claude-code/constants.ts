/**
 * Claude Code's own constants: template defaults, the shape of its env
 * switches, and the Anthropic wire details its connection probe speaks. None of
 * these mean anything to another agent, which is why they are not in core.
 */

export const DEFAULT_CLEANUP_DAYS = 720
export const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'
export const DEFAULT_GLOBAL_MODEL = 'opus[1m]'

/** Tri-state values for the "1"/"0"/unmanaged env switches. */
export const SWITCH_ON = '1'
export const SWITCH_OFF = '0'
export const SWITCH_UNMANAGED = ''

/* ------------------------------------------------- connection probe */

export const CONNECTION_PATH = '/v1/messages'
export const ANTHROPIC_VERSION = '2023-06-01'
/** Smallest legal request; the response body is never read. */
export const PROBE_MAX_TOKENS = 1
export const PROBE_PROMPT = 'ping'
export const PROBE_FALLBACK_MODEL = 'claude-3-5-haiku-latest'
