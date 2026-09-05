import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveGlobal } from '../src/agents/opencode/global.js'
import { loadProviders, saveProvider } from '../src/agents/opencode/providers.js'
import { buildStatus } from '../src/agents/opencode/status.js'
import { backupsDir, opencodeConfigPath } from '../src/agents/opencode/paths.js'
import { BACKUP_INFIX, MAX_BACKUPS } from '../src/core/constants.js'
import { maskSecret } from '../src/core/mask.js'
import { verifyJsoncScenarios } from './verify-opencode-jsonc-scenarios.js'
import { verifyJsoncCodec } from './verify-opencode-jsonc.js'
import type { FormValues, JsonObject } from '../src/types.js'

/**
 * O1-O7 for the second agent. opencode keeps every provider inside one
 * document, so these cover what the Claude Code fixtures cannot: unmanaged
 * siblings four levels deep, and a models map that has to merge per key
 * instead of being written wholesale.
 *
 * The managed-.jsonc gates (O7 revised, O8-O10) live in
 * verify-opencode-jsonc-scenarios.ts and the JSONC codec corpus in
 * verify-opencode-jsonc.ts; both run here, the way verify-toml-codec runs
 * inside verify:codex (issue #46).
 */

const API_KEY = 'OPENCODE-TEST-KEY-1234567890'

function providerValues(id: string, models: string, extra: FormValues = {}): FormValues {
  return {
    id,
    displayName: 'Test Router',
    baseUrl: 'https://router.example/v1',
    apiKey: API_KEY,
    npm: '@ai-sdk/anthropic',
    models,
    timeout: '',
    ...extra,
  }
}

async function readConfig(home: string): Promise<JsonObject> {
  return JSON.parse(await fs.readFile(opencodeConfigPath(home), 'utf8')) as JsonObject
}

function providerBlock(config: JsonObject, id: string): JsonObject {
  const root = config['provider'] as JsonObject
  return root[id] as JsonObject
}

async function assertMode600(filePath: string): Promise<void> {
  if (process.platform === 'win32') return
  assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600)
}

async function backupNames(home: string): Promise<string[]> {
  const names = await fs.readdir(backupsDir(home))
  const prefix = `${path.basename(opencodeConfigPath(home))}${BACKUP_INFIX}`
  return names.filter((name) => name.startsWith(prefix))
}

/** The document a user already had, with keys ccset manages none of. */
const ORIGINAL: JsonObject = {
  $schema: 'https://opencode.ai/config.json',
  theme: 'tokyonight',
  keybinds: { leader: 'ctrl+x', app_exit: 'ctrl+c' },
  mcp: { local: { type: 'local', command: ['run', 'me'] } },
  provider: {
    'hand-written': { npm: '@ai-sdk/openai-compatible', options: { baseURL: 'https://keep.me' } },
    router: {
      options: { baseURL: 'https://old.example', headers: { 'x-custom': 'keep' } },
      models: {
        'model-keep': { name: 'Keep me', options: { temperature: 0.2 } },
        'model-drop': {},
      },
    },
  },
}

/** O1, O4: unmanaged keys survive, and the models map merges per key. */
async function verifyProviderMerge(home: string): Promise<void> {
  await saveProvider({ home }, providerValues('router', 'model-keep, model-new'))
  const config = await readConfig(home)

  assert.equal(config['theme'], 'tokyonight', 'O1: an unmanaged top-level key was lost')
  assert.deepEqual(config['keybinds'], ORIGINAL['keybinds'], 'O1: unmanaged nested keys changed')
  assert.deepEqual(config['mcp'], ORIGINAL['mcp'], 'O1: an unmanaged subtree changed')
  assert.deepEqual(
    providerBlock(config, 'hand-written'),
    (ORIGINAL['provider'] as JsonObject)['hand-written'],
    'O1: editing one provider changed another',
  )

  const block = providerBlock(config, 'router')
  const options = block['options'] as JsonObject
  assert.equal(options['baseURL'], 'https://router.example/v1')
  assert.equal(options['apiKey'], API_KEY)
  assert.deepEqual(
    options['headers'],
    { 'x-custom': 'keep' },
    'O1: an unmanaged sibling of a managed key was lost four levels deep',
  )

  const models = block['models'] as JsonObject
  assert.deepEqual(
    models['model-keep'],
    { name: 'Keep me', options: { temperature: 0.2 } },
    'O4: a model already on disk lost the options ccset does not manage',
  )
  assert.deepEqual(models['model-new'], {}, 'O4: a newly listed model was not added')
  assert.equal('model-drop' in models, false, 'O4: a model dropped from the list survived')
}

/** O2: a blank field omits its key entirely -- no null, no "". */
async function verifyBlankOmits(home: string): Promise<void> {
  await saveProvider({ home }, providerValues('router', 'model-keep', { displayName: '' }))
  const block = providerBlock(await readConfig(home), 'router')
  assert.equal('name' in block, false, 'O2: a blank field was written rather than omitted')

  await saveProvider({ home }, providerValues('router', 'model-keep', { timeout: '4000' }))
  const withTimeout = providerBlock(await readConfig(home), 'router')['options'] as JsonObject
  assert.equal(withTimeout['timeout'], 4000, 'O2: an int field was written as a string')
}

/** O3: `autoupdate` is a real JSON boolean, not the string "false". */
async function verifyGlobalTypes(home: string): Promise<void> {
  await saveGlobal(
    { home },
    {
      model: 'router/model-keep',
      smallModel: '',
      share: 'disabled',
      autoupdate: 'false',
      username: '',
      disabledProviders: 'openai, google',
    },
  )
  const config = await readConfig(home)
  assert.equal(config['model'], 'router/model-keep')
  assert.equal(config['autoupdate'], false, 'O3: autoupdate was written as a string')
  assert.equal(config['share'], 'disabled')
  assert.deepEqual(config['disabled_providers'], ['openai', 'google'], 'O3: csv was not an array')
  assert.equal('small_model' in config, false, 'O2: a blank global field was written')
  assert.equal('username' in config, false, 'O2: a blank global field was written')

  await saveGlobal(
    { home },
    {
      model: 'router/model-keep',
      smallModel: '',
      share: '',
      autoupdate: '',
      username: '',
      disabledProviders: '',
    },
  )
  const cleared = await readConfig(home)
  assert.equal('share' in cleared, false, 'O5: unmanaged did not delete the key')
  assert.equal('autoupdate' in cleared, false, 'O5: unmanaged did not delete the key')
  assert.equal(cleared['theme'], 'tokyonight', 'O1: a global save lost an unmanaged key')
}

/** O6: backups rotate per file at 0600, and the key never appears unmasked. */
async function verifyBackupsAndMasking(home: string): Promise<void> {
  for (let index = 0; index < MAX_BACKUPS + 3; index += 1) {
    await saveProvider({ home }, providerValues('router', `model-keep, model-${index}`))
  }
  const backups = await backupNames(home)
  assert.equal(backups.length, MAX_BACKUPS, 'O6: backups were not pruned to MAX_BACKUPS')
  await assertMode600(opencodeConfigPath(home))
  for (const name of backups) await assertMode600(path.join(backupsDir(home), name))

  const status = await buildStatus({ home })
  const serialized = JSON.stringify(status.sections)
  assert.equal(serialized.includes(API_KEY), false, 'O6: Status leaked the API key')
  assert.equal(serialized.includes(maskSecret(API_KEY)), true, 'O6: Status did not mask the key')
}

/** The provider list is read back from the keys of one document. */
async function verifyDiscovery(home: string): Promise<void> {
  const list = await loadProviders({ home })
  assert.equal(list.parsed, true)
  assert.deepEqual(
    list.records.map((record) => record.id),
    ['hand-written', 'router'],
    'Provider discovery did not read every block',
  )
  const handWritten = list.records.find((record) => record.id === 'hand-written')
  assert.equal(handWritten?.baseUrl, 'https://keep.me')
}

async function main(): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-opencode-'))
  try {
    const target = opencodeConfigPath(home)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, `${JSON.stringify(ORIGINAL, null, 2)}\n`, { mode: 0o600 })

    await verifyProviderMerge(home)
    await verifyBlankOmits(home)
    await verifyGlobalTypes(home)
    await verifyDiscovery(home)
    await verifyBackupsAndMasking(home)

    verifyJsoncCodec()
    await verifyJsoncScenarios(providerValues, API_KEY)

    process.stdout.write('opencode agent verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
