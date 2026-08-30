/** Error taxonomy and the exit codes from PRD 4.4. */

export const EXIT_OK = 0
export const EXIT_RUNTIME = 1
export const EXIT_NOT_TTY = 2
export const EXIT_PERMISSION = 3
export const EXIT_INVALID_JSON = 4

export class CcsetError extends Error {
  readonly exitCode: number
  /** i18n key describing the failure, for the UI. */
  readonly messageKey: string
  readonly params: Record<string, string>

  constructor(messageKey: string, exitCode: number, params: Record<string, string> = {}) {
    super(`${messageKey} ${JSON.stringify(params)}`)
    this.name = 'CcsetError'
    this.messageKey = messageKey
    this.exitCode = exitCode
    this.params = params
  }
}

export class PermissionError extends CcsetError {
  constructor(path: string, mode: string) {
    super('error.permission', EXIT_PERMISSION, { path, mode })
    this.name = 'PermissionError'
  }
}

export class JsonParseError extends CcsetError {
  constructor(path: string, position: string) {
    super('error.invalidJson', EXIT_INVALID_JSON, { path, position })
    this.name = 'JsonParseError'
  }
}

export class ValidationError extends CcsetError {
  constructor(messageKey: string, params: Record<string, string> = {}) {
    super(messageKey, EXIT_RUNTIME, params)
    this.name = 'ValidationError'
  }
}

interface ErrnoLike {
  code?: string
}

const PERMISSION_CODES = ['EACCES', 'EPERM', 'EROFS']

export function errorCode(err: unknown): string | undefined {
  return (err as ErrnoLike | null)?.code
}

export function isNotFound(err: unknown): boolean {
  return errorCode(err) === 'ENOENT'
}

/**
 * Translate a filesystem failure into the taxonomy. Any message text from the
 * OS is discarded: it can embed paths but never a credential, and keeping it
 * out of the UI keeps the "tokens never appear in error messages" rule simple.
 */
export function wrapFsError(err: unknown, path: string, requiredMode = 'rw'): CcsetError {
  if (err instanceof CcsetError) return err
  const code = errorCode(err)
  if (code !== undefined && PERMISSION_CODES.includes(code)) {
    return new PermissionError(path, requiredMode)
  }
  return new CcsetError('error.io', EXIT_RUNTIME, { path, code: code ?? 'unknown' })
}

export function toCcsetError(err: unknown): CcsetError {
  if (err instanceof CcsetError) return err
  return new CcsetError('error.unexpected', EXIT_RUNTIME, {
    detail: err instanceof Error ? err.name : 'unknown',
  })
}
