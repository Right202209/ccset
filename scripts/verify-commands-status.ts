import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { claudeDir, claudeStatePath, globalSettingsPath, providerSettingsPath } from '../src/agents/claude-code/paths.js'
import { EXIT_INVALID_CONFIG, EXIT_USAGE } from '../src/core/errors.js'
import { runCli as spawnCli, type RunResult } from './cli-harness.js'

/**
 * M3.2: status and create-only state init, across the process seam. Status
 * must report every target without ever carrying a secret, keep exit 0 when
 * only ordinary findings appear, and hold exit 4 while still shipping every
 * readable section when a target does not parse. state init must stay
 * create-only: absent creates, valid leaves alone, malformed is refused
 * byte-identical, and --replace-invalid cannot buy its way in.
 */

/** The gate's only spawn need: every case runs against one scratch home. */
const runCli = (args: string[], home: string, input: string | Buffer = ''): Promise<RunResult> =>
  spawnCli(args, { CCSET_HOME: home }, input)

interface StatusEnvelope {
  ok: boolean
  exitCode: number
  warnings: { code: string; params?: Record<string, string> }[]
  errors: { code: string; params?: Record<string, string> }[]
  data: {
    global: { path: string; exists: boolean; parsed: boolean; managed?: Record<string, unknown> }
    state: { path: string; exists: boolean; parsed: boolean; onboarded?: boolean }
    providers: { name: string; parsed: boolean; tokenPresent?: boolean }[]
    backups: { count: number }
  }
}

const TOKEN = 'M3-STATUS-SECRET-0123456789'

async function seedProviders(home: string, broken = false): Promise<void> {
  await fs.mkdir(claudeDir(home), { recursive: true })
  await fs.writeFile(
    providerSettingsPath(home, 'complete'),
    `${JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'https://ok.example', ANTHROPIC_AUTH_TOKEN: TOKEN } })}\n`,
    { mode: 0o600 },
  )
  if (broken) {
    await fs.writeFile(providerSettingsPath(home, 'broken'), '{ broken provider\n', { mode: 0o600 })
  }
}

async function checkStatusWithoutSecrets(home: string): Promise<void> {
  await seedProviders(home)
  const result = await runCli(['--agent', 'claude-code', 'status', '--json'], home)
  assert.equal(result.code, 0, `status on parseable targets failed: ${result.stderr}`)
  const envelope = JSON.parse(result.stdout) as StatusEnvelope
  assert.equal(envelope.ok, true)
  assert.equal(envelope.data.providers.length, 1)
  const complete = envelope.data.providers.find((provider) => provider.name === 'complete')
  assert.equal(complete?.tokenPresent, true, 'token presence was not reported')
  assert.equal(result.stdout.includes(TOKEN), false, 'the token leaked into JSON')
  assert.ok(envelope.data.state.path.endsWith('.claude.json'))

  const human = await runCli(['--agent', 'claude-code', 'status'], home)
  assert.equal(human.code, 0)
  assert.ok(human.stdout.includes('Present'), 'the human report lost the presence line')
  assert.ok(human.stdout.includes('complete'), 'the human report lost a provider')
  assert.equal(human.stdout.includes(TOKEN), false, 'the token leaked into the human report')
  assert.equal(`${human.stdout}${human.stderr}`.includes('\x1b'), false, 'ANSI reached status')
}

async function checkStatusExit4KeepsSections(home: string): Promise<void> {
  await seedProviders(home, true)
  const globalPath = globalSettingsPath(home)
  await fs.writeFile(globalPath, '{ broken global\n', { mode: 0o600 })
  const result = await runCli(['--agent', 'claude-code', 'status', '--json'], home)
  assert.equal(result.code, EXIT_INVALID_CONFIG, 'a parse failure did not exit 4')
  const envelope = JSON.parse(result.stdout) as StatusEnvelope
  assert.equal(envelope.ok, false)
  assert.equal(envelope.exitCode, EXIT_INVALID_CONFIG)
  assert.equal(envelope.errors.length > 0, true, 'no parse-failure findings')
  assert.equal(envelope.data.global.parsed, false, 'the broken global lost its record')
  assert.equal(envelope.data.providers.length, 2, 'readable sections were dropped')
  assert.equal(envelope.data.providers.find((provider) => provider.name === 'complete')?.parsed, true)
  const human = await runCli(['--agent', 'claude-code', 'status'], home)
  assert.equal(human.code, EXIT_INVALID_CONFIG)
  assert.ok(human.stdout.includes('complete'), 'the human report dropped a readable provider')
}

async function checkStateInit(home: string): Promise<void> {
  const target = claudeStatePath(home)
  const first = await runCli(['--agent', 'claude-code', 'state', 'init', '--json'], home)
  assert.equal(first.code, 0)
  const envelope = JSON.parse(first.stdout) as { changed: boolean; targets: { path: string; mode: string }[] }
  assert.equal(envelope.changed, true)
  assert.equal(envelope.targets[0]?.path, target)
  assert.equal(envelope.targets[0]?.mode, '0600')
  const bytes = await fs.readFile(target, 'utf8')
  assert.ok(bytes.includes('hasCompletedOnboarding'))

  const second = await runCli(['--agent', 'claude-code', 'state', 'init'], home)
  assert.equal(second.code, 0)
  assert.match(second.stdout, /Changed: no/)
  assert.equal(await fs.readFile(target, 'utf8'), bytes, 'an existing state file was rewritten')

  const dry = await runCli(
    ['--agent', 'claude-code', 'state', 'init', '--dry-run', '--json'],
    home,
  )
  assert.equal(dry.code, 0)
  const dryEnvelope = JSON.parse(dry.stdout) as { changed: boolean }
  assert.equal(dryEnvelope.changed, false, 'a dry run over an existing file claimed a change')
}

async function checkStateInitRefusals(home: string): Promise<void> {
  const target = claudeStatePath(home)
  const broken = '{ broken state\n'
  await fs.writeFile(target, broken, { mode: 0o600 })
  const refused = await runCli(['--agent', 'claude-code', 'state', 'init', '--json'], home)
  assert.equal(refused.code, EXIT_INVALID_CONFIG, 'an invalid state file was not refused')
  assert.equal(await fs.readFile(target, 'utf8'), broken, 'the invalid state file was touched')

  const forced = await runCli(['--agent', 'claude-code', 'state', 'init', '--replace-invalid'], home)
  assert.equal(forced.code, EXIT_USAGE, '--replace-invalid was accepted by state init')
  assert.equal(await fs.readFile(target, 'utf8'), broken, 'the invalid state file was touched')
}

async function withHome(label: string, run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `ccset-m32-${label}-`))
  try {
    await run(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  await withHome('status', checkStatusWithoutSecrets)
  await withHome('status4', checkStatusExit4KeepsSections)
  await withHome('init', checkStateInit)
  await withHome('init4', checkStateInitRefusals)
  process.stdout.write('Status and state-init command verification passed.\n')
}

await main()
