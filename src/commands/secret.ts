import { CcsetError, EXIT_USAGE } from '../core/errors.js'
import { asSecret, type Secret } from '../operations/types.js'

/**
 * The only two doors a credential may enter through: the CCSET_TOKEN
 * environment variable, or stdin when --token-stdin said so. A secret never
 * appears in process arguments, logs, result objects, or error parameters --
 * these readers return the value and say nothing else about it.
 */

const MAX_SECRET_BYTES = 64 * 1024

function fail(messageKey: string): never {
  throw new CcsetError(messageKey, EXIT_USAGE)
}

function decodeStrict(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return fail('cli.secret.notUtf8')
  }
}

/**
 * Enforces the credential rules: size, UTF-8, no NUL, one line, non-empty,
 * and no surrounding whitespace. Stdin alone may drop one final line ending
 * -- the one an interactive shell adds; an environment value is taken as-is.
 */
function check(text: string, fromStdin: boolean): Secret {
  if (Buffer.byteLength(text, 'utf8') > MAX_SECRET_BYTES) fail('cli.secret.tooLarge')
  if (text.includes('\0')) fail('cli.secret.containsNul')
  const body = fromStdin ? text.replace(/(?:\r?\n|\r)$/, '') : text
  if (body.length === 0) fail('cli.secret.empty')
  if (body.includes('\n') || body.includes('\r')) fail('cli.secret.multiLine')
  if (/^\s/.test(body) || /\s$/.test(body)) fail('cli.secret.padded')
  return asSecret(body)
}

/** An absent or empty variable means no secret was supplied that way. */
export function secretFromEnv(raw: string | undefined): Secret | null {
  if (raw === undefined || raw.length === 0) return null
  return check(raw, false)
}

export async function secretFromStdin(): Promise<Secret> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of process.stdin) {
    const piece = chunk as Buffer
    total += piece.length
    if (total > MAX_SECRET_BYTES) fail('cli.secret.tooLarge')
    chunks.push(piece)
  }
  return check(decodeStrict(Buffer.concat(chunks)), true)
}
