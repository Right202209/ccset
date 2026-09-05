import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { backupsDir, globalSettingsPath } from '../src/agents/claude-code/paths.js'
import { saveLocale } from '../src/core/settings.js'
import { CliSession, DOWN, ENTER, ESC, terminalEnv, UP } from './pty-session.js'

async function backupFiles(home: string): Promise<string[]> {
  try {
    return await fs.readdir(backupsDir(home))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

/**
 * --agent names the agent under test rather than letting the run stop on the
 * selection Screen, which exists now that a second agent is registered. It is
 * also the only coverage the flag has against more than one legal id.
 */
function startSession(home: string): CliSession {
  return new CliSession({
    args: ['node', 'dist/cli.js', '--agent', 'claude-code'],
    env: terminalEnv(home),
  })
}

/**
 * These homes are fresh, so without a saved choice the first-run language
 * prompt (ADR 0004) is the first screen. This gate walks the agent's flows,
 * not that prompt -- the prompt has its own gate -- so each home picks
 * English once through the shipped writer before the session starts.
 */
async function chooseEnglishOnce(home: string): Promise<void> {
  await saveLocale(home, 'en')
}

async function openGlobal(session: CliSession, from = 0): Promise<number> {
  await session.waitFor('Global settings', from)
  await new Promise((resolve) => setTimeout(resolve, 100))
  session.send(ENTER)
  return session.waitFor('esc cancel', from)
}

async function verifyMalformedRecovery(home: string): Promise<void> {
  await chooseEnglishOnce(home)
  const target = globalSettingsPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, '{"unmanaged":"original"}\n', { mode: 0o600 })
  const session = startSession(home)
  try {
    let cursor = await openGlobal(session)
    session.send(' ')
    await fs.writeFile(target, '{ malformed fixture\n', { mode: 0o600 })
    const malformed = await fs.readFile(target, 'utf8')
    await session.sendEach(DOWN, 8)
    await new Promise((resolve) => setTimeout(resolve, 250))
    session.send(ENTER)
    cursor = await session.waitFor('File is not valid JSON', cursor)
    assert.match(session.snapshot().slice(cursor), /Back it up and start fresh/)

    session.send(ENTER)
    cursor = await session.waitFor('esc cancel', cursor + 1)
    assert.equal(await fs.readFile(target, 'utf8'), malformed)
    assert.deepEqual(await backupFiles(home), [])
    const returnedForm = session.snapshot().slice(session.snapshot().lastIndexOf('Global settings'))
    assert.match(returnedForm, /Proxy\s+\* On/)

    await session.sendEach(DOWN, 8)
    await new Promise((resolve) => setTimeout(resolve, 250))
    session.send(ENTER)
    cursor = await session.waitFor('File is not valid JSON', cursor + 1)
    session.send(UP)
    await new Promise((resolve) => setTimeout(resolve, 250))
    session.send(ENTER)
    await session.waitFor('Global settings saved', cursor)

    const names = await backupFiles(home)
    assert.equal(names.length, 1)
    assert.equal(await fs.readFile(path.join(backupsDir(home), names[0]!), 'utf8'), malformed)
    const saved = JSON.parse(await fs.readFile(target, 'utf8')) as Record<string, unknown>
    assert.equal(saved['unmanaged'], undefined)
    assert.equal((saved['env'] as Record<string, unknown>)['HTTPS_PROXY'], 'http://127.0.0.1:7890')
  } finally {
    await session.stop()
  }
}

async function verifyDirtyExit(home: string): Promise<void> {
  await chooseEnglishOnce(home)
  const session = startSession(home)
  try {
    let cursor = await openGlobal(session)
    session.send(ESC)
    cursor = await session.waitFor('Global settings', cursor + 1)
    assert.equal(session.snapshot().slice(cursor).includes('Unsaved edits'), false)

    cursor = await openGlobal(session, cursor)
    session.send(' ')
    await new Promise((resolve) => setTimeout(resolve, 500))
    session.send(ESC)
    cursor = await session.waitFor('Unsaved edits', cursor)
    session.send(ENTER)
    cursor = await session.waitFor('esc cancel', cursor + 1)
    const returnedForm = session.snapshot().slice(session.snapshot().lastIndexOf('Global settings'))
    assert.match(returnedForm, /Proxy\s+\* On/)

    await session.sendEach(DOWN, 9)
    await new Promise((resolve) => setTimeout(resolve, 250))
    session.send(ENTER)
    cursor = await session.waitFor('Unsaved edits', cursor + 1)
    session.send(UP)
    await new Promise((resolve) => setTimeout(resolve, 250))
    session.send(ENTER)
    await session.waitFor('Global settings', cursor + 1)
  } finally {
    await session.stop()
  }
}

async function main(): Promise<void> {
  assert.ok(
    process.platform === 'linux' || process.platform === 'darwin',
    `built-CLI PTY verification runs on Linux and macOS, not ${process.platform}`,
  )
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-malformed-dirty-'))
  try {
    await verifyMalformedRecovery(home)
    await fs.rm(home, { recursive: true, force: true })
    await fs.mkdir(home)
    await verifyDirtyExit(home)
    process.stdout.write('Malformed recovery and dirty-exit verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
