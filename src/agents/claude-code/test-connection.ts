import {
  ANTHROPIC_VERSION,
  CONNECTION_PATH,
  CONNECTION_TIMEOUT_MS,
  PROBE_FALLBACK_MODEL,
  PROBE_MAX_TOKENS,
  PROBE_PROMPT,
} from '../../core/constants.js'
import { errorCode } from '../../core/errors.js'
import { joinUrl, validateBaseUrl } from '../../core/validate.js'

export interface ProbeTarget {
  baseUrl: string
  token: string
  model: string
}

export interface ProbeResult {
  ok: boolean
  status: number | null
  /** i18n key interpreting the outcome in one line. */
  key: string
  host: string
}

/** Status -> interpretation, as a table so the mapping stays flat. */
const STATUS_KEYS: Array<[number, number, string]> = [
  [200, 299, 'probe.ok'],
  [400, 400, 'probe.reachableBadRequest'],
  [401, 401, 'probe.authRejected'],
  [403, 403, 'probe.authRejected'],
  [404, 404, 'probe.notFound'],
  [422, 422, 'probe.reachableBadRequest'],
  [429, 429, 'probe.rateLimited'],
  [500, 599, 'probe.serverError'],
]

function interpretStatus(status: number): string {
  const match = STATUS_KEYS.find(([low, high]) => status >= low && status <= high)
  return match?.[2] ?? 'probe.unexpectedStatus'
}

const NETWORK_KEYS: Record<string, string> = {
  ENOTFOUND: 'probe.dns',
  EAI_AGAIN: 'probe.dns',
  ECONNREFUSED: 'probe.refused',
  ECONNRESET: 'probe.reset',
  CERT_HAS_EXPIRED: 'probe.tls',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'probe.tls',
}

function interpretError(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  if (name === 'TimeoutError' || name === 'AbortError') return 'probe.timeout'
  const cause = err instanceof Error ? (err as { cause?: unknown }).cause : undefined
  const code = errorCode(cause) ?? errorCode(err)
  return (code !== undefined ? NETWORK_KEYS[code] : undefined) ?? 'probe.networkError'
}

export function probeHost(baseUrl: string): string {
  try {
    return new URL(baseUrl.trim()).host
  } catch {
    return baseUrl.trim()
  }
}

function probeBody(model: string): string {
  return JSON.stringify({
    model: model.trim().length > 0 ? model.trim() : PROBE_FALLBACK_MODEL,
    max_tokens: PROBE_MAX_TOKENS,
    messages: [{ role: 'user', content: PROBE_PROMPT }],
  })
}

/**
 * One minimal request, opt-in only. The response body is never read, let alone
 * displayed: it can echo the token back or carry provider-side detail the user
 * might screenshot. Only the status code leaves this function.
 */
export async function probeEndpoint(target: ProbeTarget): Promise<ProbeResult> {
  const host = probeHost(target.baseUrl)
  const invalid = validateBaseUrl(target.baseUrl)
  if (invalid !== null) return { ok: false, status: null, key: invalid, host }
  try {
    const response = await fetch(joinUrl(target.baseUrl, CONNECTION_PATH), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': ANTHROPIC_VERSION,
        authorization: `Bearer ${target.token}`,
      },
      body: probeBody(target.model),
      signal: AbortSignal.timeout(CONNECTION_TIMEOUT_MS),
    })
    // Discard the body unread: it must not be buffered, logged, or displayed.
    await response.body?.cancel().catch(() => undefined)
    return {
      ok: response.ok,
      status: response.status,
      key: interpretStatus(response.status),
      host,
    }
  } catch (err) {
    return { ok: false, status: null, key: interpretError(err), host }
  }
}
