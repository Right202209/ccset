import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { codexConfigPath, authProfilePath, backupsDir as codexBackups } from '../src/agents/codex/paths.js'
import { modelsFile, backupsDir } from '../src/agents/pi/paths.js'
import { saveProvider, seedProvider } from '../src/agents/pi/providers.js'
import { runCli } from './cli-harness.js'

export async function verifyCodexHomeRefusal(operation: 'global' | 'provider'): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-home-refusal-'))
  const config = codexConfigPath(home)
  const raw = '[model_providers.router]\nname = "Router"\nbase_url = "https://example.invalid"\n'
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, raw)
  const auth = authProfilePath(home, 'router')
  const credential = '{"OPENAI_API_KEY":"TEST-ONLY"}\n'
  await fs.writeFile(auth, credential)
  try {
    const args = operation === 'global' ? ['global', 'set', '--model', 'new'] : ['provider', 'set', 'router', '--display-name', 'New']
    for (const flags of [[], ['--dry-run']]) {
      const result = await runCli(['--agent', 'codex', ...args, ...flags, '--json'], {
        CCSET_HOME: home, CODEX_HOME: path.join(home, 'elsewhere'),
      })
      assert.notEqual(result.code, 0, `${operation} set accepted a home mismatch`)
      assert.equal(JSON.parse(result.stdout).error.code, 'codex.error.homeOverrideUnsupported')
      assert.equal(await fs.readFile(config, 'utf8'), raw)
      assert.equal(await fs.readFile(auth, 'utf8'), credential)
      assert.deepEqual(await fs.readdir(codexBackups(home)).catch(() => []), [])
    }
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

export async function verifyPiApiRemoval(home: string, surface: 'cli' | 'tui'): Promise<void> {
  const file = modelsFile(home)
  const data = { providers: { retained: { api: 'openai-completions', models: [{ id: 'm1' }] } } }
  const raw = JSON.stringify(data)
  await fs.mkdir(path.dirname(file.path), { recursive: true })
  await fs.writeFile(file.path, raw)
  const before = await fs.readdir(backupsDir(home)).catch(() => [])
  if (surface === 'tui') {
    await assert.rejects(() => saveProvider({ home }, { ...seedProvider(data, 'retained'), api: '' }))
  } else {
    for (const flags of [[], ['--model', 'm1'], ['--dry-run']]) {
      const result = await runCli(['--agent', 'pi', 'provider', 'set', 'retained', '--unset', 'api', ...flags, '--json'], { CCSET_HOME: home })
      assert.notEqual(result.code, 0, 'api removal left models without a protocol')
      assert.equal(JSON.parse(result.stdout).error.code, 'pi.validate.apiRequired')
    }
  }
  assert.equal(await fs.readFile(file.path, 'utf8'), raw)
  assert.deepEqual(await fs.readdir(backupsDir(home)).catch(() => []), before)
}
