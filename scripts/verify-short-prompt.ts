import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { CliSession, CTRL_C, ENTER, terminalEnv } from './pty-session.js'
import { withHome } from './cli-harness.js'
import { PRESET_TOKEN } from './verify-short-presets.js'

async function prompt(home: string, cancel: boolean): Promise<void> {
  await fs.mkdir(path.join(home, '.claude'))
  const session = new CliSession({
    args: [process.execPath, 'dist/cli.js', 'add', '--preset', 'openrouter'],
    env: terminalEnv(home, { CCSET_HOME: home, CCSET_LOCALE: 'en' }),
  })
  try {
    await session.waitFor('API key (input hidden;')
    session.send(cancel ? CTRL_C : `${PRESET_TOKEN}${ENTER}`)
    await session.waitFor(cancel ? 'Cancelled.' : 'Next, select the saved provider:')
    await session.waitExit()
    assert.equal(session.snapshot().includes(PRESET_TOKEN), false, 'the terminal echoed the key')
    const file = path.join(home, '.claude/settings.openrouter.json')
    if (cancel) await assert.rejects(fs.access(file))
    else assert.ok((await fs.readFile(file, 'utf8')).includes(PRESET_TOKEN))
  } finally {
    await session.stop()
  }
}

export async function verifyPresetPrompt(): Promise<void> {
  await withHome('preset-pty-save', (home) => prompt(home, false))
  await withHome('preset-pty-cancel', (home) => prompt(home, true))
  await withHome('agent-env-pty', checkTuiSelector)
}

async function checkTuiSelector(home: string): Promise<void> {
  const session = new CliSession({
    args: [process.execPath, 'dist/cli.js'],
    env: terminalEnv(home, { CCSET_HOME: home, CCSET_LOCALE: 'en', CCSET_AGENT: 'invalid-secret-selector' }),
  })
  try {
    await session.waitFor('Unknown agent: [redacted].')
    await session.waitExit()
    assert.equal(session.snapshot().includes('invalid-secret-selector'), false)
    assert.deepEqual(await fs.readdir(home), [])
  } finally {
    await session.stop()
  }
}
