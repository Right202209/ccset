import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { saveGlobal } from '../src/agents/claude-code/global.js'
import { backupsDir, claudeDir, globalSettingsPath } from '../src/core/paths.js'
import type { FormValues, JsonObject } from '../src/types.js'

/**
 * D6: SIGKILL a real save and prove the target is either the complete old
 * content or the complete new content. The child is this same bundle re-entered
 * through KILL_CHILD_FLAG, so it runs the shipped saveGlobal rather than a
 * reimplementation of it.
 *
 * Scope note for the register: SIGKILL kills the process, not the page cache,
 * so this proves atomicity against process death only. writeJsonFileAtomic does
 * not fsync before rename(), so nothing here speaks to power loss.
 */

export const KILL_CHILD_FLAG = '--kill-child'

const OLD_MODEL = 'kill-old-model'
const NEW_MODEL = 'kill-new-model'
/** Unmanaged entries the save must preserve, sized so read-backup-write is
 *  long enough to interrupt at several distinct points. */
const BULK_ENTRIES = 60_000
const BULK_PADDING = 80
const KILL_ROUNDS = 12
/** Kill delays span this multiple of one uninterrupted save. */
const KILL_SPAN = 1.5

const KILL_VALUES: FormValues = {
  proxyEnabled: false,
  proxyUrl: '',
  disableNonessentialTraffic: '1',
  attributionHeader: '0',
  disableInstallationChecks: '1',
  enableToolSearch: '1',
  cleanupPeriodDays: '720',
  model: NEW_MODEL,
}

export function bulkBlob(): string[] {
  const pad = 'x'.repeat(BULK_PADDING)
  return Array.from({ length: BULK_ENTRIES }, (_, index) => `unmanaged-${index}-${pad}`)
}

/** Re-entry point: the forked child performs one real save. */
export async function runKillChild(home: string): Promise<void> {
  process.send?.('ready')
  await saveGlobal({ home }, KILL_VALUES)
  process.send?.('done')
}

interface SaveRun {
  /** The child reported a completed save before the signal landed. */
  finished: boolean
  /** ready -> exit, in milliseconds. */
  elapsedMs: number
}

/** Forks one save and, when delayMs is set, SIGKILLs it that long after the
 *  child signals it is about to write. */
function forkSave(home: string, delayMs: number | null): Promise<SaveRun> {
  return new Promise((resolve) => {
    const entry = process.argv[1] ?? ''
    const child = fork(entry, [KILL_CHILD_FLAG, home], {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    })
    let readyAt = Date.now()
    let finished = false
    let timer: NodeJS.Timeout | undefined
    child.on('message', (message) => {
      if (message === 'done') finished = true
      if (message !== 'ready') return
      readyAt = Date.now()
      if (delayMs !== null) timer = setTimeout(() => child.kill('SIGKILL'), delayMs)
    })
    child.on('exit', () => {
      if (timer !== undefined) clearTimeout(timer)
      resolve({ finished, elapsedMs: Date.now() - readyAt })
    })
  })
}

export interface KillTally {
  old: number
  new: number
  temps: number
  backups: number
  unparseableBackups: number
  saveMs: number
}

/** The target must parse whole and carry every unmanaged entry, whichever side
 *  of the rename the signal landed on. */
async function readOutcome(target: string, bulk: string[]): Promise<'old' | 'new'> {
  const raw = await fs.readFile(target, 'utf8')
  let parsed: JsonObject
  try {
    parsed = JSON.parse(raw) as JsonObject
  } catch {
    return assert.fail(`target left unparseable after SIGKILL (${raw.length} bytes)`)
  }
  assert.deepEqual(parsed['bulk'], bulk, 'unmanaged blob did not survive the kill')
  const model = parsed['model']
  assert.ok(model === OLD_MODEL || model === NEW_MODEL, `unexpected model ${String(model)}`)
  return model === NEW_MODEL ? 'new' : 'old'
}

/** A crashed write leaves its temp file behind: it must never be the target,
 *  and it holds the same payload so it must carry the same mode. */
async function drainTemps(home: string, target: string, tally: KillTally): Promise<void> {
  const dir = claudeDir(home)
  const prefix = `.${path.basename(target)}.`
  const names = (await fs.readdir(dir)).filter((n) => n.startsWith(prefix) && n.endsWith('.tmp'))
  for (const name of names) {
    const leftover = path.join(dir, name)
    assert.notEqual(leftover, target, 'temp path collided with the target')
    if (process.platform !== 'win32') {
      assert.equal((await fs.stat(leftover)).mode & 0o777, 0o600, 'temp leftover is not 0600')
    }
    await fs.unlink(leftover)
    tally.temps += 1
  }
}

async function drainBackups(home: string, tally: KillTally): Promise<void> {
  const dir = backupsDir(home)
  const names = await fs.readdir(dir).catch(() => [] as string[])
  for (const name of names) {
    const backup = path.join(dir, name)
    if (process.platform !== 'win32') {
      assert.equal((await fs.stat(backup)).mode & 0o777, 0o600, 'backup is not 0600')
    }
    const raw = await fs.readFile(backup, 'utf8')
    try {
      JSON.parse(raw)
    } catch {
      tally.unparseableBackups += 1
    }
    await fs.unlink(backup)
    tally.backups += 1
  }
}

async function runRound(home: string, delayMs: number, tally: KillTally): Promise<void> {
  const target = globalSettingsPath(home)
  const bulk = bulkBlob()
  await fs.writeFile(target, `${JSON.stringify({ bulk, model: OLD_MODEL }, null, 2)}\n`, {
    mode: 0o600,
  })
  await forkSave(home, delayMs)
  const outcome = await readOutcome(target, bulk)
  if (outcome === 'new') tally.new += 1
  else tally.old += 1
  await drainTemps(home, target, tally)
  await drainBackups(home, tally)
}

/**
 * Times one uninterrupted save, then sweeps the kill delay across that window
 * so signals land before, during, and after the rename.
 */
export async function runKillSweep(home: string): Promise<KillTally> {
  const target = globalSettingsPath(home)
  const bulk = bulkBlob()
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, `${JSON.stringify({ bulk, model: OLD_MODEL }, null, 2)}\n`, {
    mode: 0o600,
  })
  const baseline = await forkSave(home, null)
  assert.ok(baseline.finished, 'the uninterrupted calibration save did not complete')
  const tally: KillTally = {
    old: 0,
    new: 0,
    temps: 0,
    backups: 0,
    unparseableBackups: 0,
    saveMs: baseline.elapsedMs,
  }
  await drainBackups(home, tally)
  tally.backups = 0
  const step = (baseline.elapsedMs * KILL_SPAN) / (KILL_ROUNDS - 1)
  for (let round = 0; round < KILL_ROUNDS; round += 1) {
    await runRound(home, Math.round(round * step), tally)
  }
  assert.ok(tally.old > 0, 'no kill landed before the rename; the window missed the write')
  assert.ok(tally.new > 0, 'no kill landed after the rename; the window missed the write')
  return tally
}
