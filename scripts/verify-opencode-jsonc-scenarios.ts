import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import '../src/registry.js'
import { saveGlobal } from '../src/agents/opencode/global.js'
import { loadProviders, saveProvider, seedProvider } from '../src/agents/opencode/providers.js'
import { buildStatus } from '../src/agents/opencode/status.js'
import { backupsDir, opencodeConfigPath, opencodeJsoncPath } from '../src/agents/opencode/paths.js'
import { BACKUP_INFIX } from '../src/core/constants.js'
import { findJsoncProblem, readJsoncObject } from '../src/core/jsonc/index.js'
import { maskSecret } from '../src/core/mask.js'
import { runSave } from '../src/core/save.js'
import type { FormValues, JsonObject } from '../src/types.js'

/**
 * The O-gates for a managed `.jsonc` (issue #46): O7 revised, plus the three
 * new gates the spec asks for. Each makes its own scratch home, so the caller
 * needs no plumbing; the codec's own byte-level guarantee lives in
 * verify-opencode-jsonc.ts, which runs inside this same gate. The registry is
 * imported for its side effect, so the agent's keys resolve through t().
 */

/** Builds the form values one provider save starts from; the runner owns it. */
type ProviderValuesFactory = (id: string, models: string, extra?: FormValues) => FormValues

function globalValues(): FormValues {
  return {
    model: 'router/fresh',
    smallModel: '',
    share: '',
    autoupdate: '',
    username: '',
    disabledProviders: '',
  }
}

async function newHome(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ccset-opencode-jsonc-'))
}

/** The managed `.jsonc` a user hand-wrote, comments and all. */
const JSONC_DOC = `{
  // router routing
  "$schema": "https://opencode.ai/config.json",
  "theme": "gruvbox",
  "provider": {
    "router": {
      // unmanaged sibling below
      "options": {
        "baseURL": "https://old.example",
        "headers": { "x-custom": "keep" }
      },
      "models": {
        "model-keep": { "options": { "temperature": 0.2 } }
      }
    }
  },
}
`

/**
 * The bytes ccset does not own are the comment lines and the unmanaged values.
 * They must appear verbatim after a save, and the document must stay sound.
 * (Byte-level survival of attached comments is the corpus gate's job; the
 * fixture's comments are standalone lines, matched here as whole lines.)
 */
function assertUnmanagedSurvive(before: string, after: string, gate: string): void {
  for (const line of before.split('\n').filter((line) => line.trimStart().startsWith('//'))) {
    assert.equal(after.includes(line), true, `${gate}: lost unmanaged bytes: ${line}`)
  }
  assert.equal(findJsoncProblem(after), null, `${gate}: the saved .jsonc no longer parses`)
}

function routerBlock(config: JsonObject): JsonObject {
  const provider = config['provider'] as JsonObject
  return provider['router'] as JsonObject
}

/** O7: with a `.jsonc` present, ccset writes it in place and leaves the `.json`
 *  byte-identical, and Status names each file's role. */
async function verifyJsoncIsManaged(
  providerValues: ProviderValuesFactory,
  apiKey: string,
): Promise<void> {
  const home = await newHome()
  try {
    const jsonc = opencodeJsoncPath(home)
    const json = opencodeConfigPath(home)
    await fs.mkdir(path.dirname(json), { recursive: true })
    await fs.writeFile(jsonc, JSONC_DOC, { mode: 0o600 })
    await fs.writeFile(json, '{\n  "theme": "tokyonight"\n}\n', { mode: 0o600 })

    await saveProvider({ home }, providerValues('router', 'model-keep, model-new'))

    const after = await fs.readFile(jsonc, 'utf8')
    assertUnmanagedSurvive(JSONC_DOC, after, 'O7')
    const config = readJsoncObject(after)
    assert.equal(config['theme'], 'gruvbox', 'O7: an unmanaged key was lost')
    const block = routerBlock(config)
    assert.deepEqual(block['options'], {
      baseURL: 'https://router.example/v1',
      apiKey: apiKey,
      headers: { 'x-custom': 'keep' },
    }, 'O7: the managed block was not written as proposed')
    assert.deepEqual(block['models'], {
      'model-keep': { options: { temperature: 0.2 } },
      'model-new': {},
    }, 'O7: the models map did not merge per key')
    assert.equal(await fs.readFile(json, 'utf8'), '{\n  "theme": "tokyonight"\n}\n', 'O7: the legacy .json was rewritten')

    const status = await buildStatus({ home })
    assert.equal(status.legacyJsonPresent, true, 'O7: the legacy .json was not reported')
    const rendered = JSON.stringify(status.sections)
    assert.equal(rendered.includes(opencodeJsoncPath(home)), true, 'O7: Status did not name the managed .jsonc')
    assert.equal(rendered.includes('opencode.json (not managed)'), true, 'O7: Status did not name the legacy .json role')
    assert.equal(rendered.includes(apiKey), false, 'O7: Status leaked the API key')
    assert.equal(rendered.includes(maskSecret(apiKey)), true, 'O7: Status did not mask the key')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

/** O8: only the `.json` exists -- everything is as it was before this change. */
async function verifyJsonOnlyUnchanged(): Promise<void> {
  const home = await newHome()
  try {
    const json = opencodeConfigPath(home)
    await fs.mkdir(path.dirname(json), { recursive: true })
    await fs.writeFile(
      json,
      `${JSON.stringify({ theme: 'tokyonight', provider: { router: {} } }, null, 2)}\n`,
      { mode: 0o600 },
    )

    await saveGlobal(
      { home },
      { model: 'router/x', smallModel: '', share: '', autoupdate: 'false', username: '', disabledProviders: '' },
    )

    const config = JSON.parse(await fs.readFile(json, 'utf8')) as JsonObject
    assert.equal(config['theme'], 'tokyonight', 'O8: an unmanaged key was lost')
    assert.equal(config['autoupdate'], false, 'O8: autoupdate was not a JSON boolean')
    const jsoncCreated = await fs.readFile(opencodeJsoncPath(home), 'utf8').then(() => true, () => false)
    assert.equal(jsoncCreated, false, 'O8: ccset created a .jsonc')

    const status = await buildStatus({ home })
    assert.equal(status.legacyJsonPresent, false, 'O8: a not-managed section appeared with no .jsonc')
    const rendered = JSON.stringify(status.sections)
    assert.equal(rendered.includes('not managed'), false, 'O8: Status invented a not-managed file')
    assert.equal(rendered.includes(opencodeConfigPath(home)), true, 'O8: Status did not name the managed .json')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

/** O9: the round trip -- values seeded from a `.jsonc` read back correctly
 *  after a save, and every comment written before the save survives it. */
async function verifyJsoncRoundTrip(
  providerValues: ProviderValuesFactory,
  apiKey: string,
): Promise<void> {
  const home = await newHome()
  try {
    const jsonc = opencodeJsoncPath(home)
    await fs.mkdir(path.dirname(jsonc), { recursive: true })
    await fs.writeFile(jsonc, JSONC_DOC, { mode: 0o600 })

    const list = await loadProviders({ home })
    const before = list.records.find((record) => record.id === 'router')
    assert.equal(before?.baseUrl, 'https://old.example', 'O9: seeding read the wrong value')

    await saveProvider({ home }, providerValues('router', 'model-keep', { timeout: '4000' }))

    const after = await fs.readFile(jsonc, 'utf8')
    assertUnmanagedSurvive(JSONC_DOC, after, 'O9')
    const block = routerBlock(readJsoncObject(after))
    assert.equal((block['options'] as JsonObject)['baseURL'], 'https://router.example/v1', 'O9: the saved value did not land')
    assert.equal((block['options'] as JsonObject)['timeout'], 4000, 'O9: an int field was not written as a number')

    const seed = seedProvider(readJsoncObject(after), 'router')
    assert.equal(seed['apiKey'], apiKey, 'O9: the saved key did not seed back')
    assert.equal(seed['baseUrl'], 'https://router.example/v1', 'O9: the saved URL did not seed back')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

/** O10: a `.jsonc` that fails the syntax pass reaches the start-fresh confirm,
 *  and the unreadable original survives in the backup. */
async function verifyJsoncMalformedConfirm(): Promise<void> {
  const home = await newHome()
  try {
    const jsonc = opencodeJsoncPath(home)
    await fs.mkdir(path.dirname(jsonc), { recursive: true })
    const broken = '{\n  "model": "x",\n  "autoupdate": ,\n}\n'
    await fs.writeFile(jsonc, broken, { mode: 0o600 })

    const screen = await runSave(
      'write.globalSaved',
      (fresh) => saveGlobal({ home }, globalValues(), fresh),
      'busy',
    )
    assert.equal(screen.kind, 'confirm', 'O10: a malformed .jsonc did not reach the confirm')
    if (screen.kind !== 'confirm') return
    assert.equal(screen.lines.join('\n').includes(opencodeJsoncPath(home)), true, 'O10: the confirm did not name the file')

    await screen.confirm()

    const config = JSON.parse(await fs.readFile(jsonc, 'utf8')) as JsonObject
    assert.equal(config['model'], 'router/fresh', 'O10: the fresh document did not hold the form values')
    const backups = await fs.readdir(backupsDir(home))
    const kept = backups.filter((name) => name.startsWith(`opencode.jsonc${BACKUP_INFIX}`))
    assert.equal(kept.length, 1, 'O10: the broken original was not backed up exactly once')
    const backupPath = path.join(backupsDir(home), kept[0] ?? '')
    assert.equal(await fs.readFile(backupPath, 'utf8'), broken, 'O10: the backup did not hold the broken original')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

/** A malformed managed file reports on the list instead of throwing (a shape
 *  the .json target already had; the .jsonc must behave the same). */
async function verifyJsoncMalformedList(): Promise<void> {
  const home = await newHome()
  try {
    const jsonc = opencodeJsoncPath(home)
    await fs.mkdir(path.dirname(jsonc), { recursive: true })
    await fs.writeFile(jsonc, '{ not jsonc', { mode: 0o600 })
    const list = await loadProviders({ home })
    assert.equal(list.parsed, false, 'a malformed .jsonc parsed')
    assert.equal(list.path, jsonc, 'the list did not name the managed target')
    assert.equal(list.problemKey, 'status.parseError', 'the list did not report a parse error')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

export async function verifyJsoncScenarios(
  providerValues: ProviderValuesFactory,
  apiKey: string,
): Promise<void> {
  await verifyJsoncIsManaged(providerValues, apiKey)
  await verifyJsonOnlyUnchanged()
  await verifyJsoncRoundTrip(providerValues, apiKey)
  await verifyJsoncMalformedConfirm()
  await verifyJsoncMalformedList()
}
