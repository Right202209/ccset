import type { Ctx } from '../../types.js'
import { fileExists, jsonFile, readJsonFile, readMode, writeJsonFileAtomic } from '../../core/json-file.js'
import { claudeStatePath } from './paths.js'

/**
 * ~/.claude.json is Claude Code's live state store, rewritten continuously
 * while the app runs. A read-modify-write here races an active writer and a
 * stale merge would discard whatever Claude Code wrote in between -- up to
 * every project entry -- to set a boolean that is already true for anyone who
 * has launched Claude Code once. So: create it when absent, never touch it
 * when present.
 */

export const ONBOARDING_KEY = 'hasCompletedOnboarding'

export interface StateReport {
  path: string
  exists: boolean
  parsed: boolean
  mode: string
  /** null when the file is absent or unparseable. */
  onboarded: boolean | null
}

export async function inspectState(ctx: Ctx): Promise<StateReport> {
  const target = claudeStatePath(ctx.home)
  const report: StateReport = {
    path: target,
    exists: await fileExists(target),
    parsed: false,
    mode: '-',
    onboarded: null,
  }
  if (!report.exists) return report
  report.mode = await readMode(target)
  try {
    const file = await readJsonFile(target)
    report.parsed = true
    report.onboarded = file.data[ONBOARDING_KEY] === true
  } catch {
    // Unparseable is reported, not repaired: ccset never writes this file.
    report.parsed = false
  }
  return report
}

/** The one-line fix ccset prints instead of applying it. */
export function onboardingFixHint(): string {
  return `set "${ONBOARDING_KEY}": true in ~/.claude.json`
}

export interface StateCreateResult {
  path: string
  created: boolean
  mode: string
}

/**
 * Creates the file only when it does not exist. The existence check and the
 * write are not atomic, but the loser of that race is ccset writing a
 * two-key file over a store that a concurrent Claude Code had just created;
 * the window is a single event-loop turn on a path where no such process is
 * running yet, and the alternative -- an exclusive-create dance -- cannot
 * remove the race either.
 */
export async function createStateIfMissing(ctx: Ctx): Promise<StateCreateResult> {
  const target = claudeStatePath(ctx.home)
  if (await fileExists(target)) {
    return { path: target, created: false, mode: await readMode(target) }
  }
  await writeJsonFileAtomic(jsonFile(target), { [ONBOARDING_KEY]: true })
  return { path: target, created: true, mode: await readMode(target) }
}
