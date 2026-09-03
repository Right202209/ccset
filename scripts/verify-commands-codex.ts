import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { codexAuthPath, codexConfigPath } from '../src/agents/codex/paths.js'
import { EXIT_INVALID_CONFIG, EXIT_USAGE } from '../src/core/errors.js'

/**
 * M3.6: Codex status and global set over the format-preserving TOML codec,
 * across the process seam. A patch may only move the spans it names -- every
 * comment, blank line, key order and unmanaged key around it survives, an
 * integer field lands as a TOML integer, and status reports keyring and
 * CODEX_HOME findings while a parse failure still ships the auth sections.
 * The fixture goes red if a save rebuilds the document instead of editing it.
 */

const LIVE_KEY = 'CX-LIVE-KEY-0123456789'

const ORIGINAL = `# Codex configuration, maintained by hand.
# ccset must keep every comment, blank line and key order.

model = "gpt-5.3"

approval_policy = "on-request"

[mcp_servers.files]
command = "npx"

[model_providers.router]
name = "Router"
base_url = "https://old.example/v1"
requires_openai_auth = true
custom_retry = 7

[model_providers.bare]
name = "Bare"
`

const AUTH_JSON = `{
  "OPENAI_API_KEY": "${LIVE_KEY}",
  "auth_mode": "apikey"
}
`

interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

interface Envelope {
  ok: boolean
  changed?: boolean
  warnings?: { code: string; params?: Record<string, string> }[]
  errors?: { code: string }[]
  targets?: { backupPath: string | null }[]
  data?: {
    config?: { exists: boolean; parsed: boolean; managed?: Record<string, unknown> }
    providers?: { id: string; noBaseUrl: boolean }[]
    auth?: { path: string; exists: boolean; apiKeyPresent: boolean; activeName: string | null; authMode?: string }
    profiles?: { name: string; apiKeyPresent: boolean }[]
  }
}

type Env = Record<string, string | undefined>

function runCli(args: string[], home: string, env: Env = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), 'dist/cli.js'), ...args], {
      // CODEX_HOME is stripped unless a case sets it on purpose: an ambient
      // value would point every warning at the surrounding shell's override.
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

async function seed(): Promise<string> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-m36-'))
  const target = codexConfigPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, ORIGINAL, { mode: 0o600 })
  return home
}

async function seedAuth(home: string): Promise<void> {
  await fs.writeFile(codexAuthPath(home), AUTH_JSON, { mode: 0o600 })
  await fs.writeFile(path.join(path.dirname(codexAuthPath(home)), 'auth.router.json'), AUTH_JSON, {
    mode: 0o600,
  })
}

function textOf(home: string): Promise<string> {
  return fs.readFile(codexConfigPath(home), 'utf8')
}

async function checkGlobalSetPreserves(): Promise<void> {
  const home = await seed()
  const result = await runCli(['--agent', 'codex', 'global', 'set', '--model', 'gpt-6.1', '--json'], home)
  assert.equal(result.code, 0, `global set failed: ${result.stderr}`)
  const text = await textOf(home)
  assert.equal(text.includes('# ccset must keep every comment, blank line and key order.'), true, 'a comment was lost')
  assert.equal(text.includes('approval_policy = "on-request"'), true, 'an unmanaged key was lost')
  assert.equal(text.includes('command = "npx"'), true, 'an unmanaged table was lost')
  assert.equal(text.includes('custom_retry = 7'), true, 'an unmanaged provider key was lost')
  assert.equal(text.includes('base_url = "https://old.example/v1"'), true, 'an unmanaged provider value was lost')
  assert.equal(text.includes('model = "gpt-6.1"'), true, 'the managed key was not rewritten')
  const model = text.indexOf('model = "gpt-6.1"')
  const approval = text.indexOf('approval_policy =')
  const providers = text.indexOf('[model_providers.router]')
  assert.ok(model < approval && approval < providers, 'key order was not preserved')
  assert.equal(text.includes('gpt-5.3'), false, 'the old value survived the edit')

  const status = await runCli(['--agent', 'codex', 'status', '--json'], home)
  assert.equal(status.code, 0, `status failed: ${status.stderr}`)
  const envelope = JSON.parse(status.stdout) as Envelope
  assert.equal(envelope.data?.config?.managed?.['model'], 'gpt-6.1', 'status did not read the new value')
  assert.equal(typeof envelope.data?.config?.managed?.['modelProvider'], 'undefined')
  await fs.rm(home, { recursive: true, force: true })
}

async function checkIntegerType(): Promise<void> {
  const home = await seed()
  const set = await runCli(['--agent', 'codex', 'global', 'set', '--context-window', '32000'], home)
  assert.equal(set.code, 0, `the integer field was refused: ${set.stderr}`)
  const text = await textOf(home)
  assert.equal(text.includes('model_context_window = 32000'), true, 'the integer was not a TOML integer')
  assert.equal(text.includes('model_context_window = "32000"'), false, 'the integer was quoted')

  const status = await runCli(['--agent', 'codex', 'status', '--json'], home)
  const envelope = JSON.parse(status.stdout) as Envelope
  assert.equal(envelope.data?.config?.managed?.['contextWindow'], 32000, 'status read the integer as something else')

  const unset = await runCli(['--agent', 'codex', 'global', 'set', '--unset', 'contextWindow'], home)
  assert.equal(unset.code, 0, 'the unset was refused')
  assert.equal((await textOf(home)).includes('model_context_window'), false, 'the unset did not delete the key')
  await fs.rm(home, { recursive: true, force: true })
}

async function checkChoicesNoOpDryRun(): Promise<void> {
  const home = await seed()
  const choice = await runCli(['--agent', 'codex', 'global', 'set', '--approval-policy', 'never', '--sandbox-mode', 'danger-full-access'], home)
  assert.equal(choice.code, 0, `the choices were refused: ${choice.stderr}`)
  const text = await textOf(home)
  assert.equal(text.includes('approval_policy = "never"'), true, 'the choice did not land')
  assert.equal(text.includes('sandbox_mode = "danger-full-access"'), true, 'the second choice did not land')

  const bad = await runCli(['--agent', 'codex', 'global', 'set', '--approval-policy', 'sometimes'], home)
  assert.equal(bad.code, EXIT_USAGE, 'an invalid choice was not a usage error')
  const empty = await runCli(['--agent', 'codex', 'global', 'set'], home)
  assert.equal(empty.code, EXIT_USAGE, 'an empty patch was not a usage error')
  const unknown = await runCli(['--agent', 'codex', 'global', 'set', '--nope', 'x'], home)
  assert.equal(unknown.code, EXIT_USAGE, 'an unknown option was not a usage error')

  const repeat = await runCli(['--agent', 'codex', 'global', 'set', '--model', 'gpt-5.3'], home)
  assert.equal(repeat.code, 0)
  assert.match(repeat.stdout, /Changed: no/, 'an idempotent global patch claimed a change')

  const dry = await runCli(['--agent', 'codex', 'global', 'set', '--verbosity', 'high', '--dry-run', '--json'], home)
  assert.equal(dry.code, 0)
  const envelope = JSON.parse(dry.stdout) as Envelope
  assert.equal(envelope.changed, true)
  assert.equal(envelope.targets?.[0]?.backupPath, null, 'a dry run reported a backup')
  assert.equal((await textOf(home)).includes('model_verbosity'), false, 'a dry run wrote the document')
  await fs.rm(home, { recursive: true, force: true })
}

async function checkStatusDto(): Promise<void> {
  const home = await seed()
  await seedAuth(home)
  const result = await runCli(['--agent', 'codex', 'status', '--json'], home)
  assert.equal(result.code, 0, `status failed: ${result.stderr}`)
  const envelope = JSON.parse(result.stdout) as Envelope
  assert.equal(envelope.data?.auth?.exists, true, 'the live credential was not reported')
  assert.equal(envelope.data?.auth?.apiKeyPresent, true, 'the key presence flag was not reported')
  assert.equal(envelope.data?.auth?.authMode, 'apikey', 'the auth mode was not reported')
  assert.equal(envelope.data?.auth?.activeName, 'router', 'the byte-identical profile was not matched')
  assert.equal(envelope.data?.profiles?.[0]?.name, 'router', 'the profile list was wrong')
  const bare = envelope.data?.providers?.find((provider) => provider.id === 'bare')
  assert.equal(bare?.noBaseUrl, true, 'the provider without a base URL was not flagged')
  const warningCodes = (envelope.warnings ?? []).map((warning) => warning.code)
  assert.equal(warningCodes.includes('codex.warning.noBaseUrl'), true, 'the noBaseUrl warning was missing')
  assert.equal(warningCodes.includes('codex.warning.noAmbientAuth'), true, 'the ambient-auth warning was missing')
  assert.equal(
    result.stdout.includes(LIVE_KEY),
    false,
    'the live credential reached status output',
  )

  const human = await runCli(['--agent', 'codex', 'status'], home)
  assert.equal(human.code, 0)
  assert.equal(human.stdout.includes('Live credential'), true, 'the human report lost the auth section')
  assert.equal(human.stdout.includes('Saved credentials'), true, 'the human report lost the profiles section')
  assert.equal(human.stdout.includes('router'), true, 'the human report lost the profile name')
  await fs.rm(home, { recursive: true, force: true })
}

async function checkKeyringAndHomeOverride(): Promise<void> {
  const home = await seed()
  // Root keys only live above the first table header; appended at the end the
  // key would belong to [model_providers.bare] instead of the document root.
  await fs.writeFile(
    codexConfigPath(home),
    ORIGINAL.replace('model = "gpt-5.3"', 'model = "gpt-5.3"\ncli_auth_credentials_store = "keyring"'),
    { mode: 0o600 },
  )
  const result = await runCli(['--agent', 'codex', 'status', '--json'], home)
  assert.equal(result.code, 0)
  const envelope = JSON.parse(result.stdout) as Envelope
  assert.equal(
    (envelope.warnings ?? []).some((warning) => warning.code === 'codex.warning.keyringStore'),
    true,
    'the keyring finding was not reported',
  )
  await fs.rm(home, { recursive: true, force: true })

  const overridden = await seed()
  const other = path.join(os.tmpdir(), 'ccset-m36-elsewhere')
  const moved = await runCli(['--agent', 'codex', 'status', '--json'], overridden, { CODEX_HOME: other })
  assert.equal(moved.code, 0)
  const movedEnvelope = JSON.parse(moved.stdout) as Envelope
  const override = (movedEnvelope.warnings ?? []).find(
    (warning) => warning.code === 'codex.warning.homeOverride',
  )
  assert.ok(override, 'the CODEX_HOME finding was not reported')
  assert.equal(override.params?.['path'], other, 'the override path was not reported')
  await fs.rm(overridden, { recursive: true, force: true })
}

async function checkRecovery(): Promise<void> {
  const home = await seed()
  await seedAuth(home)
  await fs.writeFile(codexConfigPath(home), 'not toml ][\n', { mode: 0o600 })
  const refused = await runCli(['--agent', 'codex', 'status', '--json'], home)
  assert.equal(refused.code, EXIT_INVALID_CONFIG, 'a malformed document did not hold the exit code')
  const envelope = JSON.parse(refused.stdout) as Envelope
  assert.equal((envelope.errors ?? []).length > 0, true, 'the parse failure was not reported')
  assert.equal((envelope.data?.auth?.path ?? '').length > 0, true, 'the auth section did not survive the parse failure')

  const noWrite = await runCli(['--agent', 'codex', 'global', 'set', '--model', 'gpt-6.1'], home)
  assert.equal(noWrite.code, EXIT_INVALID_CONFIG, 'a malformed document was not refused')
  assert.equal(await textOf(home), 'not toml ][\n', 'a refused document was still mutated')

  const replaced = await runCli(
    ['--agent', 'codex', 'global', 'set', '--model', 'gpt-6.1', '--replace-invalid', '--json'],
    home,
  )
  assert.equal(replaced.code, 0, 'a permitted replacement failed')
  const replacedEnvelope = JSON.parse(replaced.stdout) as Envelope
  assert.ok(replacedEnvelope.targets?.[0]?.backupPath, 'the unreadable original was not backed up')
  const text = await textOf(home)
  assert.equal(text.includes('model = "gpt-6.1"'), true, 'the replacement did not write the key')
  assert.equal(text.includes('# ccset must keep'), false, 'a replacement kept bytes from an unreadable base')
  await fs.rm(home, { recursive: true, force: true })
}

async function main(): Promise<void> {
  await checkGlobalSetPreserves()
  await checkIntegerType()
  await checkChoicesNoOpDryRun()
  await checkStatusDto()
  await checkKeyringAndHomeOverride()
  await checkRecovery()
  process.stdout.write('codex status and global set verification passed.\n')
}

await main()
