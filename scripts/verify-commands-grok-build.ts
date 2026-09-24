import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { backupsDir, configPath } from '../src/agents/grok-build/paths.js'
import { findTomlProblem, readTomlObject } from '../src/core/toml/index.js'
import {
  EXIT_INVALID_CONFIG,
  EXIT_RUNTIME,
  EXIT_UNKNOWN_AGENT,
  EXIT_UNSUPPORTED_COMMAND,
  EXIT_USAGE,
} from '../src/core/errors.js'
import { runCli as spawnCli, withHome, type RunResult } from './cli-harness.js'

/**
 * grok-build's provider.set seam across the process boundary: provider
 * patches, the documented built-in-override shape, secret sources,
 * secret-free status, malformed-target refusals, and the exit codes the
 * command specification pins. global.set and provider.use live in
 * verify-commands-grok-build-use.ts; the TUI-side seam in verify-grok-build.ts.
 */

const SECRET = 'sk-TEST-DO-NOT-USE-9876543210'

const runCli = (args: string[], home: string, input: string | Buffer = ''): Promise<RunResult> =>
  spawnCli(args, { CCSET_HOME: home }, input)

async function writeConfig(home: string, text: string): Promise<void> {
  const target = configPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text, { mode: 0o600 })
}

async function configOf(home: string): Promise<Record<string, any>> {
  const { readTomlObject } = await import('../src/core/toml/index.js')
  return readTomlObject(await fs.readFile(configPath(home), 'utf8')) as Record<string, any>
}

async function backupCount(home: string): Promise<number> {
  return (await fs.readdir(backupsDir(home)).catch(() => [] as string[])).length
}

async function checkNewProvider(home: string): Promise<void> {
  const created = await runCli(
    [
      '--agent', 'grok-build', 'provider', 'set', 'relay',
      '--base-url', 'https://r.example/v1',
      '--model', 'claude-x',
      '--name', 'Relay',
      '--api-backend', 'messages',
      '--token-stdin',
      '--json',
    ],
    home,
    SECRET,
  )
  assert.equal(created.code, 0, `provider set failed: ${created.stderr}`)
  const envelope = JSON.parse(created.stdout) as {
    changed: boolean
    targets: { mode: string; backupPath: string | null }[]
  }
  assert.equal(envelope.changed, true)
  assert.equal(envelope.targets[0]?.mode, '0600', 'the created file was not 0600')
  assert.equal(envelope.targets[0]?.backupPath, null, 'a fresh file made a backup')
  assert.equal(await backupCount(home), 0, 'a fresh file made a backup on disk')
  const block = (await configOf(home))['model']['relay']
  assert.equal(block['base_url'], 'https://r.example/v1')
  assert.equal(block['model'], 'claude-x')
  assert.equal(block['name'], 'Relay')
  assert.equal(block['api_backend'], 'messages')
  assert.equal(block['api_key'], SECRET)

  // The documented built-in override: an id that names a built-in model may
  // set only the fields it overrides, so no base_url is required.
  const override = await runCli(
    ['--agent', 'grok-build', 'provider', 'set', 'grok46', '--token-stdin', '--json'],
    home,
    SECRET,
  )
  assert.equal(override.code, 0, 'a built-in-override block was refused: ' + override.stderr)
  assert.equal((await configOf(home))['model']['grok46']['api_key'], SECRET)
}

async function checkPatchSemantics(home: string): Promise<void> {
  await writeConfig(
    home,
    '# keep me\n[model.relay]\nmodel = "claude-x"\nbase_url = "https://r.example/v1"\nname = "Relay"\napi_backend = "messages"\napi_key = "old-key-0123456789"\nextra_headers = { "x-custom" = "keep" }\n',
  )
  const edited = await runCli(
    ['--agent', 'grok-build', 'provider', 'set', 'relay', '--base-url', 'https://n.example/v1', '--json'],
    home,
  )
  assert.equal(edited.code, 0, `provider edit failed: ${edited.stderr}`)
  const raw = await fs.readFile(configPath(home), 'utf8')
  assert.match(raw, /keep me/, 'the TOML comment did not survive')
  const block = (await configOf(home))['model']['relay']
  assert.equal(block['base_url'], 'https://n.example/v1')
  assert.deepEqual(block['extra_headers'], { 'x-custom': 'keep' }, 'unmanaged provider keys were lost')
  assert.equal(block['api_key'], 'old-key-0123456789', 'an omitted secret did not preserve the disk value')
  assert.equal(block['model'], 'claude-x', 'an omitted field did not preserve the disk value')

  const unset = await runCli(['--agent', 'grok-build', 'provider', 'set', 'relay', '--unset', 'displayName', '--unset', 'apiBackend', '--json'], home)
  assert.equal(unset.code, 0)
  const after = (await configOf(home))['model']['relay']
  assert.equal('name' in after, false, '--unset name did not delete')
  assert.equal('api_backend' in after, false, '--unset apiBackend did not delete')

  const badChoice = await runCli(['--agent', 'grok-build', 'provider', 'set', 'relay', '--api-backend', 'grpc'], home)
  assert.equal(badChoice.code, EXIT_USAGE, 'an invalid choice was not a usage error')
  const badUrl = await runCli(['--agent', 'grok-build', 'provider', 'set', 'relay', '--base-url', 'not-a-url'], home)
  assert.equal(badUrl.code, EXIT_USAGE, 'a malformed URL was not a usage error')
  const badId = await runCli(['--agent', 'grok-build', 'provider', 'set', '../escape', '--base-url', 'https://x.example'], home)
  assert.equal(badId.code, EXIT_USAGE, 'a path-traversal id was not a usage error')
}

async function checkDryRunAndNoOp(home: string): Promise<void> {
  await writeConfig(home, '[model.relay]\nbase_url = "https://r.example/v1"\napi_key = "k-0123456789"\n')
  const dry = await runCli(
    ['--agent', 'grok-build', 'provider', 'set', 'relay', '--base-url', 'https://dry.example/v1', '--dry-run', '--json'],
    home,
  )
  assert.equal(dry.code, 0)
  const envelope = JSON.parse(dry.stdout) as { changed: boolean; dryRun: boolean; targets: { backupPath: string | null }[] }
  assert.equal(envelope.dryRun, true)
  assert.equal(envelope.changed, true)
  assert.equal(envelope.targets[0]?.backupPath, null)
  assert.equal((await configOf(home))['model']['relay']['base_url'], 'https://r.example/v1', 'a dry run wrote')
  assert.equal(await backupCount(home), 0, 'a dry run made a backup')

  const noOp = await runCli(
    ['--agent', 'grok-build', 'provider', 'set', 'relay', '--base-url', 'https://r.example/v1'],
    home,
  )
  assert.equal(noOp.code, 0)
  assert.match(noOp.stdout, /Changed: no/, 'a no-op claimed a change')
  assert.equal(await backupCount(home), 0, 'a no-op made a backup')
}

async function checkStatusAndSecrets(home: string): Promise<void> {
  await writeConfig(home, '[model.relay]\nbase_url = "https://r.example/v1"\napi_key = "' + SECRET + '"\n')
  const status = await runCli(['--agent', 'grok-build', 'status', '--json'], home)
  assert.equal(status.code, 0, `status failed: ${status.stderr}`)
  const envelope = JSON.parse(status.stdout) as {
    data: { config: unknown; providers: { id: string; apiKeyPresent?: boolean }[]; authFile?: unknown }
  }
  assert.equal(envelope.data.providers[0]?.apiKeyPresent, true, 'status lost the key-presence flag')
  assert.equal(JSON.stringify(envelope.data).includes(SECRET), false, 'the key leaked into the JSON status')
  const human = await runCli(['--agent', 'grok-build', 'status'], home)
  assert.equal(human.code, 0)
  assert.equal(human.stdout.includes(SECRET), false, 'the key leaked into the human report')
  assert.ok(human.stdout.includes('relay'), 'the human report lost the provider section')
  assert.equal(`${human.stdout}${human.stderr}`.includes('\x1b'), false, 'ANSI reached status')
  const stdin = await runCli(
    ['--agent', 'grok-build', 'provider', 'set', 'relay', '--base-url', 'https://r.example/v1', '--token-stdin'],
    home,
    SECRET,
  )
  assert.equal(stdin.code, 0, 'a secret through stdin was refused: ' + stdin.stderr)
  const envToken = await spawnCli(
    ['--agent', 'grok-build', 'provider', 'set', 'fromenv', '--base-url', 'https://e.example/v1', '--json'],
    { CCSET_HOME: home, CCSET_TOKEN: SECRET },
  )
  assert.equal(envToken.code, 0, 'a secret through CCSET_TOKEN was refused: ' + envToken.stderr)
  assert.equal((await configOf(home))['model']['fromenv']?.['api_key'], SECRET, 'the CCSET_TOKEN key did not land')
  const conflict = await spawnCli(
    ['--agent', 'grok-build', 'provider', 'set', 'relay', '--base-url', 'https://r.example/v1', '--token-stdin'],
    { CCSET_HOME: home, CCSET_TOKEN: SECRET },
    SECRET,
  )
  assert.equal(conflict.code, EXIT_USAGE, 'two secret sources were not a usage error')
}

async function checkMalformed(home: string): Promise<void> {
  await writeConfig(home, '[ broken\n')
  const refused = await runCli(
    ['--agent', 'grok-build', 'provider', 'set', 'relay', '--base-url', 'https://r.example/v1'],
    home,
    SECRET,
  )
  assert.equal(refused.code, EXIT_INVALID_CONFIG, 'a malformed target was not refused')
  assert.equal(await fs.readFile(configPath(home), 'utf8'), '[ broken\n', 'the malformed original was touched')
  const status = await runCli(['--agent', 'grok-build', 'status', '--json'], home)
  assert.equal(status.code, EXIT_INVALID_CONFIG, 'a status parse failure did not exit 4')
  const envelope = JSON.parse(status.stdout) as { ok: boolean; errors: unknown[]; data: { config: { parsed: boolean } } }
  assert.equal(envelope.ok, false)
  assert.ok(envelope.errors.length > 0, 'the parse failure raised no error finding')
  assert.equal(envelope.data.config.parsed, false)
  const replaced = await runCli(
    [
      '--agent', 'grok-build', 'provider', 'set', 'relay',
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
  assert.equal(await fs.readFile(path.join(backups, first), 'utf8'), '[ broken\n', 'the backup lost the original bytes')
}

async function checkScalarTableParent(home: string): Promise<void> {
  const original = 'model = "grok-4"\n'
  await writeConfig(home, original)
  const result = await runCli(
    [
      '--agent', 'grok-build', 'provider', 'set', 'myprov',
      '--base-url', 'https://provider.example/v1',
      '--token-stdin',
      '--json',
    ],
    home,
    SECRET,
  )
  assert.equal(result.code, EXIT_RUNTIME, 'a scalar TOML parent was not refused')
  assert.equal(await fs.readFile(configPath(home), 'utf8'), original, 'the failed edit changed config bytes')
  assert.equal(await backupCount(home), 0, 'the refused edit created a backup')
}

async function checkInlineUnset(home: string): Promise<void> {
  const original = 'model = { relay = { base_url = "https://r.example/v1", api_key = "old-key-0123456789" } }\n'
  await writeConfig(home, original)
  const result = await runCli(
    ['--agent', 'grok-build', 'provider', 'set', 'relay', '--unset', 'baseUrl', '--json'],
    home,
  )
  assert.equal(result.code, 0, `inline-table unset failed: ${result.stderr}`)
  assert.equal((JSON.parse(result.stdout) as { changed: boolean }).changed, true)
  const raw = await fs.readFile(configPath(home), 'utf8')
  assert.equal(findTomlProblem(raw), null, 'inline-table unset produced invalid TOML')
  const block = (readTomlObject(raw) as Record<string, any>)['model']['relay']
  assert.equal('base_url' in block, false, 'the inline-table key survived --unset')
  assert.equal(block['api_key'], 'old-key-0123456789', 'an unmanaged inline-table sibling was lost')
}

async function checkCommandsSurface(home: string): Promise<void> {
  const unsupported = await runCli(['--agent', 'grok-build', 'state', 'init'], home)
  assert.equal(unsupported.code, EXIT_UNSUPPORTED_COMMAND, 'an undeclared operation was not unsupported')
  const unknown = await runCli(['--agent', 'nobody', 'status'], home)
  assert.equal(unknown.code, EXIT_UNKNOWN_AGENT, 'an unknown agent was not rejected')
  const conflict = await runCli(
    ['--agent', 'grok-build', 'provider', 'set', 'relay', '--unset', 'name', '--name', 'X'],
    home,
  )
  assert.equal(conflict.code, EXIT_USAGE, 'an unset with a value for the same field was not refused')
  const dryStatus = await runCli(['--agent', 'grok-build', 'status', '--dry-run'], home)
  assert.equal(dryStatus.code, EXIT_USAGE, 'status accepted --dry-run')
  const fresh = await runCli(['--agent', 'grok-build', 'status', '--json'], home)
  assert.equal(fresh.code, 0, 'status on an empty home failed')
  const envelope = JSON.parse(fresh.stdout) as { data: { config: { exists: boolean }; providers: unknown[] } }
  assert.equal(envelope.data.config.exists, false)
  assert.deepEqual(envelope.data.providers, [])
}

async function main(): Promise<void> {
  await withHome('grok-new-provider', checkNewProvider)
  await withHome('grok-patch', checkPatchSemantics)
  await withHome('grok-scalar-parent', checkScalarTableParent)
  await withHome('grok-inline-unset', checkInlineUnset)
  await withHome('grok-dry-run', checkDryRunAndNoOp)
  await withHome('grok-status', checkStatusAndSecrets)
  await withHome('grok-malformed', checkMalformed)
  await withHome('grok-surface', checkCommandsSurface)
  process.stdout.write('grok-build command verification passed.\n')
}

await main()
