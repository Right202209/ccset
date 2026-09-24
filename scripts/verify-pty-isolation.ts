import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CliSession, terminalEnv } from './pty-session.js'

const OVERRIDES = ['XDG_CONFIG_HOME', 'PI_CODING_AGENT_DIR', 'GROK_HOME', 'CODEX_HOME']

async function main(): Promise<void> {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-pty-isolation-'))
  const home = path.join(scratch, 'home')
  const sentinels = Object.fromEntries(
    OVERRIDES.map((name) => [name, path.join(scratch, 'sentinels', name)]),
  )
  const env = terminalEnv(home, { CCSET_HOME: home, ...sentinels })
  const childScript = `
    const fs = require('node:fs')
    const path = require('node:path')
    const names = ${JSON.stringify(OVERRIDES)}
    for (const name of names) {
      if (process.env[name]) {
        const target = path.join(process.env[name], 'ccset-write')
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, 'leaked')
      }
    }
    process.stdout.write('OVERRIDES:' + JSON.stringify(names.filter((name) => process.env[name])))
  `
  const session = new CliSession({ args: [process.execPath, '-e', childScript], env })
  try {
    await session.waitFor('OVERRIDES:[]')
    assert.equal(await session.waitExit(), 0)
    assert.equal(session.snapshot(), 'OVERRIDES:[]')
    await assert.rejects(fs.access(path.join(scratch, 'sentinels')), { code: 'ENOENT' })
  } finally {
    await session.stop()
    await fs.rm(scratch, { recursive: true, force: true })
  }
  process.stdout.write('PTY environment isolation verification passed.\n')
}

await main()
