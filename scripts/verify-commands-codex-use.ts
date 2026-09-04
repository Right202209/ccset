import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { authProfilePath, backupsDir, codexAuthPath, codexConfigPath } from '../src/agents/codex/paths.js'
import { EXIT_RUNTIME, EXIT_USAGE } from '../src/core/errors.js'

/**
 * M3.8: Codex provider use across the process seam. A switch replaces the live
 * auth.json with the named profile and points model_provider at it, in that
 * order; an unknown live credential is never discarded without exactly one of
 * --adopt-current-as or --replace-current-auth; a byte-identical live profile
 * switches idempotently; and a failure after the routing commit reports the
 * committed path as partial. The fixture goes red if the order flips, a
 * conflict is bypassed, or the partial report is lost.
 */

const ROUTER_KEY = 'CX-ROUTER-KEY-0123456789'
const LIVE_KEY = 'CX-LIVE-KEY-0123456789'
const UNKNOWN_KEY = 'CX-UNKNOWN-KEY-01234567'

const ROUTER_PROFILE = `{
  "OPENAI_API_KEY": "${ROUTER_KEY}",
  "auth_mode": "apikey"
}
`

const KNOWN_LIVE = `{
  "OPENAI_API_KEY": "${LIVE_KEY}",
  "auth_mode": "chatgpt",
  "tokens": { "id_token": "keep-me" }
}
`

const UNKNOWN_LIVE = `{
  "OPENAI_API_KEY": "${UNKNOWN_KEY}",
  "auth_mode": "chatgpt",
  "tokens": { "id_token": "adopt-me" }
}
`

const CORPUS = `# codex provider use corpus

model_provider = "old"

[model_providers.router]
name = "Router"
base_url = "https://router.example/v1"
requires_openai_auth = true

[model_providers.old]
name = "Old"
base_url = "https://old.example/v1"
requires_openai_auth = true
`

const ROUTED_CORPUS = CORPUS.replace('model_provider = "old"', 'model_provider = "router"')

const KEYRING_CORPUS = CORPUS.replace(
  'model_provider = "old"',
  'model_provider = "old"\ncli_auth_credentials_store = "keyring"',
)

interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

interface TargetRecord {
  path: string
  backupPath: string | null
  changed: boolean
}

interface Envelope {
  ok: boolean
  changed?: boolean
  targets?: TargetRecord[]
  partial?: string[]
  warnings?: { code: string }[]
  error?: { code: string; params?: Record<string, string> }
}

type Env = Record<string, string | undefined>

function runCli(args: string[], home: string, env: Env = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), 'dist/cli.js'), ...args], {
      // CODEX_HOME is stripped unless a case sets it on purpose.
      env: { ...process.env, CODEX_HOME: undefined, CCSET_HOME: home, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('close', (code) => resolve({ code, stdout, stderr }))
    child.stdin.end()
  })
}

interface Seed {
  home: string
  live: string
  routing: string
}

/** `live` seeds auth.json; `known` decides whether a saved profile matches it. */
async function seed(live: string, known: boolean, corpus = CORPUS): Promise<Seed> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-m38-'))
  const config = codexConfigPath(home)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, corpus, { mode: 0o600 })
  await fs.writeFile(codexAuthPath(home), live, { mode: 0o600 })
  await fs.writeFile(authProfilePath(home, 'router'), ROUTER_PROFILE, { mode: 0o600 })
  if (known) await fs.writeFile(authProfilePath(home, 'old'), live, { mode: 0o600 })
  return { home, live, routing: corpus }
}

const textOf = (home: string): Promise<string> => fs.readFile(codexConfigPath(home), 'utf8')
const liveOf = (home: string): Promise<string> => fs.readFile(codexAuthPath(home), 'utf8')

async function backupCount(home: string): Promise<number> {
  try {
    return (await fs.readdir(backupsDir(home))).filter((name) => name.includes('auth.json.backup')).length
  } catch {
    return 0
  }
}

async function checkPlainSwitch(): Promise<void> {
  const before = await seed(KNOWN_LIVE, true)
  const result = await runCli(['--agent', 'codex', 'provider', 'use', 'router', '--json'], before.home)
  assert.equal(result.code, 0, `provider use failed: ${result.stderr}`)
  assert.equal(await textOf(before.home), before.routing.replace('model_provider = "old"', 'model_provider = "router"'), 'routing did not move or moved carelessly')
  assert.equal(await liveOf(before.home), ROUTER_PROFILE, 'the live credential was not replaced with the profile')
  assert.equal(await fs.readFile(authProfilePath(before.home, 'old'), 'utf8'), KNOWN_LIVE, 'the previous profile was disturbed')
  const envelope = JSON.parse(result.stdout) as Envelope
  const configTarget = envelope.targets?.find((target) => target.path.endsWith('config.toml'))
  const authTarget = envelope.targets?.find((target) => target.path.endsWith('auth.json'))
  assert.ok(configTarget?.changed, 'the routing target was not reported')
  assert.ok(authTarget?.changed, 'the auth target was not reported')
  assert.ok(
    (envelope.targets ?? []).findIndex((target) => target.path.endsWith('config.toml')) <
      (envelope.targets ?? []).findIndex((target) => target.path.endsWith('auth.json')),
    'the targets were not reported in commit order',
  )
  const backup = authTarget?.backupPath
  assert.ok(backup, 'the live credential was not backed up')
  assert.equal(await fs.readFile(backup as string, 'utf8'), KNOWN_LIVE, 'the backup is not the bytes that were live')
  assert.equal(JSON.stringify(envelope).includes(ROUTER_KEY) || JSON.stringify(envelope).includes(LIVE_KEY), false, 'credential material reached the result')

  const human = await runCli(['--agent', 'codex', 'provider', 'use', 'router'], before.home)
  assert.equal(human.code, 0)
  assert.match(human.stdout, /Changed: no/, 'an idempotent switch claimed a change')
  assert.equal(await backupCount(before.home), 1, 'an idempotent switch backed the live file up again')
  assert.equal(await liveOf(before.home), ROUTER_PROFILE, 'an idempotent switch churned the credential')
  await fs.rm(before.home, { recursive: true, force: true })
}

async function checkConflictRefusals(): Promise<void> {
  const before = await seed(UNKNOWN_LIVE, false)
  const noChoice = await runCli(['--agent', 'codex', 'provider', 'use', 'router', '--json'], before.home)
  assert.equal(noChoice.code, EXIT_RUNTIME, 'an unknown live credential was discarded without a choice')
  assert.equal(await liveOf(before.home), UNKNOWN_LIVE, 'a refused switch replaced the live credential')
  assert.equal(await textOf(before.home), before.routing, 'a refused switch moved the routing')

  const dry = await runCli(['--agent', 'codex', 'provider', 'use', 'router', '--dry-run', '--json'], before.home)
  assert.equal(dry.code, EXIT_RUNTIME, 'a dry run skipped the conflict checks')
  assert.equal(await liveOf(before.home), UNKNOWN_LIVE, 'a dry run wrote the credential')

  const both = await runCli(
    ['--agent', 'codex', 'provider', 'use', 'router', '--adopt-current-as', 'kept', '--replace-current-auth'],
    before.home,
  )
  assert.equal(both.code, EXIT_USAGE, 'both conflict choices together were not rejected')

  const taken = await runCli(['--agent', 'codex', 'provider', 'use', 'router', '--adopt-current-as', 'router'], before.home)
  assert.equal(taken.code, EXIT_RUNTIME, 'an adopt name that collides with a profile was not refused')

  const ghost = await runCli(['--agent', 'codex', 'provider', 'use', 'ghost'], before.home)
  assert.equal(ghost.code, EXIT_RUNTIME, 'a missing profile was not refused')
  await fs.rm(before.home, { recursive: true, force: true })
}

async function checkAdoption(): Promise<void> {
  const before = await seed(UNKNOWN_LIVE, false)
  const result = await runCli(
    ['--agent', 'codex', 'provider', 'use', 'router', '--adopt-current-as', 'saved', '--json'],
    before.home,
  )
  assert.equal(result.code, 0, `an adoption switch failed: ${result.stderr}`)
  assert.equal(
    await fs.readFile(authProfilePath(before.home, 'saved'), 'utf8').then(() => true, () => false),
    true,
    'adoption did not keep the live bytes as a profile',
  )
  assert.equal(await fs.readFile(authProfilePath(before.home, 'saved'), 'utf8'), UNKNOWN_LIVE, 'adoption did not keep the live bytes')
  assert.equal(await liveOf(before.home), ROUTER_PROFILE, 'the profile did not land after adoption')
  assert.equal(await textOf(before.home), before.routing.replace('model_provider = "old"', 'model_provider = "router"'), 'routing did not move')
  const envelope = JSON.parse(result.stdout) as Envelope
  const authTarget = envelope.targets?.find((target) => target.path.endsWith('auth.json'))
  assert.ok(authTarget?.backupPath, 'the replaced live credential was not backed up')
  assert.equal(await fs.readFile(authTarget?.backupPath as string, 'utf8'), UNKNOWN_LIVE, 'the backup is not the adopted bytes')
  await fs.rm(before.home, { recursive: true, force: true })
}

async function checkReplacement(): Promise<void> {
  const before = await seed(UNKNOWN_LIVE, false)
  const result = await runCli(
    ['--agent', 'codex', 'provider', 'use', 'router', '--replace-current-auth', '--json'],
    before.home,
  )
  assert.equal(result.code, 0, `a replacement switch failed: ${result.stderr}`)
  assert.equal(await liveOf(before.home), ROUTER_PROFILE, 'the profile did not land')
  assert.equal(await fs.readFile(authProfilePath(before.home, 'router'), 'utf8'), ROUTER_PROFILE, 'the saved profile changed')
  const envelope = JSON.parse(result.stdout) as Envelope
  const authTarget = envelope.targets?.find((target) => target.path.endsWith('auth.json'))
  assert.ok(authTarget?.backupPath, 'the discarded live credential was not backed up first')
  assert.equal(await fs.readFile(authTarget?.backupPath as string, 'utf8'), UNKNOWN_LIVE, 'the backup is not the bytes that were live')
  await fs.rm(before.home, { recursive: true, force: true })
}

async function checkUnsupported(): Promise<void> {
  const keyed = await seed(KNOWN_LIVE, true, KEYRING_CORPUS)
  const keyring = await runCli(['--agent', 'codex', 'provider', 'use', 'router', '--json'], keyed.home)
  assert.equal(keyring.code, EXIT_RUNTIME, 'a keyring store did not refuse the switch')
  const keyringEnvelope = JSON.parse(keyring.stdout) as Envelope
  assert.equal(keyringEnvelope.error?.code, 'codex.error.keyringUnsupported', 'the keyring refusal was not the documented code')
  assert.equal(await liveOf(keyed.home), KNOWN_LIVE, 'a refused switch replaced the live credential')
  await fs.rm(keyed.home, { recursive: true, force: true })

  const moved = await seed(KNOWN_LIVE, true)
  const elsewhere = path.join(os.tmpdir(), 'ccset-m38-elsewhere')
  const override = await runCli(['--agent', 'codex', 'provider', 'use', 'router', '--json'], moved.home, {
    CODEX_HOME: elsewhere,
  })
  assert.equal(override.code, EXIT_RUNTIME, 'a CODEX_HOME mismatch did not refuse the switch')
  const overrideEnvelope = JSON.parse(override.stdout) as Envelope
  assert.equal(overrideEnvelope.error?.code, 'codex.error.homeOverrideUnsupported', 'the home refusal was not the documented code')
  assert.equal(await liveOf(moved.home), KNOWN_LIVE, 'a refused switch replaced the live credential')
  await fs.rm(moved.home, { recursive: true, force: true })
}

async function checkDryRun(): Promise<void> {
  const before = await seed(KNOWN_LIVE, true)
  const dry = await runCli(['--agent', 'codex', 'provider', 'use', 'router', '--dry-run', '--json'], before.home)
  assert.equal(dry.code, 0, `a dry run failed: ${dry.stderr}`)
  const envelope = JSON.parse(dry.stdout) as Envelope
  assert.equal(envelope.changed, true)
  assert.equal(
    (envelope.targets ?? []).every((target) => target.backupPath === null),
    true,
    'a dry run reported a backup',
  )
  assert.equal(await liveOf(before.home), KNOWN_LIVE, 'a dry run wrote the credential')
  assert.equal(await textOf(before.home), before.routing, 'a dry run moved the routing')
  await fs.rm(before.home, { recursive: true, force: true })
}

/**
 * The auth move fails after the routing commit: the backup directory is made
 * unwritable while the routing write is a no-op, so the only thing that could
 * have landed is the routing record -- and the partial report must name it.
 */
async function checkPartialReport(): Promise<void> {
  const before = await seed(UNKNOWN_LIVE, false, ROUTED_CORPUS)
  const dir = backupsDir(before.home)
  await fs.mkdir(dir, { recursive: true })
  await fs.chmod(dir, 0o500)
  try {
    const result = await runCli(
      ['--agent', 'codex', 'provider', 'use', 'router', '--adopt-current-as', 'kept', '--json'],
      before.home,
    )
    assert.equal(result.code === 0, false, 'a failing auth move reported success')
    const envelope = JSON.parse(result.stdout) as Envelope
    assert.equal(envelope.ok, false)
    assert.equal(
      (envelope.partial ?? []).some((partial) => partial.endsWith('config.toml')),
      true,
      'the partial report did not name the committed routing',
    )
    assert.equal(await liveOf(before.home), UNKNOWN_LIVE, 'the live credential moved despite the failure')
    assert.equal(
      await fs.readFile(authProfilePath(before.home, 'kept'), 'utf8'),
      UNKNOWN_LIVE,
      'the adoption did not keep the live bytes before the failure',
    )
  } finally {
    await fs.chmod(dir, 0o700)
    await fs.rm(before.home, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  await checkPlainSwitch()
  await checkConflictRefusals()
  await checkAdoption()
  await checkReplacement()
  await checkUnsupported()
  await checkDryRun()
  await checkPartialReport()
  process.stdout.write('codex provider use verification passed.\n')
}

await main()
