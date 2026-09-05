import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { settingsFilePath } from '../src/core/paths.js'
import { CliSession, CTRL_C, ESC, KEY_DELAY_MS, terminalEnv } from './pty-session.js'

/**
 * ADR 0004, the first-run language prompt. The override beats the saved
 * choice, the saved choice beats the prompt; presence of CCSET_LOCALE -- even
 * empty or unknown -- is an explicit English override that suppresses the
 * prompt and is never persisted. Argument parsing and the TTY guard run
 * before anything reaches the settings file, so --help, --version and a piped
 * stdin never prompt. Every pty run points CCSET_HOME at the scratch home,
 * which is also how the settings path itself is exercised.
 */

const CLI = 'dist/cli.js'
const PROMPT_TITLE = 'Language / 语言'
const ZH_AGENT_MENU = '选择 Agent'
const EN_AGENT_MENU = 'Select an agent'
/** 简体中文 is the prompt's second option; SelectList's 1-9 jump takes a digit. */
const ZH_OPTION_KEY = '2'
/** Like E3: a mode-based permission drive says nothing under root. */
const ROOT = typeof process.getuid === 'function' && process.getuid() === 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function scratchHome(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ccset-first-run-'))
}

/** Scratch home that removes itself, so a failed assertion cannot leak state. */
async function withHome(run: (home: string) => Promise<void>): Promise<void> {
  const home = await scratchHome()
  try {
    await run(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

function startSession(home: string, extraEnv: NodeJS.ProcessEnv = {}): CliSession {
  return new CliSession({
    args: ['node', CLI],
    env: terminalEnv(home, { CCSET_HOME: home, ...extraEnv }),
  })
}

async function writeSettings(home: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(settingsFilePath(home)), { recursive: true })
  await fs.writeFile(settingsFilePath(home), content, { mode: 0o600 })
}

async function readSettings(home: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(settingsFilePath(home), 'utf8')) as Record<string, unknown>
}

async function assertNoSettings(home: string): Promise<void> {
  await assert.rejects(
    fs.access(settingsFilePath(home)),
    { code: 'ENOENT' },
    'no settings file should exist',
  )
}

async function assertModes(home: string): Promise<void> {
  const dir = await fs.stat(path.join(home, '.ccset'))
  assert.equal(dir.mode & 0o777, 0o700, 'the settings directory is not 0700')
  const file = await fs.stat(settingsFilePath(home))
  assert.equal(file.mode & 0o777, 0o600, 'the settings file is not 0600')
}

/**
 * The headline flow: a fresh home meets the bilingual prompt, choosing
 * zh-Hans lands in a localized menu with the file written, and a second run
 * on the same home is never asked.
 */
async function verifyPickThenRemember(): Promise<void> {
  await withHome(async (home) => {
    const first = startSession(home)
    try {
      const title = await first.waitFor(PROMPT_TITLE)
      const prompt = first.snapshot().slice(title)
      assert.ok(prompt.includes('English'), prompt)
      assert.ok(prompt.includes('简体中文'), prompt)
      await sleep(KEY_DELAY_MS)
      first.send(ZH_OPTION_KEY)
      await first.waitFor(ZH_AGENT_MENU)
      assert.deepEqual(await readSettings(home), { version: 1, locale: 'zh-Hans' })
      await assertModes(home)

      const second = startSession(home)
      try {
        await second.waitFor(ZH_AGENT_MENU)
        assert.equal(second.snapshot().includes(PROMPT_TITLE), false, 'the second run prompted')
      } finally {
        await second.stop()
      }
    } finally {
      await first.stop()
    }
  })
}

/** CCSET_LOCALE set -- including empty -- is neither asked nor persisted. */
async function verifyOverrideNeverPersists(): Promise<void> {
  await withHome(async (home) => {
    const zh = startSession(home, { CCSET_LOCALE: 'zh-Hans' })
    try {
      await zh.waitFor(ZH_AGENT_MENU)
      assert.equal(zh.snapshot().includes(PROMPT_TITLE), false, 'the override prompted')
      await assertNoSettings(home)
    } finally {
      await zh.stop()
    }

    const empty = startSession(home, { CCSET_LOCALE: '' })
    try {
      await empty.waitFor(EN_AGENT_MENU)
      assert.equal(empty.snapshot().includes(PROMPT_TITLE), false, 'the empty override prompted')
      await assertNoSettings(home)
    } finally {
      await empty.stop()
    }
  })
}

/**
 * The override beats a conflicting saved choice in both directions, and a
 * run under it never persists: the file reads exactly as it did before.
 */
async function verifyOverrideBeatsSaved(): Promise<void> {
  await withHome(async (home) => {
    await writeSettings(home, `${JSON.stringify({ version: 1, locale: 'en' })}\n`)
    const zh = startSession(home, { CCSET_LOCALE: 'zh-Hans' })
    try {
      await zh.waitFor(ZH_AGENT_MENU)
      assert.equal(zh.snapshot().includes(PROMPT_TITLE), false, 'the override prompted')
      assert.deepEqual(await readSettings(home), { version: 1, locale: 'en' })
    } finally {
      await zh.stop()
    }

    await writeSettings(home, `${JSON.stringify({ version: 1, locale: 'zh-Hans' })}\n`)
    const en = startSession(home, { CCSET_LOCALE: 'en' })
    try {
      await en.waitFor(EN_AGENT_MENU)
      assert.deepEqual(await readSettings(home), { version: 1, locale: 'zh-Hans' })
    } finally {
      await en.stop()
    }
  })
}

/** Esc and Ctrl+C at the prompt are the normal user-cancel exit: 0, no file, no app. */
async function verifyCancelLeavesNoFile(key: string): Promise<void> {
  await withHome(async (home) => {
    const session = startSession(home)
    try {
      await session.waitFor(PROMPT_TITLE)
      await sleep(KEY_DELAY_MS)
      session.send(key)
      assert.equal(await session.waitExit(), 0, 'cancellation must exit 0')
      await assertNoSettings(home)
    } finally {
      await session.stop()
    }
  })
}

/**
 * A persist failure does not cost the choice: the warn lands after the prompt
 * render exits -- resolved in the locale just chosen, so it reads in Chinese
 * here -- and the session goes on localized. The settings directory is made
 * read-only to force the failure; like E3, root bypasses the mode, so the
 * drive is skipped there.
 */
async function verifyPersistFailureKeepsChoice(): Promise<void> {
  if (ROOT) return
  await withHome(async (home) => {
    const settingsDir = path.join(home, '.ccset')
    await fs.mkdir(settingsDir, { mode: 0o700 })
    await fs.chmod(settingsDir, 0o500)
    const session = startSession(home)
    try {
      await session.waitFor(PROMPT_TITLE)
      await sleep(KEY_DELAY_MS)
      session.send(ZH_OPTION_KEY)
      await session.waitFor(ZH_AGENT_MENU)
      assert.match(session.snapshot(), /无法将语言选择保存到/, 'the persist warn never appeared')
      await assertNoSettings(home)
    } finally {
      await fs.chmod(settingsDir, 0o700)
      await session.stop()
    }
  })
}

/**
 * A file that is present but not a carried preference -- corrupt, wrong
 * schema version, unknown tag -- is unchosen: the prompt runs again and the
 * next successful choice replaces the file.
 */
async function verifyUnchosenReasks(): Promise<void> {
  await withHome(async (home) => {
    const unchosen = [
      '{ broken',
      JSON.stringify({ version: 2, locale: 'zh-Hans' }),
      JSON.stringify({ version: 1, locale: 'fr' }),
    ]
    for (const content of unchosen) {
      await writeSettings(home, `${content}\n`)
      const session = startSession(home)
      try {
        await session.waitFor(PROMPT_TITLE)
        await sleep(KEY_DELAY_MS)
        session.send(ZH_OPTION_KEY)
        await session.waitFor(ZH_AGENT_MENU)
        assert.deepEqual(await readSettings(home), { version: 1, locale: 'zh-Hans' })
      } finally {
        await session.stop()
      }
    }
  })
}

/**
 * --help and --version exit during argument parsing and a piped stdin exits at
 * the TTY guard: none of them prompts, reads settings, or writes settings.
 */
async function verifyBoundaryNeverPrompts(): Promise<void> {
  await withHome(async (home) => {
    const boundaryEnv = terminalEnv(home, { CCSET_HOME: home })
    const version = spawnSync(process.execPath, [CLI, '--version'], {
      env: boundaryEnv,
      encoding: 'utf8',
    })
    assert.equal(version.status, 0, version.stderr)
    const help = spawnSync(process.execPath, [CLI, '--help'], { env: boundaryEnv, encoding: 'utf8' })
    assert.equal(help.status, 0, help.stderr)
    const piped = spawnSync(process.execPath, [CLI], { env: boundaryEnv, input: '', encoding: 'utf8' })
    assert.equal(piped.status, 2)
    assert.match(piped.stderr, /terminal/i)
    await assertNoSettings(home)
  })
}

async function main(): Promise<void> {
  assert.ok(
    process.platform === 'linux' || process.platform === 'darwin',
    `built-CLI PTY verification runs on Linux and macOS, not ${process.platform}`,
  )
  await verifyBoundaryNeverPrompts()
  await verifyPickThenRemember()
  await verifyOverrideNeverPersists()
  await verifyOverrideBeatsSaved()
  await verifyCancelLeavesNoFile(ESC)
  await verifyCancelLeavesNoFile(CTRL_C)
  await verifyPersistFailureKeepsChoice()
  await verifyUnchosenReasks()
  process.stdout.write('First-run locale verification passed.\n')
}

await main()
