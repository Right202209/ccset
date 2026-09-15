import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MAX_BACKUPS } from '../src/core/constants.js'
import { backupsDirFor } from '../src/core/paths.js'
import { countBackups } from '../src/core/backup.js'
import { readConfigFile, renderConfigFile } from '../src/core/config-file.js'
import { readTomlObject } from '../src/core/toml/index.js'
import type { Ctx, FormValues } from '../src/types.js'
import { authPath, configFile, configPath, grokDir } from '../src/agents/grok-build/paths.js'
import { emitProvider, loadProviders, saveProvider } from '../src/agents/grok-build/providers.js'
import { emitGlobal, saveGlobal, seedGlobal } from '../src/agents/grok-build/global.js'
import { buildStatus } from '../src/agents/grok-build/status.js'
import { detect } from '../src/agents/grok-build/index.js'
import { withHome } from './cli-harness.js'

/**
 * The grok-build TUI seam: the seed/emit/save functions the forms submit
 * through, unmanaged-key preservation at four levels of TOML nesting, the
 * backup and permission guarantees, the GROK_HOME rule, and the
 * format-preservation corpus. Writes here go through the same save* functions
 * the TUI uses; the process seam lives in verify-commands-grok-build.ts and
 * the screen walk in verify-grok-build-screens.ts.
 */

const SECRET = 'sk-TEST-DO-NOT-USE-0123456789'

const CONFIG_WITH_EXTRAS = `# grok config, hand written
[models]
temperature = 0.5

[model.relay] # third-party relay
model = "claude-x"
base_url = "https://r.example/v1"
extra_headers = { "x-custom" = "keep" }
api_key = "${SECRET}"

# A built-in override: ids with a dot need the quoted form, and ccset's own
# id rules never produce one, so this block is disk context that must survive.
[model."grok-4.6"]
api_key = "built-in-override-key"
`

async function writeConfig(home: string, text: string): Promise<void> {
  const target = configPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text, { mode: 0o600 })
}

async function configOf(home: string): Promise<Record<string, any>> {
  const raw = await fs.readFile(configPath(home), 'utf8')
  return readTomlObject(raw) as Record<string, any>
}

/** The form domain is strings; blanks mean the field was left empty. */
function valuesOf(input: Record<string, string | undefined>): FormValues {
  const values: FormValues = {}
  for (const [key, value] of Object.entries(input)) values[key] = value ?? ''
  return values
}

async function checkProviderLeavesSurvive(home: string): Promise<void> {
  await writeConfig(home, CONFIG_WITH_EXTRAS)
  const ctx: Ctx = { home }
  await saveProvider(
    ctx,
    valuesOf({
      id: 'relay',
      modelId: 'claude-x',
      baseUrl: 'https://n.example/v1',
      displayName: 'Relay',
      apiBackend: 'messages',
      apiKey: SECRET,
    }),
  )
  const raw = await fs.readFile(configPath(home), 'utf8')
  assert.match(raw, /hand written/, 'a comment was lost')
  assert.match(raw, /third-party relay/, 'a trailing table comment was lost')
  const data = await configOf(home)
  assert.equal(data['models']['temperature'], 0.5, 'an unmanaged global sibling was lost')
  const relay = data['model']['relay']
  assert.equal(relay['base_url'], 'https://n.example/v1', 'the managed edit did not land')
  assert.deepEqual(relay['extra_headers'], { 'x-custom': 'keep' }, 'unmanaged provider keys were lost')
  assert.equal(relay['api_key'], SECRET, 'the key was disturbed by an edit that resubmitted it')
  assert.equal(relay['api_backend'], 'messages')
  const override = data['model']['grok-4.6']
  assert.equal(override['api_key'], 'built-in-override-key', 'another provider was disturbed')
  assert.equal(override['base_url'], undefined, 'a field the form left blank was written')
  await checkUnchangedSaveIsByteIdentical(ctx)
}

/** An unchanged save must not rewrite the file at all. */
async function checkUnchangedSaveIsByteIdentical(ctx: Ctx): Promise<void> {
  const home = ctx.home
  const before = await fs.readFile(configPath(home), 'utf8')
  await saveProvider(
    ctx,
    valuesOf({
      id: 'relay',
      modelId: 'claude-x',
      baseUrl: 'https://n.example/v1',
      displayName: 'Relay',
      apiBackend: 'messages',
      apiKey: SECRET,
    }),
  )
  assert.equal(await fs.readFile(configPath(home), 'utf8'), before, 'an unchanged save rewrote bytes')
}

async function checkBlankOmitsKey(home: string): Promise<void> {
  await writeConfig(
    home,
    '[model.relay]\nmodel = "claude-x"\nbase_url = "https://r.example/v1"\nname = "Relay"\napi_backend = "messages"\napi_key = "old-key-0123456789"\n',
  )
  const ctx: Ctx = { home }
  await saveProvider(ctx, valuesOf({ id: 'relay', baseUrl: 'https://r.example/v2' }))
  const block = (await configOf(home))['model']['relay']
  assert.equal(block['base_url'], 'https://r.example/v2')
  assert.equal('model' in block, false, 'a blank field wrote a value instead of omitting the key')
  assert.equal('name' in block, false, 'a blank field wrote a value instead of omitting the key')
  assert.equal('api_backend' in block, false, 'a blank choice wrote a value instead of omitting the key')
  assert.equal('api_key' in block, false, 'a blank secret wrote a value instead of omitting the key')
  for (const write of emitProvider(valuesOf({ id: 'r', modelId: '', baseUrl: '', displayName: '', apiBackend: '', apiKey: '' }))) {
    assert.equal(write.value, undefined, 'a blank field produced a concrete value')
  }
}

/**
 * A form opened before grok edited its own file: the save re-reads the target,
 * so the newcomer survives alongside the managed edit.
 */
async function checkExternalEditBetweenOpenAndSave(home: string): Promise<void> {
  const ctx: Ctx = { home }
  await writeConfig(home, '[model.relay]\nmodel = "claude-x"\nbase_url = "https://r.example/v1"\n')
  const opened = await loadProviders(ctx)
  assert.equal(opened.records[0]?.baseUrl, 'https://r.example/v1', 'the form view did not seed')
  await writeConfig(
    home,
    '[model.relay]\nmodel = "claude-x"\nbase_url = "https://r.example/v1"\nquery_params = { api-version = "2026-07-22" }\n',
  )
  await saveProvider(
    ctx,
    valuesOf({ id: 'relay', modelId: 'claude-x', baseUrl: 'https://n.example/v1' }),
  )
  const block = (await configOf(home))['model']['relay']
  assert.equal(block['base_url'], 'https://n.example/v1', 'the form edit did not land')
  assert.equal(
    block['query_params']['api-version'],
    '2026-07-22',
    'a change made after the form opened was clobbered',
  )
}

/**
 * The format-preservation corpus for config.toml: an empty write list and a
 * same-value managed write must both leave every byte alone -- comments, CRLF
 * line endings, key order and inline tables included.
 */
async function checkTomlCorpus(home: string): Promise<void> {
  const corpus = [
    '# top comment\r\n',
    '[models]\r\n',
    'temperature = 0.5\r\n',
    '\r\n',
    '[model.relay] # trailing\r\n',
    'model = "claude-x" # sent to the API\r\n',
    'base_url = "https://r.example/v1"\r\n',
    'extra_headers = { "x-custom" = "keep" }\r\n',
  ].join('')
  await writeConfig(home, corpus)
  const file = configFile(home)
  const base = await readConfigFile(file)
  const model = base.data['model'] as Record<string, any>
  assert.equal(model['relay']['base_url'], 'https://r.example/v1', 'the corpus did not parse')
  assert.equal(renderConfigFile(file, base, []), corpus, 'an empty write list disturbed the bytes')
  const sameValue = renderConfigFile(file, base, [
    { path: ['model', 'relay', 'base_url'], value: 'https://r.example/v1' },
  ])
  assert.equal(sameValue, corpus, 'a same-value write disturbed the bytes')
}

async function checkGlobal(home: string): Promise<void> {
  const ctx: Ctx = { home }
  await writeConfig(home, '[models]\ntemperature = 0.5\n[cli]\nauto_update = false\n')
  await saveGlobal(ctx, valuesOf({ defaultModel: 'relay' }))
  const config = await configOf(home)
  assert.equal(config['models']['temperature'], 0.5, 'an unmanaged models key was lost')
  assert.equal(config['cli']['auto_update'], false, 'an unmanaged table was lost')
  assert.equal(config['models']['default'], 'relay')
  await saveGlobal(ctx, valuesOf({ defaultModel: '' }))
  const cleared = await configOf(home)
  assert.equal('default' in cleared['models'], false, 'a blank global field kept its key')
  assert.equal(cleared['models']['temperature'], 0.5, 'the blank save disturbed siblings')
  assert.deepEqual(emitGlobal(valuesOf({ defaultModel: '' }))[0]?.value, undefined)
  assert.equal(Object.keys(seedGlobal({})).length, 1, 'the global seed drifted')
}

async function checkBackupsAndModes(home: string): Promise<void> {
  const ctx: Ctx = { home }
  await writeConfig(home, '[model.relay]\nbase_url = "https://r.example/v1"\n')
  for (let round = 0; round < MAX_BACKUPS + 3; round += 1) {
    await saveProvider(ctx, valuesOf({ id: 'relay', baseUrl: `https://r${round}.example/v1` }))
  }
  const backups = backupsDirFor(grokDir(home))
  assert.equal(await countBackups(backups), MAX_BACKUPS, 'backups did not rotate to MAX_BACKUPS')
  const names = (await fs.readdir(backups)).sort()
  const first = names[0]
  assert.ok(first, 'no backups were written')
  assert.match(await fs.readFile(path.join(backups, first), 'utf8'), /\[model\.relay\]/, 'a backup lost the original bytes')
  assert.equal((await fs.stat(configPath(home))).mode & 0o777, 0o600, 'the target was not 0600')
  for (const name of names) {
    assert.equal((await fs.stat(path.join(backups, name))).mode & 0o777, 0o600, `backup ${name} was not 0600`)
  }
}

async function checkStatusAndDetection(home: string): Promise<void> {
  const ctx: Ctx = { home }
  assert.equal(await detect(ctx), false, 'an empty home was detected as grok-build')
  await writeConfig(home, CONFIG_WITH_EXTRAS)
  await fs.mkdir(grokDir(home), { recursive: true })
  await fs.writeFile(authPath(home), '{"access_token":"tok"}', { mode: 0o600 })
  assert.equal(await detect(ctx), true, 'a populated home was not detected')
  const before = await fs.readFile(configPath(home), 'utf8')
  const painted = JSON.stringify((await buildStatus(ctx)).sections)
  assert.equal(painted.includes(SECRET), false, 'status leaked the provider key')
  assert.ok(painted.includes('••'), 'status did not mask the provider key')
  assert.ok(painted.includes('auth.json'), 'status did not name the unmanaged auth file')
  const providers = await loadProviders(ctx)
  assert.equal(providers.records.length, 2, 'status mis-read the provider blocks')
  assert.equal(await fs.readFile(configPath(home), 'utf8'), before, 'status wrote to config.toml')
  const leftovers = await fs.readdir(backupsDirFor(grokDir(home))).catch(() => [] as string[])
  assert.equal(leftovers.length, 0, 'status created backups')
}

async function checkGrokHomeRule(): Promise<void> {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-grok-dir-'))
  try {
    process.env['GROK_HOME'] = '/tmp/ccset-grok-override'
    assert.equal(grokDir(scratch), path.join(scratch, '.grok'), 'a scratch home followed the override')
    assert.equal(grokDir(os.homedir()), '/tmp/ccset-grok-override', 'the real home ignored the override')
    delete process.env['GROK_HOME']
    assert.equal(grokDir(os.homedir()), path.join(os.homedir(), '.grok'), 'the default dir drifted')
  } finally {
    delete process.env['GROK_HOME']
    await fs.rm(scratch, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  await withHome('grok-leaves', checkProviderLeavesSurvive)
  await withHome('grok-blank-omits', checkBlankOmitsKey)
  await withHome('grok-external-edit', checkExternalEditBetweenOpenAndSave)
  await withHome('grok-corpus', checkTomlCorpus)
  await withHome('grok-global', checkGlobal)
  await withHome('grok-backups', checkBackupsAndModes)
  await withHome('grok-status', checkStatusAndDetection)
  await checkGrokHomeRule()
  process.stdout.write('grok-build TUI seam verification passed.\n')
}

await main()
