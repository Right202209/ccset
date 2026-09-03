/** Error taxonomy and the exit codes from PRD 4.4. */

export const EXIT_OK = 0
export const EXIT_RUNTIME = 1
export const EXIT_NOT_TTY = 2
export const EXIT_PERMISSION = 3
/** PRD 4.4: the target exists but could not be parsed, whatever its format. */
export const EXIT_INVALID_CONFIG = 4
/** Bad command syntax, unknown option, or missing required value. */
export const EXIT_USAGE = 64
/** The requested agent is not in the registry. */
export const EXIT_UNKNOWN_AGENT = 66
/** The agent does not support the requested command. */
export const EXIT_UNKNOWN_COMMAND = 67

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

/** What a codec reports when the file on disk is not in its format. */
export interface ParseFailure {
  /** i18n key for the one-line description. */
  messageKey: string
  /** i18n key for the heading of the "start fresh" confirm. */
  titleKey: string
  path: string
  position: string
}

/**
 * A target that exists but does not parse. The codec supplies the wording so
 * the UI can say "not valid TOML" without learning what a codec is; the save
 * flow only needs to recognise the class to offer the same confirm either way.
 */
export class ConfigParseError extends CcsetError {
  readonly titleKey: string

  constructor(failure: ParseFailure) {
    super(failure.messageKey, EXIT_INVALID_CONFIG, {
      path: failure.path,
      position: failure.position,
    })
    this.name = 'ConfigParseError'
    this.titleKey = failure.titleKey
  }
}

export class JsonParseError extends ConfigParseError {
  constructor(path: string, position: string) {
    super({
      messageKey: 'error.invalidJson',
      titleKey: 'confirm.freshTitle',
      path,
      position,
    })
    this.name = 'JsonParseError'
  }
}

export class TomlParseError extends ConfigParseError {
  constructor(path: string, position: string) {
    super({
      messageKey: 'error.invalidToml',
      titleKey: 'confirm.freshTitleToml',
      path,
      position,
    })
    this.name = 'TomlParseError'
  }
}

/**
 * One structured usage problem. The `code` is an i18n key, never a translated
 * sentence, so the presenter can localize it and the JSON envelope can carry it
 * verbatim; params carry the option name or value the message names.
 */
export interface UsageProblem {
  code: string
  params?: Record<string, string>
}

/** A typed error from the operation seam: a stable code plus structured problems. */
export class OperationError extends CcsetError {
  readonly code: string
  readonly problems: UsageProblem[]

  constructor(code: string, problems: UsageProblem | UsageProblem[], exitCode: number) {
    const list = Array.isArray(problems) ? problems : [problems]
    const first = list[0] ?? { code: 'error.unexpected' }
    super(first.code, exitCode, first.params ?? {})
    this.name = 'OperationError'
    this.code = code
    this.problems = list
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
