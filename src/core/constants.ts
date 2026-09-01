/** Named constants. No magic numbers anywhere else in the codebase. */

/** POSIX mode for every file ccset writes that can hold a credential. */
export const FILE_MODE = 0o600
/** POSIX mode for ccset-owned directories. */
export const DIR_MODE = 0o700

/** Backups kept per configuration file, pruned oldest-first. */
export const MAX_BACKUPS = 10

/* ------------------------------------------------------------- filenames */

export const BACKUP_INFIX = '.backup.'
/**
 * Marks an in-flight backup copy, renamed onto its real name once every byte is
 * there. Deliberately not `<basename>.backup.*`, so a partial copy can never be
 * listed, pruned, or restored as if it were a finished backup.
 */
export const BACKUP_TEMP_PREFIX = '.ccset-partial.'
/** Every agent puts its backups under a directory of its own ending here. */
export const BACKUPS_DIR_SEGMENTS = ['backups', 'ccset']

/** A name that becomes a filename is constrained to what is safe on both
 *  POSIX and Windows; which names are additionally *reserved* is the agent's
 *  business, so that list is supplied per agent. */
export const PROVIDER_NAME_PATTERN = /^[A-Za-z0-9_-]+$/

/* ------------------------------------------------------------- masking */

/** Characters shown at each end of a secret. */
export const MASK_VISIBLE_CHARS = 4
/** Fixed-width middle run, so masking never encodes the true length. */
export const MASK_MIDDLE_WIDTH = 8
export const MASK_CHAR = '•'

/* ---------------------------------------------------------- connection */

export const CONNECTION_TIMEOUT_MS = 10_000

/* ---------------------------------------------------------------- misc */

export const ALLOWED_URL_PROTOCOLS = ['http:', 'https:']
export const MAX_BACKUP_NAME_ATTEMPTS = 1000
export const CLEANUP_DAYS_MAX = 36_500
