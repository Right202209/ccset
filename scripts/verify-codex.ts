import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveGlobal } from '../src/agents/codex/global.js'
import { loadProviders, saveProvider } from '../src/agents/codex/providers.js'
import { buildStatus } from '../src/agents/codex/status.js'
import { backupsDir, codexConfigPath } from '../src/agents/codex/paths.js'
import { BACKUP_INFIX, MAX_BACKUPS } from '../src/core/constants.js'
import { maskSecret } from '../src/core/mask.js'
import { findTomlProblem, readTomlObject } from '../src/core/toml/index.js'
import { verifyTomlCodec } from './verify-toml-codec.js'
import {
  backupNames as listBackupNames,
  verifyCodexScreens,
  verifyHomeOverrideIsReported,
  verifyKeyStaysOutOfConfig,
  verifyRemoveProfile,
  verifySwitch,
} from './verify-codex-auth.js'
import type { FormValues, JsonObject } from '../src/types.js'

/**
 * C1-C9 for the third agent. Codex is the first non-JSON target, so the codec
 * carries most of the risk; that half lives in verify-toml-codec.ts and runs
 * from here, as the credential half lives in verify-codex-auth.ts. What is left
 * is the config document a user already had.
 */

const API_KEY = 'CODEX-TEST-KEY-1234567890'

/** A config.toml a user already had, managed by ccset in none of its parts. */
const ORIGINAL = `# My Codex setup. Do not reformat.
model          = "gpt-5.6"
model_provider = "openai"   # trailing comment

project_doc_max_bytes = 32768
project_root_markers  = [".git", ".hg"]

[history]
persistence = "save-all"
max_bytes   = 1048576

# This comment introduces the table below.
[model_providers.router]
name                = "Existing Router"
base_url            = "https://old.example/v1"
http_headers        = { "x-team" = "core" }
request_max_retries = 3

[shell_environment_policy]
inherit = "core"
exclude = ["AWS_*", "AZURE_*"]

[[profiles.saved]]
name = "one"

[[profiles.saved]]
name = "two"

[tui]
theme = "dark"
notes = """
keep
  this "verbatim"
"""
`

function providerValues(id: string, extra: FormValues = {}): FormValues {
  return {
    id,
    displayName: 'Test Router',
    baseUrl: 'https://router.example/v1',
    apiKey: API_KEY,
    requestMaxRetries: '',
    streamMaxRetries: '',
    streamIdleTimeoutMs: '',
    ...extra,
  }
}

function globalValues(extra: FormValues = {}): FormValues {
  return {
    model: 'gpt-5.6',
    modelProvider: 'router',
    reasoningEffort: 'medium',
    approvalPolicy: 'on-request',
    sandboxMode: 'workspace-write',
    verbosity: '',
    contextWindow: '',
    ...extra,
  }
}

async function readRaw(home: string): Promise<string> {
  return fs.readFile(codexConfigPath(home), 'utf8')
}

async function readConfig(home: string): Promise<JsonObject> {
  return readTomlObject(await readRaw(home))
}

function providerTable(config: JsonObject, id: string): JsonObject {
  return (config['model_providers'] as JsonObject)[id] as JsonObject
}

async function assertMode600(filePath: string): Promise<void> {
  if (process.platform === 'win32') return
  assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600)
}

async function backupNames(home: string, basename: string): Promise<string[]> {
  return listBackupNames(backupsDir(home), basename, BACKUP_INFIX)
}

/**
 * C1 (U7): the shape of the document a user already had is read back intact
 * before anything is written to it. The codec's own round-trip corpus is in
 * verify-toml-codec.ts; this is the fixture's own document.
 */
function verifyRoundTrip(): void {
  verifyTomlCodec()
  assert.equal(findTomlProblem(ORIGINAL), null, 'C1: a valid document was reported malformed')

  const data = readTomlObject(ORIGINAL)
  assert.equal(data['model'], 'gpt-5.6')
  assert.equal(data['project_doc_max_bytes'], 32768, 'C1: an integer read back as something else')
  assert.deepEqual((data['history'] as JsonObject)['persistence'], 'save-all')
  assert.deepEqual(providerTable(data, 'router')['http_headers'], { 'x-team': 'core' })
  assert.deepEqual((data['profiles'] as JsonObject)['saved'], [{ name: 'one' }, { name: 'two' }])
  assert.equal((data['tui'] as JsonObject)['notes'], 'keep\n  this "verbatim"\n')
}

/** C2: an edit touches its own line and nothing else in the document. */
async function verifyFormattingSurvives(home: string): Promise<void> {
  await saveProvider({ home }, providerValues('router'))
  const raw = await readRaw(home)

  assert.ok(raw.includes('# My Codex setup. Do not reformat.'), 'C2: the leading comment was lost')
  assert.ok(raw.includes('# trailing comment'), 'C2: a trailing comment was lost')
  assert.ok(raw.includes('# This comment introduces the table below.'), 'C2: a comment moved')
  assert.ok(raw.includes('model          = "gpt-5.6"'), 'C2: alignment was rewritten')
  assert.ok(raw.includes('http_headers        = { "x-team" = "core" }'), 'C2: a sibling changed')
  assert.ok(raw.includes('  this "verbatim"'), 'C2: a multi-line string was damaged')
  assert.ok(raw.includes('[[profiles.saved]]'), 'C2: an array of tables was lost')
  assert.equal(findTomlProblem(raw), null, 'C2: the edited document is not valid TOML')

  const config = await readConfig(home)
  assert.equal(config['project_doc_max_bytes'], 32768, 'C2: an unmanaged top-level key was lost')
  assert.deepEqual((config['history'] as JsonObject)['max_bytes'], 1048576, 'C2: a table changed')
  assert.deepEqual(
    (config['shell_environment_policy'] as JsonObject)['exclude'],
    ['AWS_*', 'AZURE_*'],
    'C2: an unmanaged array was lost',
  )

  const table = providerTable(config, 'router')
  assert.equal(table['base_url'], 'https://router.example/v1')
  assert.equal(table['name'], 'Test Router')
  assert.deepEqual(table['http_headers'], { 'x-team': 'core' }, 'C2: an unmanaged sibling was lost')
}

/** C3: wire_api and requires_openai_auth are asserted on every save. */
async function verifyAuthWiring(home: string): Promise<void> {
  const table = providerTable(await readConfig(home), 'router')
  assert.equal(table['wire_api'], 'responses', 'C3: wire_api was not written')
  assert.equal(
    table['requires_openai_auth'],
    true,
    'C3: requires_openai_auth was not written — Codex would ignore auth.json for this provider',
  )
  const raw = await readRaw(home)
  assert.ok(raw.includes('requires_openai_auth = true'), 'C3: the boolean was written as a string')
  assert.equal(raw.includes('"true"'), false, 'C3: a TOML boolean was quoted')
}

/** C4: a blank field omits its key, and clearing one deletes the line. */
async function verifyBlankOmits(home: string): Promise<void> {
  let table = providerTable(await readConfig(home), 'router')
  assert.equal('stream_max_retries' in table, false, 'C4: a blank field was written')
  assert.equal(
    'request_max_retries' in table,
    false,
    'C4: a field the form left blank was not deleted from disk',
  )

  await saveProvider({ home }, providerValues('router', { requestMaxRetries: '5' }))
  table = providerTable(await readConfig(home), 'router')
  assert.equal(table['request_max_retries'], 5, 'C4: an int field was written as a string')

  await saveProvider({ home }, providerValues('router', { displayName: '' }))
  table = providerTable(await readConfig(home), 'router')
  assert.equal('name' in table, false, 'C4: a blank field was written rather than omitted')
  assert.equal('request_max_retries' in table, false, 'C4: clearing a field left the key behind')
}

/** C5: global settings, including a table that has to be created from nothing. */
async function verifyGlobal(home: string): Promise<void> {
  await saveGlobal({ home }, globalValues({ contextWindow: '200000' }))
  const config = await readConfig(home)
  assert.equal(config['model_provider'], 'router')
  assert.equal(config['approval_policy'], 'on-request')
  assert.equal(config['sandbox_mode'], 'workspace-write')
  assert.equal(config['model_context_window'], 200000, 'C5: an int was written as a string')
  assert.equal('model_verbosity' in config, false, 'C5: an unmanaged choice was written')
  assert.equal(config['project_doc_max_bytes'], 32768, 'C5: a global save lost an unmanaged key')

  await saveGlobal({ home }, globalValues({ approvalPolicy: '', sandboxMode: '' }))
  const cleared = await readConfig(home)
  assert.equal('approval_policy' in cleared, false, 'C5: unmanaged did not delete the key')
  assert.equal('sandbox_mode' in cleared, false, 'C5: unmanaged did not delete the key')

  const raw = await readRaw(home)
  assert.ok(raw.includes('# My Codex setup. Do not reformat.'), 'C5: a global save lost a comment')
  assert.equal(findTomlProblem(raw), null, 'C5: a global save produced invalid TOML')
}

/** C9: backups rotate per file at 0600, and no key appears unmasked. */
async function verifyBackupsAndMasking(home: string): Promise<void> {
  for (let index = 0; index < MAX_BACKUPS + 3; index += 1) {
    await saveProvider({ home }, providerValues('router', { streamMaxRetries: String(index + 1) }))
  }
  const configBackups = await backupNames(home, path.basename(codexConfigPath(home)))
  assert.equal(configBackups.length, MAX_BACKUPS, 'C9: backups were not pruned to MAX_BACKUPS')
  await assertMode600(codexConfigPath(home))
  for (const name of configBackups) await assertMode600(path.join(backupsDir(home), name))

  const status = await buildStatus({ home })
  const serialized = JSON.stringify(status.sections)
  assert.equal(serialized.includes(API_KEY), false, 'C9: Status leaked the API key')
  assert.equal(serialized.includes(maskSecret(API_KEY)), true, 'C9: Status did not mask the key')
  assert.equal(serialized.includes('oauth'), false, 'C9: Status leaked an adopted OAuth token')
}

/** A malformed target is reported, never silently rewritten. */
async function verifyMalformedIsReported(home: string): Promise<void> {
  const target = codexConfigPath(home)
  const broken = 'model = "unterminated\n[model_providers.x\n'
  await fs.writeFile(target, broken, { mode: 0o600 })

  const list = await loadProviders({ home })
  assert.equal(list.parsed, false, 'A malformed config.toml was parsed anyway')
  assert.equal(list.problemKey, 'status.parseErrorToml')

  await assert.rejects(
    () => saveProvider({ home }, providerValues('router')),
    (err: Error) => err.name === 'TomlParseError',
    'A malformed config.toml was overwritten without asking',
  )
  assert.equal(await fs.readFile(target, 'utf8'), broken, 'The malformed file was modified')
}

async function main(): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-codex-'))
  try {
    const target = codexConfigPath(home)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, ORIGINAL, { mode: 0o600 })

    verifyRoundTrip()
    await verifyFormattingSurvives(home)
    await verifyAuthWiring(home)
    await verifyBlankOmits(home)
    await verifyGlobal(home)
    await verifyKeyStaysOutOfConfig(home, target, API_KEY)
    await verifySwitch(home, API_KEY)
    await verifyRemoveProfile(home, providerValues, readConfig)
    await verifyCodexScreens({ home })
    await verifyBackupsAndMasking(home)
    await verifyHomeOverrideIsReported(home, () => saveGlobal({ home }, globalValues()))
    await verifyMalformedIsReported(home)

    process.stdout.write('codex agent verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
