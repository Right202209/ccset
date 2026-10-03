import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { BackupCleanupError, PartialCommitError, PermissionError } from '../src/core/errors.js'
import { clearBackups } from '../src/core/backup.js'
import { configFile, readConfigFile } from '../src/core/config-file.js'
import { applyPlan, planTargets } from '../src/operations/commit.js'
import { t } from '../src/i18n/index.js'
import { UNICODE_TERMINAL } from '../src/ui/terminal.js'
import type { ActionResult, Agent } from '../src/types.js'
import { ENTER, ESC, UiSession } from './ui-session.js'

async function failurePaint(home: string, run: () => Promise<ActionResult>): Promise<string> {
  const agent: Agent = { id: 'failure', name: 'Failure', detect: async () => true,
    getActions: () => [{ id: 'save', labelKey: 'action.global', run }] }
  const session = new UiSession(home, UNICODE_TERMINAL, {
    agents: [agent], agentId: agent.id, viewport: { rows: 50, columns: 160 },
  })
  try {
    await session.waitFor(t('action.global'))
    await session.send(ENTER)
    const paint = await session.waitFor(t('error.screenTitle'))
    await session.send(ESC)
    await session.waitFor(t('action.global'))
    return paint.replace(/[\s─-╿]+/g, '')
  } finally {
    session.stop()
  }
}

export async function verifyCleanupFailure(home: string): Promise<void> {
  const denied = path.join(home, 'denied.json.backup.1750000000000')
  const removed = path.join(home, 'removed.json.backup.1750000000000')
  await fs.writeFile(denied, 'KEPT')
  await fs.writeFile(removed, 'REMOVE')
  const unlink = fs.unlink
  fs.unlink = async (target) => {
    if (String(target) === denied) throw Object.assign(new Error('secret must not be echoed'), { code: 'EACCES' })
    return unlink(target)
  }
  try {
    const paint = await failurePaint(home, async () => {
      await clearBackups(home)
      return { kind: 'message', title: 'Incorrect success', tone: 'success', lines: [] }
    })
    assert.ok(paint.includes(denied), 'cleanup omitted the remaining path')
    assert.ok(paint.includes(t('error.permission', { path: denied, mode: 'rw' }).replace(/\s/g, '')))
    assert.ok(paint.includes(t('error.backupCleanup', { removed: 1, failed: 1 }).replace(/\s/g, '')))
    assert.equal(await fs.readFile(denied, 'utf8'), 'KEPT')
    await assert.rejects(() => fs.stat(removed))
    assert.equal(paint.includes('secretmustnotbeechoed'), false)
  } finally {
    fs.unlink = unlink
  }
  assert.equal(await clearBackups(home), 1, 'retry did not remove the failed backup')
}

export async function verifyPartialCommitScreen(home: string): Promise<void> {
  const first = configFile(path.join(home, 'config.toml'), 'toml')
  const second = configFile(path.join(home, 'auth.acme.json'), 'json')
  const backups = path.join(home, 'backups')
  await fs.writeFile(first.path, 'model = "old"\n')
  const plans = planTargets([
    { file: first, base: await readConfigFile(first), writes: [{ path: ['model'], value: 'new' }], backupsDir: backups },
    { file: second, base: await readConfigFile(second), writes: [{ path: ['key'], value: 'SECRET' }], backupsDir: backups },
  ])
  const rename = fs.rename
  fs.rename = async (source, target) => {
    if (String(target) === second.path) throw Object.assign(new Error('SECRET'), { code: 'EIO' })
    return rename(source, target)
  }
  try {
    const paint = await failurePaint(home, async () => {
      await applyPlan(plans, { dryRun: false, skipUnchanged: true })
      throw new Error('expected a partial commit')
    })
    assert.ok(paint.includes(first.path), 'the TUI hid the committed path')
    assert.ok(paint.includes(second.path), 'the TUI hid the failed path')
    const name = (await fs.readdir(backups))[0]
    assert.ok(name !== undefined)
    const backup = path.join(backups, name)
    assert.ok(paint.includes(backup), 'the TUI hid the recovery backup')
    assert.ok(paint.includes(t('cli.partialCommit', { paths: first.path }).replace(/\s/g, '')))
    assert.equal(await fs.readFile(backup, 'utf8'), 'model = "old"\n')
    assert.equal(await fs.readFile(first.path, 'utf8'), 'model = "new"\n')
    assert.equal(paint.includes('SECRET'), false)
  } finally {
    fs.rename = rename
  }
}

export async function verifyDeniedCleanup(home: string): Promise<void> {
  if (process.platform === 'win32' || process.getuid?.() === 0) return
  const target = path.join(home, 'settings.json.backup.1750000000000')
  await fs.writeFile(target, 'KEPT')
  await fs.chmod(home, 0o500)
  try {
    await assert.rejects(() => clearBackups(home), (error: unknown) => {
      assert.ok(error instanceof BackupCleanupError)
      assert.equal(error.removed, 0)
      assert.equal(error.failures.length, 1)
      assert.equal(error.failures[0]?.params['path'], target)
      return true
    })
    assert.equal(await fs.readFile(target, 'utf8'), 'KEPT')
  } finally {
    await fs.chmod(home, 0o700)
  }
  assert.equal(await clearBackups(home), 1)
}

export async function verifyRollbackScreen(home: string): Promise<void> {
  const target = path.join(home, 'config.toml')
  const cause = new PermissionError(path.join(home, 'auth.json'), 'rw')
  const rollback = new PermissionError(target, 'rw')
  const paint = await failurePaint(home, async () => {
    throw new PartialCommitError([{ path: target, backupPath: null, mode: '0600', changed: true }], cause, rollback)
  })
  const message = t('error.rollbackFailed', { message: t(rollback.messageKey, rollback.params) })
  assert.ok(paint.includes(message.replace(/\s/g, '')), 'the TUI hid the rollback failure')
}
