import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { authProfilePath, codexAuthPath, codexConfigPath } from '../src/agents/codex/paths.js'
import { EXIT_INVALID_CONFIG, EXIT_RUNTIME, EXIT_USAGE } from '../src/core/errors.js'
import { runCli as spawnCli, type RunResult } from './cli-harness.js'

/**
 * M3.7: Codex provider set with auth profiles, across the process seam. A
 * patch asserts the two Codex invariants on every save, keeps every unmanaged
 * key in the provider table, and lands the secret in the named profile
 * sidecar only -- live auth.json is never touched, routing never moves, and
 * an omitted secret preserves an existing profile. The fixture goes red if a
 * save reaches the live credential or drops an invariant.
 */

const OLD_KEY = 'CX-OLD-KEY-0123456789'
const NEW_KEY = 'CX-NEW-KEY-0987654321'
const LIVE_KEY = 'CX-LIVE-KEY-0123456789'

const ORIGINAL = `# codex provider set corpus

model_provider = "router"

[model_providers.router]
name = "Router"
base_url = "https://old.example/v1"
requires_openai_auth = false
custom_key = "keep"

[model_providers.bare]
name = "Bare"
`

const SIDECAR = `{
  "OPENAI_API_KEY": "${OLD_KEY}",
  "auth_mode": "apikey",
  "tokens": { "id_token": "keep-me" }
}
`

const LIVE_AUTH = `{
  "OPENAI_API_KEY": "${LIVE_KEY}",
  "auth_mode": "chatgpt"
}
`

interface Envelope {
  ok: boolean
  changed?: boolean
  warnings?: { code: string; params?: Record<string, string> }[]
  targets?: { path: string; backupPath: string | null; changed: boolean }[]
  error?: { code: string }
}

type Env = Record<string, string | undefined>

/** CODEX_HOME is stripped unless a case sets it on purpose. */
const runCli = (
  args: string[],
  home: string,
  input: string | Buffer = '',
  env: Env = {},
): Promise<RunResult> => spawnCli(args, { CODEX_HOME: undefined, CCSET_HOME: home, ...env }, input)

interface Seed {
  home: string
  config: string
  sidecar: string
  live: string
}

async function seed(): Promise<Seed> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-m37-'))
  const config = codexConfigPath(home)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, ORIGINAL, { mode: 0o600 })
  const sidecar = authProfilePath(home, 'router')
  await fs.writeFile(sidecar, SIDECAR, { mode: 0o600 })
  const live = codexAuthPath(home)
  await fs.writeFile(live, LIVE_AUTH, { mode: 0o600 })
  const read = (target: string): Promise<string> => fs.readFile(target, 'utf8')
  return { home, config: await read(config), sidecar: await read(sidecar), live: await read(live) }
}

function textOf(home: string): Promise<string> {
  return fs.readFile(codexConfigPath(home), 'utf8')
}

async function checkProviderPatch(): Promise<void> {
  const before = await seed()
  const result = await runCli(
    ['--agent', 'codex', 'provider', 'set', 'router', '--base-url', 'https://new.example/v1', '--display-name', 'Router2', '--json'],
    before.home,
  )
  assert.equal(result.code, 0, `provider set failed: ${result.stderr}`)
  const text = await textOf(before.home)
  assert.equal(text.includes('base_url = "https://new.example/v1"'), true, 'the patch did not land')
  assert.equal(text.includes('name = "Router2"'), true, 'the display name did not land')
  assert.equal(text.includes('custom_key = "keep"'), true, 'an unmanaged provider key was lost')
  assert.equal(text.includes('wire_api = "responses"'), true, 'the wire_api invariant was not asserted')
  assert.equal(text.includes('requires_openai_auth = true'), true, 'the ambient-auth invariant was not asserted')
  assert.equal(text.includes('model_provider = "router"'), true, 'routing moved as a side effect')
  assert.equal(text.includes('name = "Bare"'), true, 'another provider block changed')
  assert.equal(await fs.readFile(authProfilePath(before.home, 'router'), 'utf8'), before.sidecar, 'an omitted secret disturbed the profile')
  assert.equal(await fs.readFile(codexAuthPath(before.home), 'utf8'), before.live, 'the live credential changed')

  const envelope = JSON.parse(result.stdout) as Envelope
  const configTarget = envelope.targets?.find((target) => target.path.endsWith('config.toml'))
  const authTarget = envelope.targets?.find((target) => target.path.endsWith('auth.router.json'))
  assert.ok(configTarget && configTarget.changed, 'the settings target was not reported')
  assert.ok(authTarget && !authTarget.changed, 'the preserved profile was reported as changed')

  const repeat = await runCli(
    ['--agent', 'codex', 'provider', 'set', 'router', '--base-url', 'https://new.example/v1', '--display-name', 'Router2'],
    before.home,
  )
  assert.equal(repeat.code, 0)
  assert.match(repeat.stdout, /Changed: no/, 'an idempotent provider patch claimed a change')
  await fs.rm(before.home, { recursive: true, force: true })
}

async function checkSecretRotation(): Promise<void> {
  const before = await seed()
  const rotated = await runCli(
    ['--agent', 'codex', 'provider', 'set', 'router', '--token-stdin', '--json'],
    before.home,
    `${NEW_KEY}\n`,
  )
  assert.equal(rotated.code, 0, 'a secret rotation failed')
  const sidecar = JSON.parse(await fs.readFile(authProfilePath(before.home, 'router'), 'utf8')) as Record<string, any>
  assert.equal(sidecar['OPENAI_API_KEY'], NEW_KEY, 'the secret did not land in the named profile')
  assert.equal(sidecar['auth_mode'], 'apikey', 'the profile auth mode was lost')
  assert.deepEqual((sidecar['tokens'] as Record<string, string>)['id_token'], 'keep-me', 'unmanaged sidecar content was lost')
  assert.equal(await fs.readFile(codexAuthPath(before.home), 'utf8'), before.live, 'the live credential changed')
  assert.equal(await fs.readFile(authProfilePath(before.home, 'bare'), 'utf8').then(() => true, () => false), false, 'a sidecar grew for another provider')
  assert.equal(`${rotated.stdout}${rotated.stderr}`.includes(NEW_KEY), false, 'the new secret reached output')
  assert.equal(`${rotated.stdout}${rotated.stderr}`.includes(OLD_KEY), false, 'the old secret reached output')
  await fs.rm(before.home, { recursive: true, force: true })
}

async function checkNewProviderAndRefusals(): Promise<void> {
  const before = await seed()
  const created = await runCli(
    ['--agent', 'codex', 'provider', 'set', 'fresh', '--base-url', 'https://f.example/v1', '--display-name', 'Fresh', '--token-stdin'],
    before.home,
    `${NEW_KEY}\n`,
  )
  assert.equal(created.code, 0, 'a complete new provider failed')
  const text = await textOf(before.home)
  assert.equal(text.includes('[model_providers.fresh]'), true, 'the new block was not written')
  const fresh = text.slice(text.indexOf('[model_providers.fresh]'))
  assert.equal(fresh.includes('wire_api = "responses"'), true, 'the new block missed the wire_api invariant')
  assert.equal(fresh.includes('requires_openai_auth = true'), true, 'the new block missed the ambient-auth invariant')
  const profile = JSON.parse(await fs.readFile(authProfilePath(before.home, 'fresh'), 'utf8')) as Record<string, any>
  assert.equal(profile['OPENAI_API_KEY'], NEW_KEY, 'the new profile did not get the key')

  const noUrl = await runCli(['--agent', 'codex', 'provider', 'set', 'second', '--token-stdin'], before.home, NEW_KEY)
  assert.equal(noUrl.code, EXIT_RUNTIME, 'a new provider was created without a base URL')
  const noKey = await runCli(['--agent', 'codex', 'provider', 'set', 'second', '--base-url', 'https://s.example/v1'], before.home)
  assert.equal(noKey.code, EXIT_RUNTIME, 'a new provider was created without a secret')
  const emptyProfile = await runCli(['--agent', 'codex', 'provider', 'set', 'bare', '--display-name', 'Bare'], before.home)
  assert.equal(emptyProfile.code, EXIT_RUNTIME, 'a provider with an empty profile reported success')
  assert.equal((await textOf(before.home)).includes('[model_providers.second]'), false, 'a refused provider was still written')
  assert.equal(await fs.readFile(authProfilePath(before.home, 'second'), 'utf8').then(() => true, () => false), false)

  const reserved = await runCli(['--agent', 'codex', 'provider', 'set', 'openai', '--base-url', 'https://x.example/v1'], before.home)
  assert.equal(reserved.code, EXIT_USAGE, 'a reserved provider id was not a usage error')
  const badUrl = await runCli(['--agent', 'codex', 'provider', 'set', 'router', '--base-url', 'not a url'], before.home)
  assert.equal(badUrl.code, EXIT_USAGE, 'an invalid base URL was not a usage error')

  const dry = await runCli(
    ['--agent', 'codex', 'provider', 'set', 'ghost', '--base-url', 'https://g.example/v1', '--token-stdin', '--dry-run', '--json'],
    before.home,
    `${NEW_KEY}\n`,
  )
  assert.equal(dry.code, 0)
  const dryEnvelope = JSON.parse(dry.stdout) as Envelope
  assert.equal(dryEnvelope.changed, true)
  assert.equal((dryEnvelope.targets ?? []).some((target) => target.backupPath !== null), false, 'a dry run reported a backup')
  assert.equal((await textOf(before.home)).includes('[model_providers.ghost]'), false, 'a dry run wrote the block')
  await fs.rm(before.home, { recursive: true, force: true })
}

async function checkWarningsUnsetAndUnreadable(): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-m37-warn-'))
  const config = codexConfigPath(home)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(
    config,
    ORIGINAL.replace('model_provider = "router"', 'model_provider = "router"\ncli_auth_credentials_store = "keyring"'),
    { mode: 0o600 },
  )
  await fs.writeFile(authProfilePath(home, 'router'), SIDECAR, { mode: 0o600 })
  const warned = await runCli(
    ['--agent', 'codex', 'provider', 'set', 'router', '--display-name', 'Router', '--json'],
    home,
  )
  assert.equal(warned.code, 0)
  const envelope = JSON.parse(warned.stdout) as Envelope
  assert.equal(
    (envelope.warnings ?? []).some((warning) => warning.code === 'codex.warning.keyringStore'),
    true,
    'the keyring finding was not reported before saving',
  )
  const moved = await runCli(
    ['--agent', 'codex', 'provider', 'set', 'router', '--display-name', 'Router', '--json'],
    home,
    '',
    {
      CODEX_HOME: path.join(os.tmpdir(), 'ccset-m37-elsewhere'),
    },
  )
  assert.equal(
    (JSON.parse(moved.stdout) as Envelope).warnings?.some(
      (warning) => warning.code === 'codex.warning.homeOverride',
    ),
    true,
    'the CODEX_HOME finding was not reported before saving',
  )
  await fs.rm(home, { recursive: true, force: true })

  const unset = await seed()
  const removed = await runCli(['--agent', 'codex', 'provider', 'set', 'router', '--unset', 'displayName'], unset.home)
  assert.equal(removed.code, 0, 'the unset was refused')
  const block = (await textOf(unset.home)).slice(0, (await textOf(unset.home)).indexOf('[model_providers.bare]'))
  assert.equal(block.includes('name ='), false, 'the unset did not delete the key')
  const notUnsettable = await runCli(['--agent', 'codex', 'provider', 'set', 'router', '--unset', 'baseUrl'], unset.home)
  assert.equal(notUnsettable.code, EXIT_USAGE, 'unsetting the base URL was not refused')
  await fs.rm(unset.home, { recursive: true, force: true })

  const broken = await seed()
  await fs.writeFile(authProfilePath(broken.home, 'router'), '{ broken\n', { mode: 0o600 })
  const refused = await runCli(['--agent', 'codex', 'provider', 'set', 'router', '--display-name', 'X'], broken.home)
  assert.equal(refused.code, EXIT_INVALID_CONFIG, 'an unreadable sidecar did not hold the exit code')
  assert.equal(await textOf(broken.home), broken.config, 'a refused operation still mutated the document')
  await fs.rm(broken.home, { recursive: true, force: true })
}

async function main(): Promise<void> {
  await checkProviderPatch()
  await checkSecretRotation()
  await checkNewProviderAndRefusals()
  await checkWarningsUnsetAndUnreadable()
  process.stdout.write('codex provider set verification passed.\n')
}

await main()
