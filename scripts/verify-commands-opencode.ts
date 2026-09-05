import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { backupsDir, opencodeConfigPath, opencodeJsoncPath } from '../src/agents/opencode/paths.js'
import { EXIT_INVALID_CONFIG, EXIT_USAGE } from '../src/core/errors.js'
import { runCli as spawnCli, type RunResult } from './cli-harness.js'

/**
 * M3.4: opencode status and global set, across the process seam. The one
 * document must keep every unmanaged key at every nesting level, write
 * opencode's real boolean and list shapes, delete only what --unset names,
 * and report status without secret material -- holding exit 4 on a parse
 * failure while the readable sections still ship. With a managed `.jsonc`
 * beside a legacy `.json`, reads and writes land in the `.jsonc` -- comments
 * intact -- and the legacy file is named but never rewritten.
 */

const API_KEY = 'OC-FIXTURE-SECRET-0123456789'

const ORIGINAL = `{
  "$schema": "https://opencode.ai/config.json",
  "theme": "tokyonight",
  "keybinds": { "leader": "ctrl+x", "deep": { "deeper": { "leaf": 1 } } },
  "mcp": { "local": { "type": "local", "command": ["run", "me"] } },
  "provider": {
    "router": { "options": { "baseURL": "https://r.example", "apiKey": "${API_KEY}", "headers": { "x-custom": "keep" } } }
  }
}
`

/** The gate's only spawn need: every case runs against one scratch home. */
const runCli = (args: string[], home: string, input: string | Buffer = ''): Promise<RunResult> =>
  spawnCli(args, { CCSET_HOME: home }, input)

async function seed(home: string): Promise<string> {
  const target = opencodeConfigPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, ORIGINAL, { mode: 0o600 })
  return target
}

async function configOf(home: string): Promise<Record<string, any>> {
  return JSON.parse(await fs.readFile(opencodeConfigPath(home), 'utf8'))
}

async function checkGlobalSet(home: string): Promise<void> {
  const target = await seed(home)
  const result = await runCli(
    [
      '--agent', 'opencode', 'global', 'set',
      '--model', 'router/m1',
      '--autoupdate', 'false',
      '--share', 'disabled',
      '--disabled-provider', 'openai',
      '--disabled-provider', 'google',
      '--json',
    ],
    home,
  )
  assert.equal(result.code, 0, `global set failed: ${result.stderr}`)
  const config = await configOf(home)
  assert.equal(config['theme'], 'tokyonight', 'an unmanaged top-level key was lost')
  assert.deepEqual(config['keybinds'], { leader: 'ctrl+x', deep: { deeper: { leaf: 1 } } }, 'unmanaged nested keys changed')
  assert.deepEqual(config['mcp'], { local: { type: 'local', command: ['run', 'me'] } })
  assert.equal(config['model'], 'router/m1')
  assert.equal(config['autoupdate'], false, 'autoupdate was not a real boolean')
  assert.equal(config['share'], 'disabled')
  assert.deepEqual(config['disabled_providers'], ['openai', 'google'])
  const options = config['provider']['router']['options']
  assert.equal(options['apiKey'], API_KEY, 'a provider secret was disturbed by a global patch')
  assert.deepEqual(options['headers'], { 'x-custom': 'keep' }, 'unmanaged provider keys four levels deep were lost')
  assert.equal((await fs.stat(target)).mode & 0o777, 0o600)
}

async function checkUnsetNoOpDryRun(home: string): Promise<void> {
  await seed(home)
  const unset = await runCli(['--agent', 'opencode', 'global', 'set', '--unset', 'disabledProviders'], home)
  assert.equal(unset.code, 0)
  let config = await configOf(home)
  assert.equal('disabled_providers' in config, false, '--unset did not delete')

  const repeat = await runCli(['--agent', 'opencode', 'global', 'set', '--unset', 'disabledProviders'], home)
  assert.equal(repeat.code, 0)
  assert.match(repeat.stdout, /Changed: no/, 'an idempotent unset claimed a change')
  const backupsAfterNoOp = (await fs.readdir(backupsDir(home)).catch(() => [])).length

  const dry = await runCli(['--agent', 'opencode', 'global', 'set', '--model', 'x/y', '--dry-run', '--json'], home)
  assert.equal(dry.code, 0)
  const envelope = JSON.parse(dry.stdout) as { changed: boolean; dryRun: boolean; targets: { backupPath: string | null }[] }
  assert.equal(envelope.changed, true)
  assert.equal(envelope.dryRun, true)
  assert.equal(envelope.targets[0]?.backupPath, null)
  config = await configOf(home)
  assert.equal(config['model'], undefined, 'a dry run wrote the file')
  const backupsAfterDry = (await fs.readdir(backupsDir(home)).catch(() => [])).length
  assert.equal(backupsAfterDry, backupsAfterNoOp, 'a dry run or no-op made a backup')

  const bad = await runCli(['--agent', 'opencode', 'global', 'set', '--share', 'sometimes'], home)
  assert.equal(bad.code, EXIT_USAGE, 'an invalid choice was not a usage error')
}

async function checkStatus(home: string): Promise<void> {
  await seed(home)
  const jsonc = opencodeJsoncPath(home)
  await fs.writeFile(jsonc, '{\n  // comment\n  "theme": "gruvbox"\n}\n', { mode: 0o600 })
  const result = await runCli(['--agent', 'opencode', 'status', '--json'], home)
  assert.equal(result.code, 0)
  const envelope = JSON.parse(result.stdout) as {
    warnings: { code: string }[]
    data: {
      config: { path: string; parsed: boolean }
      providers: { id: string; apiKeyPresent?: boolean }[]
      legacyJson?: { path: string }
    }
  }
  assert.equal(envelope.data.config.path, jsonc, 'status did not read the managed .jsonc')
  assert.equal(envelope.data.config.parsed, true, 'a commented .jsonc failed to parse')
  assert.equal(envelope.data.legacyJson?.path, opencodeConfigPath(home), 'the legacy .json was not named')
  assert.equal(envelope.warnings.length, 0, 'the managed target raised a warning')
  assert.equal(envelope.data.providers.length, 0, 'providers were read from the unmanaged legacy file')
  assert.equal(JSON.stringify(envelope.data).includes(API_KEY), false, 'the API key leaked into the JSON')

  const human = await runCli(['--agent', 'opencode', 'status'], home)
  assert.equal(human.code, 0)
  assert.ok(human.stdout.includes('opencode.json (not managed)'), 'the human status lost the legacy note')
  assert.equal(human.stdout.includes(API_KEY), false, 'the API key leaked into the human report')
  assert.equal(`${human.stdout}${human.stderr}`.includes('\x1b'), false, 'ANSI reached status')
}

async function checkManagedTargetWrite(home: string): Promise<void> {
  await seed(home)
  const jsonc = opencodeJsoncPath(home)
  await fs.writeFile(jsonc, '{\n  // comment\n  "theme": "gruvbox"\n}\n', { mode: 0o600 })
  const result = await runCli(
    ['--agent', 'opencode', 'global', 'set', '--model', 'router/m1', '--json'],
    home,
  )
  assert.equal(result.code, 0, `global set failed: ${result.stderr}`)
  const managed = await fs.readFile(jsonc, 'utf8')
  assert.match(managed, /\/\/ comment/, 'the save disturbed bytes it does not own')
  assert.match(managed, /"model": "router\/m1"/, 'the managed key did not land in the .jsonc')
  assert.match(managed, /"theme": "gruvbox"/, 'an unmanaged key in the .jsonc was lost')
  assert.equal(await fs.readFile(opencodeConfigPath(home), 'utf8'), ORIGINAL, 'the legacy .json was rewritten')
}

async function checkStatusParseFailure(home: string): Promise<void> {
  await seed(home)
  const result = await runCli(['--agent', 'opencode', 'global', 'set', '--model', 'x/y', '--replace-invalid'], home)
  assert.equal(result.code, 0)
  await fs.writeFile(opencodeConfigPath(home), '{ broken\n', { mode: 0o600 })
  const refused = await runCli(['--agent', 'opencode', 'global', 'set', '--model', 'x/y'], home)
  assert.equal(refused.code, EXIT_INVALID_CONFIG, 'a malformed target was not refused')
  assert.equal(await fs.readFile(opencodeConfigPath(home), 'utf8'), '{ broken\n')

  const status = await runCli(['--agent', 'opencode', 'status', '--json'], home)
  assert.equal(status.code, EXIT_INVALID_CONFIG, 'a status parse failure did not exit 4')
  const envelope = JSON.parse(status.stdout) as { ok: boolean; errors: unknown[]; data: { config: { parsed: boolean }; providers: unknown[] } }
  assert.equal(envelope.ok, false)
  assert.equal(envelope.errors.length > 0, true)
  assert.equal(envelope.data.config.parsed, false)
  assert.ok(envelope.data.providers !== undefined, 'the data envelope lost its shape')
}

async function withHome(label: string, run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `ccset-m34-${label}-`))
  try {
    await run(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  await withHome('global', checkGlobalSet)
  await withHome('unset', checkUnsetNoOpDryRun)
  await withHome('status', checkStatus)
  await withHome('managed', checkManagedTargetWrite)
  await withHome('status4', checkStatusParseFailure)
  process.stdout.write('opencode status and global set verification passed.\n')
}

await main()
