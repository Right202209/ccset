import type { KeyedStatusSection } from './types.js'

/**
 * The backup facts every agent reports, and the one section all three render
 * identically: a directory whose contents outlive the settings they replaced,
 * so the note about rotated credentials is part of the contract, not a hint.
 */

export interface BackupsSummary {
  path: string
  count: number
  partials: number
}

export function backupsSection(backups: BackupsSummary): KeyedStatusSection {
  return {
    titleKey: 'status.backupsTitle',
    lines: [
      { labelKey: 'status.path', value: backups.path },
      { labelKey: 'status.count', value: String(backups.count) },
      ...(backups.partials > 0
        ? [{ labelKey: 'status.partials', value: String(backups.partials), tone: 'warn' as const }]
        : []),
    ],
    noteKey: 'status.backupsNote',
  }
}
