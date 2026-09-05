/**
 * One file an operation committed, or would have committed. Lives in core --
 * the commit machinery that produces it (atomic writes, modes, backups) is
 * core's own -- and rides on the operation seam as part of every result.
 */
export interface TargetRecord {
  path: string
  mode: string
  backupPath: string | null
  changed: boolean
}
