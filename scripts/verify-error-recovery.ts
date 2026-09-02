import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BACKUP_INFIX, BACKUP_TEMP_PREFIX, FILE_MODE } from '../src/core/constants.js'
import {
  backupsDir,
  claudeDir,
  claudeStatePath,
  providerSettingsPath,
} from '../src/agents/claude-code/paths.js'
import { backupsDir as opencodeBackupsDir } from '../src/agents/opencode/paths.js'
import { buildStatus as opencodeStatus } from '../src/agents/opencode/status.js'
import { backupsDir as codexBackupsDir } from '../src/agents/codex/paths.js'
import { buildStatus as codexStatus } from '../src/agents/codex/status.js'
import { findAgent } from '../src/registry.js'
import { t } from '../src/i18n/index.js'
import { UNICODE_TERMINAL } from '../src/ui/terminal.js'
import type { Agent, StatusSection, Viewport } from '../src/types.js'
import { ENTER, ESC, UiSession } from './ui-session.js'

/**
 * Issue 38, error-recovery polish. Two guarantees the older gates do not hold:
 * a failed save keeps the application -- and everything typed into it -- alive
 * instead of unmounting, and a partial backup copy, which holds the credential
 * it was copying, is surfaced by Status rather than hidden until Clear runs.
 */

const NAME = 'acme'
const BASE_URL = 'https://provider.example'
const TOKEN = 'RECOVERY-GATE-TOKEN-0123456789'
const VIEWPORT: Viewport = { rows: 40, columns: 80 }
const SAVE = '\x13'
const UP = '\x1b[A'

function requireAgent(id: string): Agent {
  const agent = findAgent(id)
  if (agent === undefined) throw new Error(`the ${id} agent is not registered`)
  return agent
}

const claudeCode = requireAgent('claude-code')

/** One finished backup and one partial copy, both holding a credential. */
async function seedBackups(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  await fs.writeFile(path.join(dir, `settings.json${BACKUP_INFIX}1750000000000`), TOKEN)
  await fs.writeFile(path.join(dir, `${BACKUP_TEMP_PREFIX}settings.json.4242`), TOKEN)
}

function assertPartialSurfaced(sections: StatusSection[]): void {
  const section = sections.find((candidate) => candidate.title === t('status.backupsTitle'))
  assert.ok(section !== undefined, 'Status has no backups section')
  const partials = section.lines.find((line) => line.label === t('status.partials'))
  assert.ok(partials !== undefined, 'a partial copy was not surfaced')
  assert.equal(partials.value, '1')
  assert.equal(partials.tone, 'warn', 'a partial copy is not warned about')
  assert.equal(section.note, t('status.partialsNote', { count: 1 }))
}

/** The same section shape for the two agents the TUI drive does not walk. */
async function checkOtherAgentsSurfacePartials(home: string): Promise<void> {
  await seedBackups(opencodeBackupsDir(home))
  await seedBackups(codexBackupsDir(home))
  assertPartialSurfaced((await opencodeStatus({ home })).sections)
  assertPartialSurfaced((await codexStatus({ home })).sections)
}

/**
 * A read-only ~/.claude fails the save after the token has been typed. The
 * failure must be a Screen the user can leave, not an unmount, and the form it
 * returns to must still hold every character -- then fixing the permission and
 * saving again has to succeed without retyping anything.
 */
async function checkFailedSaveKeepsTheForm(home: string): Promise<void> {
  const session = new UiSession(home, UNICODE_TERMINAL, { agents: [claudeCode], viewport: VIEWPORT })
  try {
    await session.waitFor(t('action.status'))
    await session.send('2')
    await session.waitFor(t('action.providerAdd'))
    await session.send('1')
    await session.waitFor(t('field.providerName'))
    await session.send(NAME)
    await session.send(ENTER)
    await session.send(BASE_URL)
    await session.send(ENTER)
    await session.send(TOKEN)

    await fs.mkdir(claudeDir(home), { recursive: true, mode: 0o700 })
    await fs.chmod(claudeDir(home), 0o500)
    try {
      await session.send(SAVE)
      const failed = await session.waitFor(t('error.screenTitle'))
      assert.ok(
        failed.includes(t('error.permission', { path: providerSettingsPath(home, NAME), mode: 'rw' })),
        `The failure is not named on the error Screen:\n${failed}`,
      )

      await session.send(ESC)
      const form = await session.waitFor(t('field.providerName'))
      assert.ok(form.includes(NAME), `The typed provider name was lost:\n${form}`)
      assert.ok(form.includes(BASE_URL), 'The typed base URL was lost')
      assert.equal(form.includes(TOKEN), false, 'The token reached a paint unmasked')
      assert.ok(form.includes(UNICODE_TERMINAL.glyphs.mask), 'The kept token is not masked')
    } finally {
      await fs.chmod(claudeDir(home), 0o700)
    }

    await session.send(SAVE)
    const saved = await session.waitFor(t('write.providerSaved'))
    assert.ok(saved.includes(t('write.noBackup')), `A first save reported a backup:\n${saved}`)
    const target = providerSettingsPath(home, NAME)
    assert.ok((await fs.readFile(target, 'utf8')).includes(TOKEN), 'The retry did not write the token')
    assert.equal((await fs.stat(target)).mode & 0o777, FILE_MODE)
    assert.deepEqual(await backupFiles(backupsDir(home)), [])
  } finally {
    session.stop()
  }
}

async function backupFiles(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

/** The partial copy is warned about, and Clear ccset backups removes it. */
async function checkPartialIsClearable(home: string): Promise<void> {
  await fs.mkdir(claudeDir(home), { recursive: true, mode: 0o700 })
  await fs.writeFile(claudeStatePath(home), '{}\n', { mode: FILE_MODE })
  await seedBackups(backupsDir(home))

  const session = new UiSession(home, UNICODE_TERMINAL, { agents: [claudeCode], viewport: VIEWPORT })
  try {
    await session.waitFor(t('action.status'))
    await session.send('3')
    const status = await session.waitFor(t('status.backupsTitle'))
    assert.ok(status.includes(t('status.partials')), `Status hides the partial copy:\n${status}`)

    await session.send(ENTER)
    await session.waitFor(t('confirm.clearBackups'))
    await session.send(UP)
    await session.send(ENTER)
    await session.waitFor(t('write.backupsCleared', { count: 2 }))

    await session.send(ESC)
    // The fresh Status is the one whose backups note is the ordinary one; the
    // stale Frame beneath it still carries the partials note, so waiting on
    // that difference is what proves the reload happened.
    const reloaded = await session.waitFor(t('status.backupsNote'))
    assert.equal(reloaded.includes(t('status.partials')), false, 'Status still reports the partial copy')
    assert.deepEqual(await fs.readdir(backupsDir(home)), [], 'A backup survived Clear')
  } finally {
    session.stop()
  }
}

async function withHome(label: string, run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `ccset-${label}-`))
  try {
    await run(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

function skipPermissionDrive(): string | null {
  if (process.platform === 'win32') return 'win32 cannot express a read-only directory via chmod'
  if (process.getuid?.() === 0) return 'running as root, which bypasses the permission bits'
  return null
}

async function main(): Promise<void> {
  const reason = skipPermissionDrive()
  if (reason === null) await withHome('recovery', checkFailedSaveKeepsTheForm)
  else process.stdout.write(`Failed-save drive skipped: ${reason}.\n`)

  await withHome('recovery-partial', checkPartialIsClearable)
  await withHome('recovery-agents', checkOtherAgentsSurfacePartials)
  process.stdout.write('Error-recovery verification passed.\n')
}

await main()
