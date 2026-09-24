import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { authProfilePath, codexAuthPath, codexConfigPath } from '../src/agents/codex/paths.js'
import { EXIT_RUNTIME } from '../src/core/errors.js'
import { runCliWithPreload } from './cli-harness.js'

const LIVE_AUTH = '{"OPENAI_API_KEY":"old-secret","auth_mode":"apikey"}\n'
const ROUTER_AUTH = '{"OPENAI_API_KEY":"new-secret","auth_mode":"apikey"}\n'
const UNKNOWN_AUTH = '{"OPENAI_API_KEY":"unknown-secret","auth_mode":"chatgpt"}\n'
const CONFIG = `model_provider = "old"

[model_providers.old]
name = "Old"
base_url = "https://old.example/v1"
requires_openai_auth = true

[model_providers.router]
name = "Router"
base_url = "https://router.example/v1"
requires_openai_auth = true
`

interface FailureEnvelope {
  ok: boolean
  partial?: string[]
  error?: {
    code: string
    params?: Record<string, unknown>
    rollback?: { code: string; params?: Record<string, unknown> }
  }
}

/**
 * The injected rename failure can fire before the rename (the auth move never
 * lands), after it (the credential moved and only the return path failed), and
 * a second config.toml rename can be made to fail so the routing rollback
 * itself cannot take.
 */
const PRELOAD = `const fs = require('node:fs')
const path = require('node:path')
const rename = fs.promises.rename
let configRenames = 0
const configTarget = process.env.CCSET_CONFIG_PATH ? path.resolve(process.env.CCSET_CONFIG_PATH) : ''
const authTarget = path.resolve(process.env.CCSET_FAIL_RENAME_TARGET)
fs.promises.rename = async (source, target) => {
  const resolved = path.resolve(target)
  if (process.env.CCSET_FAIL_ROLLBACK === '1' && resolved === configTarget) {
    configRenames += 1
    if (configRenames > 1) throw Object.assign(new Error('injected rollback failure'), { code: 'EIO' })
  }
  if (resolved === authTarget) {
    if (process.env.CCSET_RENAME_MODE === 'after') {
      await rename(source, target)
      throw Object.assign(new Error('injected post-rename failure'), { code: 'EIO' })
    }
    throw Object.assign(new Error('injected auth rename failure'), { code: 'EIO' })
  }
  return rename(source, target)
}
`

async function installRenameFailure(home: string, preload: string): Promise<void> {
  const directory = path.dirname(codexConfigPath(home))
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(codexConfigPath(home), CONFIG, { mode: 0o600 })
  await fs.writeFile(codexAuthPath(home), LIVE_AUTH, { mode: 0o600 })
  await fs.writeFile(authProfilePath(home, 'old'), LIVE_AUTH, { mode: 0o600 })
  await fs.writeFile(authProfilePath(home, 'router'), ROUTER_AUTH, { mode: 0o600 })
  await fs.writeFile(preload, PRELOAD)
}

interface FailureOptions {
  adopt?: boolean
  renameMode?: 'before' | 'after'
  failRollback?: boolean
}

function runFailedSwitch(home: string, preload: string, options: FailureOptions = {}) {
  const args = ['--agent', 'codex', 'provider', 'use', 'router']
  if (options.adopt === true) args.push('--adopt-current-as', 'kept')
  args.push('--json')
  return runCliWithPreload(args, preload, {
    CCSET_HOME: home,
    CCSET_FAIL_RENAME_TARGET: codexAuthPath(home),
    CCSET_CONFIG_PATH: codexConfigPath(home),
    CCSET_RENAME_MODE: options.renameMode ?? 'before',
    CCSET_FAIL_ROLLBACK: options.failRollback === true ? '1' : undefined,
    CODEX_HOME: undefined,
  })
}

function withoutSecrets(result: { stdout: string; stderr: string }): void {
  const output = `${result.stdout}${result.stderr}`
  assert.equal(output.includes('old-secret') || output.includes('new-secret'), false)
}

async function verifyOrdinaryFailure(home: string, preload: string): Promise<void> {
  const result = await runFailedSwitch(home, preload)
  assert.equal(result.code, EXIT_RUNTIME, 'a failed auth move did not report a runtime failure')
  const envelope = JSON.parse(result.stdout) as FailureEnvelope
  assert.equal(envelope.ok, false)
  assert.equal(await fs.readFile(codexConfigPath(home), 'utf8'), CONFIG, 'routing was not restored')
  assert.equal(await fs.readFile(codexAuthPath(home), 'utf8'), LIVE_AUTH, 'the live credential was replaced')
  withoutSecrets(result)
}

async function verifyAdoptionFailure(home: string, preload: string): Promise<void> {
  await fs.writeFile(codexAuthPath(home), UNKNOWN_AUTH, { mode: 0o600 })
  const result = await runFailedSwitch(home, preload, { adopt: true })
  assert.equal(result.code, EXIT_RUNTIME)
  const envelope = JSON.parse(result.stdout) as FailureEnvelope
  assert.equal(await fs.readFile(codexConfigPath(home), 'utf8'), CONFIG, 'routing was not restored after adoption')
  assert.equal(await fs.readFile(codexAuthPath(home), 'utf8'), UNKNOWN_AUTH, 'the live credential was replaced')
  assert.equal(await fs.readFile(authProfilePath(home, 'kept'), 'utf8'), UNKNOWN_AUTH)
  assert.equal(
    (envelope.partial ?? []).some((entry) => entry.endsWith('auth.kept.json')),
    true,
    'the persisted adoption was omitted from the partial report',
  )
  assert.equal(
    (envelope.partial ?? []).some((entry) => entry.endsWith('config.toml')),
    false,
    'the restored routing was reported as a partial commit',
  )
  withoutSecrets(result)
}

/**
 * M-1: the credential write is the move's commit point. When the rename lands
 * and only the return path fails, auth.json already holds the new credential,
 * so reverting model_provider would pair the old endpoint with the new key.
 * The report must keep the routing and name both files as written.
 */
async function verifyPostRenameFailure(home: string, preload: string): Promise<void> {
  const result = await runFailedSwitch(home, preload, { renameMode: 'after' })
  assert.equal(result.code, EXIT_RUNTIME, 'a post-rename failure did not report a runtime failure')
  const envelope = JSON.parse(result.stdout) as FailureEnvelope
  assert.equal(await fs.readFile(codexAuthPath(home), 'utf8'), ROUTER_AUTH, 'the credential move did not land')
  assert.match(
    await fs.readFile(codexConfigPath(home), 'utf8'),
    /model_provider = "router"/,
    'routing was reverted even though the credential had moved',
  )
  assert.equal(
    (envelope.partial ?? []).some((entry) => entry.endsWith('auth.json')),
    true,
    'the replaced credential was not reported as written',
  )
  assert.equal(
    (envelope.partial ?? []).some((entry) => entry.endsWith('config.toml')),
    true,
    'the committed routing was not reported as written',
  )
  withoutSecrets(result)
}

/**
 * M-2: when the credential move fails and restoring the previous routing fails
 * too, the report has to say the rollback failed and why. Dropping that error
 * would leave the user with a partial commit and no reason the undo did not
 * take.
 */
async function verifyRollbackFailure(home: string, preload: string): Promise<void> {
  const result = await runFailedSwitch(home, preload, { failRollback: true })
  assert.equal(result.code, EXIT_RUNTIME, 'a failed rollback did not report a runtime failure')
  const envelope = JSON.parse(result.stdout) as FailureEnvelope
  assert.equal(
    (envelope.partial ?? []).some((entry) => entry.endsWith('config.toml')),
    true,
    'the un-restored routing was not reported as a partial commit',
  )
  assert.equal(envelope.error?.rollback?.code, 'error.io', 'the rollback failure was dropped')
  withoutSecrets(result)
}

async function withFailureHome(
  label: string,
  run: (home: string, preload: string) => Promise<void>,
): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `ccset-codex-use-${label}-`))
  const preload = path.join(home, 'fail-auth-rename.cjs')
  try {
    await installRenameFailure(home, preload)
    await run(home, preload)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

export async function verifyFailedAuthMoveRestoresRouting(): Promise<void> {
  await withFailureHome('ordinary', verifyOrdinaryFailure)
  await withFailureHome('adopt', verifyAdoptionFailure)
  await withFailureHome('post-rename', verifyPostRenameFailure)
  await withFailureHome('rollback', verifyRollbackFailure)
}
