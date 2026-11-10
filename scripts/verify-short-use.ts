import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { AGENTS } from '../src/registry.js'
import { EXIT_INVALID_CONFIG, EXIT_RUNTIME, EXIT_USAGE } from '../src/core/errors.js'
import { asRecord, runCli, withHome } from './cli-harness.js'
import { PRESET_TOKEN } from './verify-short-presets.js'

async function checkUse(home: string, agent: string): Promise<void> {
  const env = { CCSET_HOME: home, CCSET_TOKEN: PRESET_TOKEN, CODEX_HOME: undefined }
  const added = await runCli([agent, 'add', 'relay', '--preset', 'openrouter', '--json'], env)
  assert.equal(added.code, 0, added.stdout + added.stderr)
  const args = [agent, 'use', 'relay', '--json']
  if (agent === 'codex') args.push('--model', 'openai/gpt-5.4')
  const dry = await runCli([...args, '--dry-run'], env)
  assert.equal(dry.code, 0, dry.stdout + dry.stderr)
  const result = await runCli(args, env)
  assert.equal(result.code, 0, result.stdout + result.stderr)
  const body = asRecord(JSON.parse(result.stdout))
  assert.equal(body['activation'], agent === 'claude-code' ? 'session' : 'next-start')
  const targets = body['targets'] as { path: string }[]
  if (agent === 'codex') assert.match(await fs.readFile(targets[0]?.path ?? '', 'utf8'), /model = "openai\/gpt-5.4"/)
  const again = await runCli(args, env)
  assert.equal(asRecord(JSON.parse(again.stdout))['changed'], false)
  assert.equal(result.stdout.includes(PRESET_TOKEN), false)
}

async function checkOpencodeSafety(home: string): Promise<void> {
  const directory = path.join(home, '.config/opencode')
  await fs.mkdir(directory, { recursive: true })
  const target = path.join(directory, 'opencode.jsonc')
  const original = '{\n  // keep this comment\n  "custom": {"keep": true},\n  "provider": {"relay": {"models": {"one": {"limit": 10}, "two": {}}}}\n}\n'
  await fs.writeFile(target, original)
  const args = ['opencode', 'use', 'relay', '--model', 'two', '--json']
  const env = { CCSET_HOME: home }
  const dry = await runCli([...args, '--dry-run'], env)
  assert.equal(dry.code, 0, dry.stdout + dry.stderr)
  assert.equal(await fs.readFile(target, 'utf8'), original)
  assert.deepEqual(await fs.readdir(directory), ['opencode.jsonc'])
  const used = await runCli(args, env)
  assert.equal(used.code, 0, used.stdout + used.stderr)
  const bytes = await fs.readFile(target, 'utf8')
  assert.ok(bytes.includes('// keep this comment') && bytes.includes('"limit": 10') && bytes.includes('"keep": true'))
  assert.match(bytes, /"model": "relay\/two"/)
  const records = asRecord(JSON.parse(used.stdout))['targets'] as { backupPath: string }[]
  assert.equal(await fs.readFile(records[0]?.backupPath ?? '', 'utf8'), original)
  await fs.writeFile(target, original.replace('"custom"', '"disabled_providers": ["relay"], "custom"'))
  assert.equal((await runCli(args, env)).code, EXIT_RUNTIME)
  await fs.writeFile(target, '{broken')
  assert.equal((await runCli(args, env)).code, EXIT_INVALID_CONFIG)
  assert.equal(await fs.readFile(target, 'utf8'), '{broken')
}

export async function verifySessionRun(home: string): Promise<void> {
  const env = { CCSET_HOME: home, CCSET_TOKEN: PRESET_TOKEN }
  assert.equal((await runCli(['claude-code', 'add', 'relay', '--preset', 'openrouter'], env)).code, 0)
  const capture = path.join(home, 'captured.json')
  const executable = path.join(home, 'claude')
  await fs.writeFile(executable, `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(capture)}, JSON.stringify(process.argv.slice(2)))\nprocess.stdout.write('agent output\\n')\nprocess.exitCode = 23\n`, { mode: 0o700 })
  const childEnv = { ...env, PATH: `${home}${path.delimiter}${process.env['PATH'] ?? ''}` }
  const dry = await runCli(['claude-code', 'run', 'relay', '--dry-run', '--json', '--', '--help'], childEnv)
  assert.equal(dry.code, 0)
  await assert.rejects(fs.access(capture))
  const literal = 'literal;$(no-shell) with spaces'
  const result = await runCli(['claude-code', 'run', 'relay', '--', '--help', '--json', '--agent', literal], childEnv)
  assert.equal(result.code, 23)
  assert.equal(result.stdout, 'agent output\n')
  assert.deepEqual(JSON.parse(await fs.readFile(capture, 'utf8')), ['--settings', path.join(home, '.claude/settings.relay.json'), '--help', '--json', '--agent', literal])
  assert.equal((await runCli(['claude-code', 'run', 'relay', '--json'], childEnv)).code, EXIT_USAGE)
  assert.equal((await runCli(['claude-code', 'run', 'relay'], { ...env, PATH: '/no-executable-here' })).code, EXIT_RUNTIME)
  await assert.rejects(fs.access(path.join(home, '.claude/settings.json')))
}

export async function verifyShortUse(): Promise<void> {
  await withHome('opencode-use-safety', checkOpencodeSafety)
  for (const agent of AGENTS) await withHome(`use-${agent.id}`, (home) => checkUse(home, agent.id))
}
