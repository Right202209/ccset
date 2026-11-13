import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { AGENTS } from '../src/registry.js'
import { explicitSelection, selectCommandAgent } from '../src/commands/selection.js'
import { CcsetError, EXIT_USAGE } from '../src/core/errors.js'
import { runCli, withHome, asRecord } from './cli-harness.js'
import { verifyPresetCommands } from './verify-short-presets.js'
import { verifyShortUse, verifySessionRun } from './verify-short-use.js'
import { verifyPresetPrompt } from './verify-short-prompt.js'

async function checkSelection(home: string): Promise<void> {
  const agents = AGENTS.map((agent) => ({ ...agent, detect: async () => agent.id === 'codex' }))
  const args = await selectCommandAgent(['status'], agents, { ctx: { home }, interactive: true })
  assert.deepEqual(args, ['--agent', 'codex', 'status'])
  await assert.rejects(selectCommandAgent(['status'], agents, { ctx: { home }, interactive: false }),
    (err: unknown) => err instanceof CcsetError && err.exitCode === EXIT_USAGE && err.params['candidates'] === 'codex')
  await assert.rejects(selectCommandAgent(['status'], AGENTS.map((agent) => ({ ...agent, detect: async () => true })),
    { ctx: { home }, interactive: true }), /cli.usage.selectAgent/)
  await assert.rejects(selectCommandAgent(['status'], AGENTS.map((agent) => ({ ...agent, detect: async () => { throw new Error() } })),
    { ctx: { home }, interactive: true }), /cli.usage.selectAgent/)
  assert.deepEqual(explicitSelection(['codex', 'status'], AGENTS, 'pi'), ['--agent', 'codex', 'status'])
  assert.throws(() => explicitSelection(['codex', 'status', '--agent', 'pi'], AGENTS), /agentConflict/)
  await fs.mkdir(path.join(home, '.codex'))
  const missing = await runCli(['status', '--json'], { CCSET_HOME: home })
  assert.equal(missing.code, EXIT_USAGE)
  assert.match(missing.stdout, /codex/, JSON.stringify(missing))
  const selected = await runCli(['status', '--json'], { CCSET_HOME: home, CCSET_AGENT: 'pi' })
  assert.equal(asRecord(JSON.parse(selected.stdout))['agent'], 'pi')
  const explicit = await runCli(['codex', 'status', '--json'], { CCSET_HOME: home, CCSET_AGENT: 'pi', CODEX_HOME: undefined })
  assert.equal(asRecord(JSON.parse(explicit.stdout))['agent'], 'codex')
  const bad = await runCli(['status', '--json'], { CCSET_HOME: home, CCSET_AGENT: 'secret-invalid-agent' })
  assert.equal(bad.stdout.includes('secret-invalid-agent'), false)
  const conflict = await runCli(['codex', 'status', '--agent', 'pi', '--json'], { CCSET_HOME: home })
  assert.equal(conflict.code, EXIT_USAGE)
  assert.equal(asRecord(JSON.parse(conflict.stdout))['ok'], false)
  for (const args of [
    ['--agent', 'codex', '--agent', 'pi', 'status'],
    ['--agent=', 'status'],
    ['--agent', 'secret-invalid-agent', 'add', '--preset', 'unknown'],
  ]) {
    const invalid = await runCli([...args, '--json'], { CCSET_HOME: home })
    assert.notEqual(invalid.code, 0)
    assert.equal(invalid.stdout.includes('secret-invalid-agent'), false)
    assert.equal(asRecord(JSON.parse(invalid.stdout))['ok'], false)
  }
}

await withHome('short-selection', checkSelection)
await verifyPresetCommands()
await verifyShortUse()
await withHome('session with spaces', verifySessionRun)
await verifyPresetPrompt()
process.stdout.write('Short commands, presets, activation and hidden-key PTY verification passed.\n')
