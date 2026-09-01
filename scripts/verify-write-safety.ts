import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveGlobal } from '../src/agents/claude-code/global.js'
import { saveProvider } from '../src/agents/claude-code/providers.js'
import { buildStatus } from '../src/agents/claude-code/status.js'
import {
  ONBOARDING_KEY,
  createStateIfMissing,
  inspectState,
} from '../src/agents/claude-code/state.js'
import { CcsetError, EXIT_PERMISSION } from '../src/core/errors.js'
import { backupsDir, claudeDir, claudeStatePath, globalSettingsPath } from '../src/core/paths.js'
import type { FormValues, JsonObject } from '../src/types.js'
import { KILL_CHILD_FLAG, runKillChild, runKillSweep } from './kill-harness.js'

/** D4, D5, D6, E3: the writes ccset makes, and the ones it must refuse. */

const GLOBAL_VALUES: FormValues = {
  proxyEnabled: true,
  proxyUrl: 'http://127.0.0.1:7890',
  disableNonessentialTraffic: '1',
  attributionHeader: '0',
  disableInstallationChecks: '1',
  enableToolSearch: '1',
  cleanupPeriodDays: '720',
  model: 'write-safety-model',
}

const PROVIDER_VALUES: FormValues = {
  name: 'writesafety',
  baseUrl: 'https://api.example.invalid',
  token: 'sk-TEST-DO-NOT-USE',
  model: '',
}

const STATE_TOP_LEVEL_KEYS = 37
const STATE_PROJECT_ENTRIES = 400

/** Stands in for Claude Code's live store: many top-level keys and a bulky
 *  `projects` subtree, so a stale read-modify-write would be visible. */
function liveStateFile(): JsonObject {
  const projects: JsonObject = {}
  for (let index = 0; index < STATE_PROJECT_ENTRIES; index += 1) {
    projects[`/home/example/project-${index}`] = {
      history: [`prompt ${index}`, `follow-up ${index}`],
      mcpServers: { example: { command: 'node', args: ['server.js'] } },
    }
  }
  const data: JsonObject = { [ONBOARDING_KEY]: true, projects }
  for (let index = 0; index < STATE_TOP_LEVEL_KEYS - 2; index += 1) {
    data[`counter${index}`] = index
  }
  return data
}

interface Fingerprint {
  ino: number
  mtimeMs: number
  ctimeMs: number
  size: number
  bytes: string
}

async function fingerprint(filePath: string): Promise<Fingerprint> {
  const stats = await fs.stat(filePath)
  return {
    ino: stats.ino,
    mtimeMs: stats.mtimeMs,
    ctimeMs: stats.ctimeMs,
    size: stats.size,
    bytes: await fs.readFile(filePath, 'utf8'),
  }
}

/** Everything in ccset that runs against a home, so any stray write shows up. */
async function exerciseEveryWritePath(home: string): Promise<void> {
  await inspectState({ home })
  await createStateIfMissing({ home })
  await saveGlobal({ home }, GLOBAL_VALUES)
  await saveProvider({ home }, PROVIDER_VALUES)
  await buildStatus({ home })
  await saveGlobal({ home }, { ...GLOBAL_VALUES, proxyEnabled: false })
}

async function checkD4(home: string): Promise<void> {
  const target = claudeStatePath(home)
  await fs.mkdir(claudeDir(home), { recursive: true })
  const seeded = `${JSON.stringify(liveStateFile(), null, 2)}\n`
  await fs.writeFile(target, seeded, { mode: 0o600 })
  const before = await fingerprint(target)
  assert.ok(before.size > 50_000, 'the state fixture is not realistically sized')

  await exerciseEveryWritePath(home)

  const after = await fingerprint(target)
  assert.equal(after.ino, before.ino, 'the state file was replaced')
  assert.equal(after.mtimeMs, before.mtimeMs, 'the state file was written')
  assert.equal(after.ctimeMs, before.ctimeMs, 'the state file metadata changed')
  assert.equal(after.size, before.size)
  assert.equal(after.bytes, before.bytes, 'the state file content changed')

  const report = await inspectState({ home })
  assert.equal(report.exists, true)
  assert.equal(report.parsed, true)
  assert.equal(report.onboarded, true)
}

/** Unparseable is reported, never repaired: repairing means rewriting. */
async function checkD4Malformed(home: string): Promise<void> {
  const target = claudeStatePath(home)
  await fs.mkdir(claudeDir(home), { recursive: true })
  await fs.writeFile(target, '{ "projects": { broken', { mode: 0o600 })
  const before = await fingerprint(target)

  const report = await inspectState({ home })
  assert.equal(report.exists, true)
  assert.equal(report.parsed, false)
  assert.equal(report.onboarded, null)
  const created = await createStateIfMissing({ home })
  assert.equal(created.created, false, 'a malformed state file was overwritten')
  await buildStatus({ home })

  const after = await fingerprint(target)
  assert.equal(after.ino, before.ino)
  assert.equal(after.mtimeMs, before.mtimeMs)
  assert.equal(after.bytes, before.bytes)
}

async function checkD5(home: string): Promise<void> {
  const target = claudeStatePath(home)
  const first = await createStateIfMissing({ home })
  assert.equal(first.created, true)
  assert.equal(first.path, target)

  const bytes = await fs.readFile(target, 'utf8')
  assert.equal(bytes, `${JSON.stringify({ [ONBOARDING_KEY]: true }, null, 2)}\n`)
  const parsed = JSON.parse(bytes) as JsonObject
  assert.deepEqual(Object.keys(parsed), [ONBOARDING_KEY])
  assert.equal(parsed[ONBOARDING_KEY], true)
  if (process.platform !== 'win32') {
    assert.equal((await fs.stat(target)).mode & 0o777, 0o600)
    assert.equal(first.mode, '0600')
  }

  const before = await fingerprint(target)
  const second = await createStateIfMissing({ home })
  assert.equal(second.created, false, 'an existing state file was recreated')
  const after = await fingerprint(target)
  assert.equal(after.ino, before.ino)
  assert.equal(after.mtimeMs, before.mtimeMs)
  assert.equal(after.bytes, before.bytes)
}

async function expectPermissionError(run: () => Promise<unknown>, named: string): Promise<void> {
  let caught: unknown
  try {
    await run()
  } catch (err) {
    caught = err
  }
  assert.ok(caught instanceof CcsetError, 'a read-only target did not raise CcsetError')
  assert.equal(caught.exitCode, EXIT_PERMISSION)
  assert.equal(caught.messageKey, 'error.permission')
  assert.equal(caught.params['path'], named)
  assert.ok((caught.params['mode'] ?? '').length > 0, 'the error does not state the required mode')
  assert.equal(caught.message.includes('sk-TEST'), false)
}

/** E3: a read-only ~/.claude fails at different points depending on whether a
 *  target exists, so both are checked. */
async function checkE3(home: string): Promise<void> {
  const dir = claudeDir(home)
  const target = globalSettingsPath(home)
  await fs.mkdir(dir, { recursive: true })
  await fs.chmod(dir, 0o500)
  try {
    await expectPermissionError(() => saveGlobal({ home }, GLOBAL_VALUES), target)
    assert.deepEqual(await fs.readdir(dir), [], 'a partial write was left behind')
  } finally {
    await fs.chmod(dir, 0o700)
  }

  const seeded = `${JSON.stringify({ model: 'untouched' }, null, 2)}\n`
  await fs.writeFile(target, seeded, { mode: 0o600 })
  await fs.chmod(dir, 0o500)
  try {
    await expectPermissionError(() => saveGlobal({ home }, GLOBAL_VALUES), backupsDir(home))
    assert.equal(await fs.readFile(target, 'utf8'), seeded, 'the target changed')
    assert.deepEqual(await fs.readdir(dir), [path.basename(target)])
  } finally {
    await fs.chmod(dir, 0o700)
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

function skipE3(): string | null {
  if (process.platform === 'win32') return 'win32 cannot express a read-only directory via chmod'
  if (process.getuid?.() === 0) return 'running as root, which bypasses the permission bits'
  return null
}

async function main(): Promise<void> {
  await withHome('d4', checkD4)
  await withHome('d4m', checkD4Malformed)
  await withHome('d5', checkD5)

  const reason = skipE3()
  if (reason === null) await withHome('e3', checkE3)
  else process.stdout.write(`E3 skipped: ${reason}.\n`)

  let tally = ''
  await withHome('d6', async (home) => {
    const result = await runKillSweep(home)
    tally =
      `D6: save ${result.saveMs}ms, ${result.old} killed before rename, ` +
      `${result.new} after, ${result.temps} temp leftovers, ` +
      `${result.backups} backups (${result.unparseableBackups} unparseable), ` +
      `${result.partials} partial copies.\n`
  })
  process.stdout.write(tally)
  process.stdout.write('Write-safety verification passed.\n')
}

const childHome = process.argv[process.argv.indexOf(KILL_CHILD_FLAG) + 1]
if (process.argv.includes(KILL_CHILD_FLAG) && childHome !== undefined) {
  await runKillChild(childHome)
} else {
  await main()
}
