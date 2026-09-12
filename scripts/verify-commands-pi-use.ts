import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { modelsPath, settingsPath } from '../src/agents/pi/paths.js'
import { EXIT_INVALID_CONFIG, EXIT_USAGE } from '../src/core/errors.js'
import { runCli as spawnCli, withHome, type RunResult } from './cli-harness.js'

/**
 * pi's global.set and provider.use across the process seam. The switch is
 * pinned to writing BOTH startup leaves -- pi ignores a saved default provider
 * without a model -- and every refusal path names what it refused. provider
 * set lives in verify-commands-pi.ts.
 */

const runCli = (args: string[], home: string): Promise<RunResult> => spawnCli(args, { CCSET_HOME: home })

async function writeModels(home: string, text: string): Promise<void> {
  const target = modelsPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text, { mode: 0o600 })
}

async function writeSettings(home: string, text: string): Promise<void> {
  const target = settingsPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text, { mode: 0o600 })
}

async function settingsOf(home: string): Promise<Record<string, any>> {
  return JSON.parse(await fs.readFile(settingsPath(home), 'utf8')) as Record<string, any>
}

async function checkGlobalSet(home: string): Promise<void> {
  await writeSettings(home, '{\n  "theme": "dark"\n}\n')
  const set = await runCli(
    [
      '--agent', 'pi', 'global', 'set',
      '--provider', 'router', '--model', 'm1', '--thinking-level', 'high', '--json',
    ],
    home,
  )
  assert.equal(set.code, 0, `global set failed: ${set.stderr}`)
  const config = await settingsOf(home)
  assert.equal(config['theme'], 'dark', 'an unmanaged settings key was lost')
  assert.equal(config['defaultProvider'], 'router')
  assert.equal(config['defaultModel'], 'm1')
  assert.equal(config['defaultThinkingLevel'], 'high')
  const unset = await runCli(['--agent', 'pi', 'global', 'set', '--unset', 'defaultThinkingLevel', '--json'], home)
  assert.equal(unset.code, 0)
  assert.equal('defaultThinkingLevel' in (await settingsOf(home)), false, '--unset did not delete')
  const bad = await runCli(['--agent', 'pi', 'global', 'set', '--thinking-level', 'sometimes'], home)
  assert.equal(bad.code, EXIT_USAGE, 'an invalid choice was not a usage error')
}

async function checkProviderUse(home: string): Promise<void> {
  await writeModels(
    home,
    '{"providers":{"router":{"baseUrl":"https://r.example/v1","api":"anthropic-messages","models":[{"id":"m1"},{"id":"m2"}]}}}',
  )
  const use = await runCli(['--agent', 'pi', 'provider', 'use', 'router', '--json'], home)
  assert.equal(use.code, 0, `provider use failed: ${use.stderr}`)
  assert.deepEqual(await settingsOf(home), { defaultProvider: 'router', defaultModel: 'm1' }, 'use wrote the wrong defaults')

  const explicit = await runCli(['--agent', 'pi', 'provider', 'use', 'router', '--model', 'm2', '--json'], home)
  assert.equal(explicit.code, 0)
  assert.equal((await settingsOf(home))['defaultModel'], 'm2')

  const warn = await runCli(['--agent', 'pi', 'provider', 'use', 'router', '--model', 'nosuch', '--json'], home)
  assert.equal(warn.code, 0)
  const envelope = JSON.parse(warn.stdout) as { warnings: { code: string }[] }
  assert.equal(envelope.warnings[0]?.code, 'pi.warning.modelNotInList', 'an off-list model did not warn')

  const noModels = await runCli(['--agent', 'pi', 'provider', 'use', 'empty', '--json'], home)
  assert.equal(noModels.code, 1, 'a provider without models was accepted without --model')
  assert.match(noModels.stdout, /pi\.validate\.providerModelRequired/)

  await writeModels(home, '{ broken\n')
  const unreadable = await runCli(['--agent', 'pi', 'provider', 'use', 'router', '--json'], home)
  assert.equal(unreadable.code, 1, 'an unreadable models.json was accepted for default resolution')
  assert.match(unreadable.stdout, /pi\.validate\.modelsUnreadable/)
  const explicitStill = await runCli(['--agent', 'pi', 'provider', 'use', 'router', '--model', 'm1', '--json'], home)
  assert.equal(explicitStill.code, 0, 'an explicit --model should not need models.json')

  await writeSettings(home, '{ broken\n')
  const refused = await runCli(['--agent', 'pi', 'provider', 'use', 'router', '--model', 'm1'], home)
  assert.equal(refused.code, EXIT_INVALID_CONFIG, 'a malformed settings target was not refused')
  const replaced = await runCli(
    ['--agent', 'pi', 'provider', 'use', 'router', '--model', 'm1', '--replace-invalid', '--json'],
    home,
  )
  assert.equal(replaced.code, 0, '--replace-invalid did not recover')
  assert.equal((await settingsOf(home))['defaultProvider'], 'router')
}

async function main(): Promise<void> {
  await withHome('pi-global', checkGlobalSet)
  await withHome('pi-use', checkProviderUse)
  process.stdout.write('pi global and use command verification passed.\n')
}

await main()
