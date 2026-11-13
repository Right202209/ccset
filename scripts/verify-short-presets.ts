import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { PRESETS } from '../src/commands/preset-catalog.js'
import { EXIT_USAGE } from '../src/core/errors.js'
import { asRecord, runCli, withHome } from './cli-harness.js'

export const PRESET_TOKEN = 'sk-TEST-DO-NOT-USE-preset'

async function checkPreset(home: string, preset: string, agent: string): Promise<void> {
  const args = [agent, 'add', 'relay', '--preset', preset, '--json']
  const env = { CCSET_HOME: home, CCSET_TOKEN: PRESET_TOKEN, CODEX_HOME: undefined }
  const dry = await runCli([...args, '--dry-run'], env)
  assert.equal(dry.code, 0, dry.stdout + dry.stderr)
  assert.deepEqual(await fs.readdir(home), [], 'dry-run created a file or backup')
  const added = await runCli(args, env)
  assert.equal(added.code, 0, added.stdout + added.stderr)
  assert.equal(added.stdout.includes(PRESET_TOKEN), false)
  const body = asRecord(JSON.parse(added.stdout))
  assert.equal(body['operation'], 'provider.set')
  assert.match(String(body['nextCommand']), /^ccset \S+ use relay/)
  const targets = body['targets'] as { path: string }[]
  const before = await Promise.all(targets.map((target) => fs.readFile(target.path, 'utf8')))
  const again = await runCli(args, env)
  assert.equal(asRecord(JSON.parse(again.stdout))['changed'], false)
  for (const [index, target] of targets.entries()) {
    assert.equal(await fs.readFile(target.path, 'utf8'), before[index])
    if (process.platform !== 'win32') assert.equal((await fs.stat(target.path)).mode & 0o777, 0o600)
  }
  const conflict = await runCli([...args, '--token-stdin'], env, PRESET_TOKEN)
  assert.equal(conflict.code, EXIT_USAGE)
  assert.equal(conflict.stdout.includes(PRESET_TOKEN), false)
}

async function checkErrors(home: string): Promise<void> {
  const env = { CCSET_HOME: home, CCSET_TOKEN: undefined }
  for (const args of [
    ['codex', 'add', '--preset', 'deepseek'],
    ['pi', 'add', '--preset', 'unknown-secret-value'],
    ['pi', 'add', '--preset', 'openrouter'],
    ['pi', 'add', '--preset'],
    ['pi', 'add', '--preset', 'openrouter', '--token', PRESET_TOKEN],
  ]) {
    const result = await runCli([...args, '--json'], env)
    assert.equal(result.code, EXIT_USAGE, result.stdout + result.stderr)
    assert.equal(result.stdout.includes('unknown-secret-value') || result.stdout.includes(PRESET_TOKEN), false)
  }
  assert.deepEqual(await fs.readdir(home), [])
  const listed = await runCli(['presets', 'list', 'OPENROUTER', '--json'], env)
  const entries = asRecord(asRecord(JSON.parse(listed.stdout))['data'])['presets'] as { id: string }[]
  assert.deepEqual(entries.map((entry) => entry.id), ['openrouter'])
  const human = await runCli(['presets', 'list'], env)
  assert.equal(human.code, 0, human.stdout + human.stderr)
  assert.deepEqual(human.stdout.trimEnd().split('\n').map((row) => row.split(' — ')[0]),
    PRESETS.map((preset) => preset.id), 'presets list did not print one preset per line')
  const piped = await runCli(['opencode', 'add', '--preset', 'openrouter', '--model', 'my-model', '--token-stdin', '--json'], env, `${PRESET_TOKEN}\n`)
  assert.equal(piped.code, 0, piped.stdout + piped.stderr)
  assert.match(piped.stdout, /openrouter-ccset/)
  const target = (asRecord(JSON.parse(piped.stdout))['targets'] as { path: string }[])[0]
  assert.ok(target)
  const bytes = await fs.readFile(target.path, 'utf8')
  assert.match(bytes, /my-model/)
  assert.equal(bytes.includes('anthropic/claude-sonnet-4.5'), false, 'an explicit model did not replace the preset default')
  const unset = await runCli(['opencode', 'add', '--preset', 'openrouter', '--unset', 'models', '--json'],
    { ...env, CCSET_TOKEN: PRESET_TOKEN })
  assert.equal(unset.code, 0, unset.stdout + unset.stderr)
  assert.equal((await fs.readFile(target.path, 'utf8')).includes('"models"'), false)
}

export async function verifyPresetCommands(): Promise<void> {
  for (const preset of PRESETS) {
    for (const agent of Object.keys(preset.agents)) {
      await withHome(`preset-${preset.id}-${agent}`, (home) => checkPreset(home, preset.id, agent))
    }
  }
  await withHome('preset-errors', checkErrors)
}
