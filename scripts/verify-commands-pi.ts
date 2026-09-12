import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { backupsDir, modelsPath } from '../src/agents/pi/paths.js'
import {
  EXIT_INVALID_CONFIG,
  EXIT_UNKNOWN_AGENT,
  EXIT_UNSUPPORTED_COMMAND,
  EXIT_USAGE,
} from '../src/core/errors.js'
import { runCli as spawnCli, withHome, type RunResult } from './cli-harness.js'

/**
 * pi's provider.set seam across the process boundary: provider patches, the
 * models merge, secret sources, secret-free status, malformed-target
 * refusals, and the exit codes the command specification pins. global.set and
 * provider.use live in verify-commands-pi-use.ts; the TUI-side seam in
 * verify-pi.ts.
 */

const SECRET = 'sk-TEST-DO-NOT-USE-9876543210'

const runCli = (args: string[], home: string, input: string | Buffer = ''): Promise<RunResult> =>
  spawnCli(args, { CCSET_HOME: home }, input)

async function writeModels(home: string, text: string): Promise<void> {
  const target = modelsPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text, { mode: 0o600 })
}

async function modelsOf(home: string): Promise<Record<string, any>> {
  const raw = await fs.readFile(modelsPath(home), 'utf8')
  const withoutLineComments = raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  return JSON.parse(withoutLineComments) as Record<string, any>
}

async function backupCount(home: string): Promise<number> {
  return (await fs.readdir(backupsDir(home)).catch(() => [] as string[])).length
}

async function checkNewProvider(home: string): Promise<void> {
  const missing = await runCli(
    ['--agent', 'pi', 'provider', 'set', 'router', '--base-url', 'https://r.example/v1', '--json'],
    home,
  )
  assert.equal(missing.code, 1, 'a new provider without a secret was accepted')
  assert.match(missing.stdout, /providerTokenRequired/)

  const created = await runCli(
    [
      '--agent', 'pi', 'provider', 'set', 'router',
      '--base-url', 'https://r.example/v1',
      '--api', 'anthropic-messages',
      '--model', 'm1',
      '--model', 'm2',
      '--token-stdin',
      '--json',
    ],
    home,
    SECRET,
  )
  assert.equal(created.code, 0, `provider set failed: ${created.stderr}`)
  const envelope = JSON.parse(created.stdout) as { changed: boolean; targets: { mode: string; backupPath: string | null }[] }
  assert.equal(envelope.changed, true)
  assert.equal(envelope.targets[0]?.mode, '0600', 'the created file was not 0600')
  assert.equal(envelope.targets[0]?.backupPath, null, 'a fresh file made a backup')
  assert.equal(await backupCount(home), 0, 'a fresh file made a backup on disk')
  const block = (await modelsOf(home))['providers']['router']
  assert.equal(block['baseUrl'], 'https://r.example/v1')
  assert.equal(block['api'], 'anthropic-messages')
  assert.equal(block['apiKey'], SECRET)
  assert.deepEqual(block['models'], [{ id: 'm1' }, { id: 'm2' }])

  const apiMissing = await runCli(
    [
      '--agent', 'pi', 'provider', 'set', 'other',
      '--base-url', 'https://o.example/v1',
      '--model', 'x',
      '--token-stdin',
      '--json',
    ],
    home,
    SECRET,
  )
  assert.equal(apiMissing.code, 1, 'a models-bearing provider without api was accepted')
  assert.match(apiMissing.stdout, /pi\.validate\.apiRequired/)
}

async function checkPatchSemantics(home: string): Promise<void> {
  await writeModels(
    home,
    '{\n  // keep me\n  "providers": { "router": { "baseUrl": "https://r.example/v1", "api": "anthropic-messages",\n    "headers": { "x-custom": "keep" }, "apiKey": "old-key-0123456789",\n    "models": [ { "id": "m1", "cost": { "input": 1, "output": 2, "cacheRead": 0, "cacheWrite": 0 } }, { "id": "m2" } ] } } }\n',
  )
  const edited = await runCli(
    ['--agent', 'pi', 'provider', 'set', 'router', '--base-url', 'https://n.example/v1', '--model', 'm1', '--model', 'm3', '--json'],
    home,
  )
  assert.equal(edited.code, 0, `provider edit failed: ${edited.stderr}`)
  const raw = await fs.readFile(modelsPath(home), 'utf8')
  assert.match(raw, /keep me/, 'the JSONC comment did not survive')
  const block = (await modelsOf(home))['providers']['router']
  assert.equal(block['baseUrl'], 'https://n.example/v1')
  assert.deepEqual(block['headers'], { 'x-custom': 'keep' }, 'unmanaged provider keys were lost')
  assert.equal(block['apiKey'], 'old-key-0123456789', 'an omitted secret did not preserve the disk value')
  const byId = new Map<string, any>(block['models'].map((member: any) => [member['id'], member]))
  assert.equal(byId.get('m1')?.['cost']?.['input'], 1, 'a member lost its unmanaged cost')
  assert.equal(byId.get('m2'), undefined, 'a dropped model survived')
  assert.equal(byId.get('m3')?.['id'], 'm3', 'a new model was not added')

  const unset = await runCli(['--agent', 'pi', 'provider', 'set', 'router', '--unset', 'models', '--json'], home)
  assert.equal(unset.code, 0)
  assert.equal('models' in (await modelsOf(home))['providers']['router'], false, '--unset models did not delete')
  const unsetApi = await runCli(['--agent', 'pi', 'provider', 'set', 'router', '--unset', 'api', '--json'], home)
  assert.equal(unsetApi.code, 0)
  assert.equal('api' in (await modelsOf(home))['providers']['router'], false, '--unset api did not delete')

  const badChoice = await runCli(['--agent', 'pi', 'provider', 'set', 'router', '--api', 'grpc'], home)
  assert.equal(badChoice.code, EXIT_USAGE, 'an invalid choice was not a usage error')
  const badId = await runCli(['--agent', 'pi', 'provider', 'set', '../escape', '--base-url', 'https://x.example'], home)
  assert.equal(badId.code, EXIT_USAGE, 'a path-traversal id was not a usage error')
}

async function checkDryRunAndNoOp(home: string): Promise<void> {
  await writeModels(home, '{"providers":{"router":{"baseUrl":"https://r.example/v1","apiKey":"k-0123456789"}}}')
  const dry = await runCli(
    ['--agent', 'pi', 'provider', 'set', 'router', '--base-url', 'https://dry.example/v1', '--dry-run', '--json'],
    home,
  )
  assert.equal(dry.code, 0)
  const envelope = JSON.parse(dry.stdout) as { changed: boolean; dryRun: boolean; targets: { backupPath: string | null }[] }
  assert.equal(envelope.dryRun, true)
  assert.equal(envelope.changed, true)
  assert.equal(envelope.targets[0]?.backupPath, null)
  assert.equal((await modelsOf(home))['providers']['router']['baseUrl'], 'https://r.example/v1', 'a dry run wrote')
  assert.equal(await backupCount(home), 0, 'a dry run made a backup')

  const noOp = await runCli(
    ['--agent', 'pi', 'provider', 'set', 'router', '--base-url', 'https://r.example/v1'],
    home,
  )
  assert.equal(noOp.code, 0)
  assert.match(noOp.stdout, /Changed: no/, 'a no-op claimed a change')
  assert.equal(await backupCount(home), 0, 'a no-op made a backup')
}

async function checkStatusAndSecrets(home: string): Promise<void> {
  await writeModels(home, '{"providers":{"router":{"baseUrl":"https://r.example/v1","apiKey":"' + SECRET + '"}}}')
  const status = await runCli(['--agent', 'pi', 'status', '--json'], home)
  assert.equal(status.code, 0, `status failed: ${status.stderr}`)
  const envelope = JSON.parse(status.stdout) as {
    data: { settings: unknown; providers: { id: string; apiKeyPresent?: boolean }[]; authFile?: unknown }
  }
  assert.equal(envelope.data.providers[0]?.apiKeyPresent, true, 'status lost the key-presence flag')
  assert.equal(JSON.stringify(envelope.data).includes(SECRET), false, 'the key leaked into the JSON status')
  const human = await runCli(['--agent', 'pi', 'status'], home)
  assert.equal(human.code, 0)
  assert.equal(human.stdout.includes(SECRET), false, 'the key leaked into the human report')
  assert.ok(human.stdout.includes('router'), 'the human report lost the provider section')
  assert.equal(`${human.stdout}${human.stderr}`.includes('\x1b'), false, 'ANSI reached status')
  const set = await runCli(
    ['--agent', 'pi', 'provider', 'set', 'router', '--base-url', 'https://r.example/v1', '--json'],
    home,
    SECRET,
  )
  assert.equal(set.code, 0)
  const stdin = await runCli(
    ['--agent', 'pi', 'provider', 'set', 'router', '--base-url', 'https://r.example/v1', '--token-stdin'],
    home,
    SECRET,
  )
  assert.equal(stdin.code, 0, 'a secret through stdin was refused: ' + stdin.stderr)
  const envToken = await spawnCli(
    [
      '--agent', 'pi', 'provider', 'set', 'fromenv',
      '--base-url', 'https://e.example/v1',
      '--api', 'openai-completions',
      '--json',
    ],
    { CCSET_HOME: home, CCSET_TOKEN: SECRET },
  )
  assert.equal(envToken.code, 0, 'a secret through CCSET_TOKEN was refused: ' + envToken.stderr)
  assert.equal((await modelsOf(home))['providers']['fromenv']?.['apiKey'], SECRET, 'the CCSET_TOKEN key did not land')
  const conflict = await spawnCli(
    ['--agent', 'pi', 'provider', 'set', 'router', '--base-url', 'https://r.example/v1', '--token-stdin'],
    { CCSET_HOME: home, CCSET_TOKEN: SECRET },
    SECRET,
  )
  assert.equal(conflict.code, EXIT_USAGE, 'two secret sources were not a usage error')
}

async function checkMalformed(home: string): Promise<void> {
  await writeModels(home, '{ broken\n')
  const refused = await runCli(
    ['--agent', 'pi', 'provider', 'set', 'router', '--base-url', 'https://r.example/v1'],
    home,
    SECRET,
  )
  assert.equal(refused.code, EXIT_INVALID_CONFIG, 'a malformed target was not refused')
  assert.equal(await fs.readFile(modelsPath(home), 'utf8'), '{ broken\n', 'the malformed original was touched')
  const status = await runCli(['--agent', 'pi', 'status', '--json'], home)
  assert.equal(status.code, EXIT_INVALID_CONFIG, 'a status parse failure did not exit 4')
  const envelope = JSON.parse(status.stdout) as { ok: boolean; errors: unknown[]; data: { models: { parsed: boolean } } }
  assert.equal(envelope.ok, false)
  assert.ok(envelope.errors.length > 0, 'the parse failure raised no error finding')
  assert.equal(envelope.data.models.parsed, false)
  const replaced = await runCli(
    [
      '--agent', 'pi', 'provider', 'set', 'router',
      '--base-url', 'https://r.example/v1',
      '--replace-invalid',
      '--token-stdin',
      '--json',
    ],
    home,
    SECRET,
  )
  assert.equal(replaced.code, 0, '--replace-invalid did not recover')
  const backups = backupsDir(home)
  const names = await fs.readdir(backups)
  assert.equal(names.length, 1, 'the malformed original was not backed up exactly once')
  const first = names[0]
  assert.ok(first, 'no backup name')
  assert.equal(await fs.readFile(path.join(backups, first), 'utf8'), '{ broken\n', 'the backup lost the original bytes')
}

async function checkCommandsSurface(home: string): Promise<void> {
  const unsupported = await runCli(['--agent', 'pi', 'state', 'init'], home)
  assert.equal(unsupported.code, EXIT_UNSUPPORTED_COMMAND, 'an undeclared operation was not unsupported')
  const unknown = await runCli(['--agent', 'nobody', 'status'], home)
  assert.equal(unknown.code, EXIT_UNKNOWN_AGENT, 'an unknown agent was not rejected')
  const conflict = await runCli(
    ['--agent', 'pi', 'provider', 'set', 'router', '--unset', 'models', '--model', 'm1'],
    home,
  )
  assert.equal(conflict.code, EXIT_USAGE, 'an unset with a value for the same field was not refused')
  const dryStatus = await runCli(['--agent', 'pi', 'status', '--dry-run'], home)
  assert.equal(dryStatus.code, EXIT_USAGE, 'status accepted --dry-run')
  const fresh = await runCli(['--agent', 'pi', 'status', '--json'], home)
  assert.equal(fresh.code, 0, 'status on an empty home failed')
  const envelope = JSON.parse(fresh.stdout) as { data: { settings: { exists: boolean }; providers: unknown[] } }
  assert.equal(envelope.data.settings.exists, false)
  assert.deepEqual(envelope.data.providers, [])
}

async function main(): Promise<void> {
  await withHome('pi-new-provider', checkNewProvider)
  await withHome('pi-patch', checkPatchSemantics)
  await withHome('pi-dry-run', checkDryRunAndNoOp)
  await withHome('pi-status', checkStatusAndSecrets)
  await withHome('pi-malformed', checkMalformed)
  await withHome('pi-surface', checkCommandsSurface)
  process.stdout.write('pi command verification passed.\n')
}

await main()
