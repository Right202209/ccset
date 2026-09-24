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
  error?: { code: string; params?: Record<string, unknown> }
}

async function installRenameFailure(home: string, preload: string): Promise<void> {
  const directory = path.dirname(codexConfigPath(home))
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(codexConfigPath(home), CONFIG, { mode: 0o600 })
  await fs.writeFile(codexAuthPath(home), LIVE_AUTH, { mode: 0o600 })
  await fs.writeFile(authProfilePath(home, 'old'), LIVE_AUTH, { mode: 0o600 })
  await fs.writeFile(authProfilePath(home, 'router'), ROUTER_AUTH, { mode: 0o600 })
  await fs.writeFile(preload, `const fs = require('node:fs')
const path = require('node:path')
const rename = fs.promises.rename
fs.promises.rename = async (source, target) => {
  if (path.resolve(target) === path.resolve(process.env.CCSET_FAIL_RENAME_TARGET)) {
    const error = Object.assign(new Error('injected auth rename failure'), { code: 'EIO' })
    throw error
  }
  return rename(source, target)
}
`)
}

function runFailedSwitch(home: string, preload: string, adopt: boolean) {
  const args = ['--agent', 'codex', 'provider', 'use', 'router']
  if (adopt) args.push('--adopt-current-as', 'kept')
  args.push('--json')
  return runCliWithPreload(args, preload, {
    CCSET_HOME: home,
    CCSET_FAIL_RENAME_TARGET: codexAuthPath(home),
    CODEX_HOME: undefined,
  })
}

async function verifyOrdinaryFailure(home: string, preload: string): Promise<void> {
  const result = await runFailedSwitch(home, preload, false)
  assert.equal(result.code, EXIT_RUNTIME, 'a failed auth move did not report a runtime failure')
  const envelope = JSON.parse(result.stdout) as FailureEnvelope
  assert.equal(envelope.ok, false)
  assert.equal(await fs.readFile(codexConfigPath(home), 'utf8'), CONFIG, 'routing was not restored')
  assert.equal(await fs.readFile(codexAuthPath(home), 'utf8'), LIVE_AUTH, 'the live credential was replaced')
  const output = `${result.stdout}${result.stderr}${JSON.stringify(envelope.error?.params ?? {})}`
  assert.equal(output.includes('old-secret') || output.includes('new-secret'), false)
}

async function verifyAdoptionFailure(home: string, preload: string): Promise<void> {
  await fs.writeFile(codexAuthPath(home), UNKNOWN_AUTH, { mode: 0o600 })
  const result = await runFailedSwitch(home, preload, true)
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
}

export async function verifyFailedAuthMoveRestoresRouting(): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-codex-use-failure-'))
  const preload = path.join(home, 'fail-auth-rename.cjs')
  try {
    await installRenameFailure(home, preload)
    await verifyOrdinaryFailure(home, preload)
    await verifyAdoptionFailure(home, preload)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}
