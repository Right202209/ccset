/** Error taxonomy and the exit codes from PRD 4.4, plus the command codes. */

import type { TargetRecord } from '../operations/types.js'

export const EXIT_OK = 0
export const EXIT_RUNTIME = 1
export const EXIT_NOT_TTY = 2
export const EXIT_PERMISSION = 3
/** PRD 4.4: the target exists but could not be parsed, whatever its format. */
export const EXIT_INVALID_CONFIG = 4
/**
 * Command-mode codes. A script has to tell a typo (64) from an agent it did
 * not name (65) from a command the named agent does not serve (66).
 */
export const EXIT_USAGE = 64
export const EXIT_UNKNOWN_AGENT = 65
export const EXIT_UNSUPPORTED_COMMAND = 66

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

export class ValidationError extends CcsetError {
  constructor(messageKey: string, params: Record<string, string> = {}) {
    super(messageKey, EXIT_RUNTIME, params)
    this.name = 'ValidationError'
  }
}

/**
 * A multi-target commit got partway before something unexpected failed. The
 * paths already written are the error's payload: a caller that cannot undo a
 * commit has to be able to say which files may have changed. The interrupted
 * cause keeps its own code and exit status.
 */
export class PartialCommitError extends CcsetError {
  readonly committed: TargetRecord[]
  override readonly cause: CcsetError

  constructor(committed: TargetRecord[], cause: CcsetError) {
    super(cause.messageKey, cause.exitCode, cause.params)
    this.name = 'PartialCommitError'
    this.committed = committed
    this.cause = cause
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
