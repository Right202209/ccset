import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { configPath } from '../src/agents/grok-build/paths.js'
import { EXIT_INVALID_CONFIG, EXIT_USAGE } from '../src/core/errors.js'
import { runCli as spawnCli, withHome, type RunResult } from './cli-harness.js'

/**
 * grok-build's global.set and provider.use across the process seam. The switch
 * writes the one startup leaf Grok reads (`models.default`), warns when the id
 * names no [model.*] block, and every refusal path names what it refused.
 * provider set lives in verify-commands-grok-build.ts.
 */

const runCli = (args: string[], home: string): Promise<RunResult> => spawnCli(args, { CCSET_HOME: home })

async function writeConfig(home: string, text: string): Promise<void> {
  const target = configPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text, { mode: 0o600 })
}

async function configOf(home: string): Promise<Record<string, any>> {
  const { readTomlObject } = await import('../src/core/toml/index.js')
  return readTomlObject(await fs.readFile(configPath(home), 'utf8')) as Record<string, any>
}

async function checkGlobalSet(home: string): Promise<void> {
  await writeConfig(home, '[models]\ntemperature = 0.5\n\n[cli]\nauto_update = false\n')
  const set = await runCli(['--agent', 'grok-build', 'global', 'set', '--model', 'relay', '--json'], home)
  assert.equal(set.code, 0, `global set failed: ${set.stderr}`)
  const config = await configOf(home)
  assert.equal(config['models']['temperature'], 0.5, 'an unmanaged models key was lost')
  assert.equal(config['cli']['auto_update'], false, 'an unmanaged table was lost')
  assert.equal(config['models']['default'], 'relay')
  const unset = await runCli(['--agent', 'grok-build', 'global', 'set', '--unset', 'defaultModel', '--json'], home)
  assert.equal(unset.code, 0)
  const cleared = await configOf(home)
  assert.equal('default' in cleared['models'], false, '--unset did not delete')
  assert.equal(cleared['models']['temperature'], 0.5, 'the unset disturbed a sibling')
  const empty = await runCli(['--agent', 'grok-build', 'global', 'set'], home)
  assert.equal(empty.code, EXIT_USAGE, 'a global set with no patch was not a usage error')
  // A built-in model id carries a dot, so it is not a ccset-manageable
  // provider id; the default's free-text field is what points at it.
  const builtin = await runCli(['--agent', 'grok-build', 'global', 'set', '--model', 'grok-4.5', '--json'], home)
  assert.equal(builtin.code, 0, 'a dotted built-in model id was refused for --model')
  assert.equal((await configOf(home))['models']['default'], 'grok-4.5')
}

async function checkProviderUse(home: string): Promise<void> {
  await writeConfig(home, '[models]\ntemperature = 0.5\n\n[model.relay]\nbase_url = "https://r.example/v1"\n')
  const use = await runCli(['--agent', 'grok-build', 'provider', 'use', 'relay', '--json'], home)
  assert.equal(use.code, 0, `provider use failed: ${use.stderr}`)
  const envelope = JSON.parse(use.stdout) as { warnings: unknown[] }
  assert.deepEqual(envelope.warnings, [], 'a known model id warned')
  assert.equal((await configOf(home))['models']['default'], 'relay')
  assert.equal((await configOf(home))['models']['temperature'], 0.5, 'the switch disturbed a sibling')

  // An id no [model.*] block defines draws the mismatch warning. A built-in
  // model id whose spelling carries a dot is not a ccset-manageable id at all
  // (the shared name pattern excludes it); pointing the default at one goes
  // through `global set --model`, which is free text.
  const unknown = await runCli(['--agent', 'grok-build', 'provider', 'use', 'nosuch', '--json'], home)
  assert.equal(unknown.code, 0, 'an unknown id was refused')
  const unknownEnvelope = JSON.parse(unknown.stdout) as { warnings: { code: string }[] }
  assert.equal(
    unknownEnvelope.warnings[0]?.code,
    'grokBuild.warning.modelNotInSection',
    'an id with no [model.*] block did not warn',
  )

  const unset = await runCli(['--agent', 'grok-build', 'global', 'set', '--unset', 'defaultModel', '--json'], home)
  assert.equal(unset.code, 0)
  const unchanged = await runCli(['--agent', 'grok-build', 'provider', 'use', 'nosuch', '--json'], home)
  assert.equal(unchanged.code, 0)
  const unchangedEnvelope = JSON.parse(unchanged.stdout) as { changed: boolean }
  assert.equal(unchangedEnvelope.changed, true, 'a switch to a new value claimed no change')

  await writeConfig(home, '[ broken\n')
  const refused = await runCli(['--agent', 'grok-build', 'provider', 'use', 'relay'], home)
  assert.equal(refused.code, EXIT_INVALID_CONFIG, 'a malformed target was not refused')
  const replaced = await runCli(
    ['--agent', 'grok-build', 'provider', 'use', 'relay', '--replace-invalid', '--json'],
    home,
  )
  assert.equal(replaced.code, 0, '--replace-invalid did not recover')
  assert.equal((await configOf(home))['models']['default'], 'relay')
  const dry = await runCli(
    ['--agent', 'grok-build', 'provider', 'use', 'relay', '--dry-run', '--json'],
    home,
  )
  assert.equal(dry.code, 0)
  const dryEnvelope = JSON.parse(dry.stdout) as { dryRun: boolean; targets: { backupPath: string | null }[] }
  assert.equal(dryEnvelope.dryRun, true)
  assert.equal(dryEnvelope.targets[0]?.backupPath, null, 'a dry run planned a backup')
  const badId = await runCli(['--agent', 'grok-build', 'provider', 'use', '../escape'], home)
  assert.equal(badId.code, EXIT_USAGE, 'a path-traversal id was not a usage error')
}

async function main(): Promise<void> {
  await withHome('grok-global', checkGlobalSet)
  await withHome('grok-use', checkProviderUse)
  process.stdout.write('grok-build global and use command verification passed.\n')
}

await main()
