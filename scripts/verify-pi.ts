import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MAX_BACKUPS } from '../src/core/constants.js'
import { backupsDirFor } from '../src/core/paths.js'
import { countBackups } from '../src/core/backup.js'
import { readConfigFile, renderConfigFile } from '../src/core/config-file.js'
import type { Ctx, FormValues } from '../src/types.js'
import { piDir, modelsFile, modelsPath, settingsPath } from '../src/agents/pi/paths.js'
import {
  emitProvider,
  loadProviders,
  modelWrites,
  saveProvider,
} from '../src/agents/pi/providers.js'
import { emitSettings, saveSettings, seedSettings } from '../src/agents/pi/settings.js'
import { buildStatus } from '../src/agents/pi/status.js'
import { detect } from '../src/agents/pi/index.js'
import { withHome } from './cli-harness.js'

/**
 * The pi TUI seam: the seed/emit/save functions the forms submit through, the
 * collection merge on models.json, the backup and permission guarantees, the
 * PI_CODING_AGENT_DIR rule, and the format-preservation corpus. Writes here go
 * through the same save* functions the TUI uses; the process seam lives in
 * verify-commands-pi.ts and the screen walk in verify-pi-screens.ts.
 */

const SECRET = 'sk-TEST-DO-NOT-USE-0123456789'

const MODELS_WITH_EXTRAS = `{
  // pi reads this file with comments stripped; ccset must keep them.
  "providers": {
    "router": {
      "baseUrl": "https://r.example/v1",
      "api": "anthropic-messages",
      "headers": { "x-custom": "keep" },
      "apiKey": "${SECRET}",
      "models": [
        { "id": "m1", "cost": { "input": 1, "output": 2, "cacheRead": 0, "cacheWrite": 0 } },
        { "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 } },
        { "id": "m2" }
      ]
    }
  }
}
`

async function writeModels(home: string, text: string): Promise<void> {
  const target = modelsPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text, { mode: 0o600 })
}

async function modelsOf(home: string): Promise<Record<string, any>> {
  const raw = await fs.readFile(modelsPath(home), 'utf8')
  const withoutLineComments = raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  return JSON.parse(withoutLineComments) as Record<string, any>
}

/** The form domain is strings; blanks mean the field was left empty. */
function valuesOf(input: Record<string, string | undefined>): FormValues {
  const values: FormValues = {}
  for (const [key, value] of Object.entries(input)) values[key] = value ?? ''
  return values
}

async function checkModelsMerge(home: string): Promise<void> {
  await writeModels(home, MODELS_WITH_EXTRAS)
  const ctx: Ctx = { home }
  await saveProvider(
    ctx,
    valuesOf({
      id: 'router',
      baseUrl: 'https://r.example/v1',
      api: 'anthropic-messages',
      apiKey: SECRET,
      models: 'm1, m3',
    }),
  )
  const raw = await fs.readFile(modelsPath(home), 'utf8')
  assert.match(raw, /comments stripped/, 'a comment was lost')
  const block = (await modelsOf(home))['providers']['router']
  assert.deepEqual(block['headers'], { 'x-custom': 'keep' }, 'unmanaged provider keys were lost')
  assert.equal(block['apiKey'], SECRET, 'the key was disturbed by an edit that resubmitted it')
  const withId = block['models'].filter((member: any) => typeof member['id'] === 'string')
  const byId = new Map<string, any>(withId.map((member: any) => [member['id'], member]))
  assert.equal(byId.size, 2, 'the models list did not follow the form')
  assert.equal(byId.get('m1')?.['cost']?.['input'], 1, 'a member lost its unmanaged cost')
  assert.equal(byId.get('m2'), undefined, 'a dropped model survived')
  assert.equal(byId.get('m3')?.['id'], 'm3', 'a new model was not added')
  const idless = block['models'].filter((member: any) => member['id'] === undefined)
  assert.equal(idless.length, 1, 'a member without an id was not passed through')
  // An unchanged save must not rewrite the models span at all.
  assert.deepEqual(modelWrites('router', ['m1', 'm3'], await modelsOf(home)), [], 'an unchanged list produced a write')
}

async function checkBlankOmitsKey(home: string): Promise<void> {
  await writeModels(
    home,
    '{\n  "providers": { "router": { "baseUrl": "https://r.example/v1", "api": "openai-completions", "apiKey": "old" } }\n}\n',
  )
  const ctx: Ctx = { home }
  await saveProvider(ctx, valuesOf({ id: 'router', baseUrl: 'https://r.example/v2' }))
  const block = (await modelsOf(home))['providers']['router']
  assert.equal(block['baseUrl'], 'https://r.example/v2')
  assert.equal('api' in block, false, 'a blank choice wrote a value instead of omitting the key')
  assert.equal('apiKey' in block, false, 'a blank secret wrote a value instead of omitting the key')
  assert.equal('models' in block, false, 'a blank list wrote a key')
  for (const write of emitProvider(valuesOf({ id: 'r', baseUrl: '', api: '', apiKey: '', models: '' }), {})) {
    assert.equal(write.value, undefined, 'a blank field produced a concrete value')
  }
}

/**
 * A form opened before pi edited its own file: the save re-reads the target,
 * so the newcomer survives alongside the managed edit.
 */
async function checkExternalEditBetweenOpenAndSave(home: string): Promise<void> {
  const ctx: Ctx = { home }
  await writeModels(
    home,
    '{\n  "providers": { "router": { "baseUrl": "https://r.example/v1", "api": "openai-completions", "apiKey": "k-0123456789", "models": [ { "id": "m1" } ] } }\n}\n',
  )
  const opened = await loadProviders(ctx)
  assert.equal(opened.records[0]?.baseUrl, 'https://r.example/v1', 'the form view did not seed')
  await writeModels(
    home,
    '{\n  "providers": { "router": { "baseUrl": "https://r.example/v1", "api": "openai-completions", "apiKey": "k-0123456789", "headers": { "x-newcomer": "keep" }, "models": [ { "id": "m1" } ] } }\n}\n',
  )
  await saveProvider(
    ctx,
    valuesOf({ id: 'router', baseUrl: 'https://n.example/v1', api: 'openai-completions', apiKey: 'k-0123456789', models: 'm1' }),
  )
  const block = (await modelsOf(home))['providers']['router']
  assert.equal(block['baseUrl'], 'https://n.example/v1', 'the form edit did not land')
  assert.deepEqual(block['headers'], { 'x-newcomer': 'keep' }, 'a change made after the form opened was clobbered')
}

/**
 * The format-preservation corpus for models.json: an empty write list and a
 * same-value managed write must both leave every byte alone -- comments, CRLF
 * line endings, key order and member formatting included.
 */
async function checkModelsJsonCorpus(home: string): Promise<void> {
  const corpus = [
    '{\r\n',
    '  // header comment\r\n',
    '  "providers": {\r\n',
    '    /* block comment */ "router": {\r\n',
    '      "apiKey": "k-0123456789",\r\n',
    '      "baseUrl": "https://r.example/v1", // trailing\r\n',
    '      "models": [ { "id": "m1", "cost": { "input": 1 } } ]\r\n',
    '    }\r\n',
    '  }\r\n',
    '}\r\n',
  ].join('')
  await writeModels(home, corpus)
  const file = modelsFile(home)
  const base = await readConfigFile(file)
  const providers = base.data['providers'] as Record<string, any>
  assert.equal(providers['router']['baseUrl'], 'https://r.example/v1', 'the corpus did not parse')
  assert.equal(renderConfigFile(file, base, []), corpus, 'an empty write list disturbed the bytes')
  const sameValue = renderConfigFile(file, base, [
    { path: ['providers', 'router', 'baseUrl'], value: 'https://r.example/v1' },
  ])
  assert.equal(sameValue, corpus, 'a same-value write disturbed the bytes')
}

async function checkSettings(home: string): Promise<void> {
  const ctx: Ctx = { home }
  const settings = settingsPath(home)
  await fs.mkdir(path.dirname(settings), { recursive: true })
  await fs.writeFile(settings, '{\n  "theme": "dark",\n  "quietStartup": true\n}\n', { mode: 0o600 })
  await saveSettings(
    ctx,
    valuesOf({ defaultProvider: 'router', defaultModel: 'm1', defaultThinkingLevel: 'high' }),
  )
  const config = JSON.parse(await fs.readFile(settings, 'utf8')) as Record<string, any>
  assert.equal(config['theme'], 'dark', 'an unmanaged settings key was lost')
  assert.equal(config['quietStartup'], true)
  assert.equal(config['defaultProvider'], 'router')
  assert.equal(config['defaultModel'], 'm1')
  assert.equal(config['defaultThinkingLevel'], 'high')
  await saveSettings(ctx, valuesOf({ defaultProvider: '', defaultModel: '', defaultThinkingLevel: '' }))
  const cleared = JSON.parse(await fs.readFile(settings, 'utf8')) as Record<string, any>
  assert.equal('defaultProvider' in cleared, false, 'a blank settings field kept its key')
  assert.deepEqual(emitSettings(valuesOf({ defaultThinkingLevel: '' }))[0]?.value, undefined)
  assert.equal(Object.keys(seedSettings({})).length, 3, 'the settings seed drifted')
}

async function checkBackupsAndModes(home: string): Promise<void> {
  const ctx: Ctx = { home }
  await writeModels(home, '{\n  "providers": {}\n}\n')
  for (let round = 0; round < MAX_BACKUPS + 3; round += 1) {
    await saveProvider(
      ctx,
      valuesOf({ id: 'router', baseUrl: `https://r${round}.example/v1`, api: 'openai-completions', models: 'm1' }),
    )
  }
  const backups = backupsDirFor(piDir(home))
  assert.equal(await countBackups(backups), MAX_BACKUPS, 'backups did not rotate to MAX_BACKUPS')
  const names = (await fs.readdir(backups)).sort()
  const first = names[0]
  assert.ok(first, 'no backups were written')
  assert.match(await fs.readFile(path.join(backups, first), 'utf8'), /"providers"/, 'a backup lost the original bytes')
  assert.equal((await fs.stat(modelsPath(home))).mode & 0o777, 0o600, 'the target was not 0600')
  for (const name of names) {
    assert.equal((await fs.stat(path.join(backups, name))).mode & 0o777, 0o600, `backup ${name} was not 0600`)
  }
}

async function checkStatusAndDetection(home: string): Promise<void> {
  const ctx: Ctx = { home }
  assert.equal(await detect(ctx), false, 'an empty home was detected as pi')
  await writeModels(home, MODELS_WITH_EXTRAS)
  await fs.mkdir(piDir(home), { recursive: true })
  await fs.writeFile(path.join(piDir(home), 'auth.json'), '{"anthropic":{"type":"api_key","key":"k"}}', {
    mode: 0o600,
  })
  assert.equal(await detect(ctx), true, 'a populated home was not detected')
  const before = await fs.readFile(modelsPath(home), 'utf8')
  const painted = JSON.stringify((await buildStatus(ctx)).sections)
  assert.equal(painted.includes(SECRET), false, 'status leaked the provider key')
  assert.ok(painted.includes('••'), 'status did not mask the provider key')
  assert.ok(painted.includes('auth.json'), 'status did not name the unmanaged auth file')
  const providers = await loadProviders(ctx)
  assert.equal(providers.records[0]?.models.join(','), 'm1,m2', 'status mis-read the model ids')
  assert.equal(await fs.readFile(modelsPath(home), 'utf8'), before, 'status wrote to models.json')
  const leftovers = await fs.readdir(backupsDirFor(piDir(home))).catch(() => [] as string[])
  assert.equal(leftovers.length, 0, 'status created backups')
}

async function checkAgentDirRule(): Promise<void> {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-pi-dir-'))
  try {
    process.env['PI_CODING_AGENT_DIR'] = '/tmp/ccset-pi-override'
    assert.equal(piDir(scratch), path.join(scratch, '.pi', 'agent'), 'a scratch home followed the override')
    assert.equal(piDir(os.homedir()), '/tmp/ccset-pi-override', 'the real home ignored the override')
    delete process.env['PI_CODING_AGENT_DIR']
    assert.equal(piDir(os.homedir()), path.join(os.homedir(), '.pi', 'agent'), 'the default dir drifted')
  } finally {
    delete process.env['PI_CODING_AGENT_DIR']
    await fs.rm(scratch, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  await withHome('models-merge', checkModelsMerge)
  await withHome('blank-omits', checkBlankOmitsKey)
  await withHome('external-edit', checkExternalEditBetweenOpenAndSave)
  await withHome('corpus', checkModelsJsonCorpus)
  await withHome('settings', checkSettings)
  await withHome('backups', checkBackupsAndModes)
  await withHome('status', checkStatusAndDetection)
  await checkAgentDirRule()
  process.stdout.write('pi TUI seam verification passed.\n')
}

await main()
