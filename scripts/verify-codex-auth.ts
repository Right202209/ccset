import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  activateAuthProfile,
  listAuthProfiles,
  loadAuthState,
  removeAuthProfile,
} from '../src/agents/codex/auth.js'
import { codexActions } from '../src/agents/codex/actions.js'
import { codexMessages } from '../src/agents/codex/messages.js'
import { authProfilePath, codexAuthPath } from '../src/agents/codex/paths.js'
import { buildStatus } from '../src/agents/codex/status.js'
import { saveProvider } from '../src/agents/codex/providers.js'
import { en } from '../src/i18n/en.js'
import { hasKey } from '../src/i18n/index.js'
// Importing the registry is what merges each agent's messages into the
// catalog. Without it every codex.* key would resolve to itself here and the
// walk below would report the whole module as missing.
import '../src/registry.js'
import type { ActionResult, Ctx, FormValues, JsonObject, ListItem } from '../src/types.js'

/**
 * C6-C8 plus the screen walk. Runs inside verify:codex, like verify-toml-codec,
 * so that neither file has to be trimmed to stay inside the 300-line limit.
 *
 * The credential half is what no other agent has: Codex keeps its key outside
 * the settings document, so ccset writes two files and switches between saved
 * ones. Getting that wrong loses a login rather than a setting.
 */

const OTHER_KEY = 'CODEX-OTHER-KEY-0987654321'

async function assertMode600(filePath: string): Promise<void> {
  if (process.platform === 'win32') return
  assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600)
}

/** C6: the key lands in a 0600 sidecar and never in config.toml. */
export async function verifyKeyStaysOutOfConfig(
  home: string,
  configPath: string,
  apiKey: string,
): Promise<void> {
  const raw = await fs.readFile(configPath, 'utf8')
  assert.equal(raw.includes(apiKey), false, 'C6: the API key was written into config.toml')

  const profilePath = authProfilePath(home, 'router')
  const profile = JSON.parse(await fs.readFile(profilePath, 'utf8')) as JsonObject
  assert.equal(profile['OPENAI_API_KEY'], apiKey, 'C6: the key was not saved to its sidecar')
  assert.equal(profile['auth_mode'], 'apikey', 'C6: auth_mode was not set')
  await assertMode600(profilePath)
}

/** C7: switching copies the sidecar over auth.json and keeps what was there. */
export async function verifySwitch(home: string, apiKey: string): Promise<void> {
  const authPath = codexAuthPath(home)
  const chatgpt = `${JSON.stringify({ auth_mode: 'chatgpt', tokens: { id_token: 'oauth' } }, null, 2)}\n`
  await fs.writeFile(authPath, chatgpt, { mode: 0o600 })

  const before = await loadAuthState({ home })
  assert.equal(before.activeName, null, 'C7: an unsaved live credential matched a profile')

  const report = await activateAuthProfile({ home }, 'router', 'chatgpt-personal')
  assert.notEqual(report.backupPath, null, 'C7: the replaced credential was not backed up')
  assert.equal(
    await fs.readFile(authProfilePath(home, 'chatgpt-personal'), 'utf8'),
    chatgpt,
    'C7: the adopted profile is not a byte copy of the credential it replaced',
  )

  const live = JSON.parse(await fs.readFile(authPath, 'utf8')) as JsonObject
  assert.equal(live['OPENAI_API_KEY'], apiKey, 'C7: auth.json does not hold the chosen key')
  await assertMode600(authPath)

  const after = await loadAuthState({ home })
  assert.equal(after.activeName, 'router', 'C7: the live file did not match its own profile')
  assert.deepEqual(
    after.profiles.map((profile) => profile.name).sort(),
    ['chatgpt-personal', 'router'],
    'C7: profile discovery missed a sidecar',
  )
  assert.equal(
    after.profiles.some((profile) => profile.name === 'json'),
    false,
    'C7: auth.json itself was listed as a switchable profile',
  )
}

/** C8: a removed credential is gone; the provider block is not. */
export async function verifyRemoveProfile(
  home: string,
  values: (id: string, extra?: FormValues) => FormValues,
  readConfig: (home: string) => Promise<JsonObject>,
): Promise<void> {
  await saveProvider({ home }, values('spare', { apiKey: OTHER_KEY }))
  assert.equal(await removeAuthProfile({ home }, 'spare'), true)
  assert.equal(await removeAuthProfile({ home }, 'spare'), false, 'C8: a second remove did work')

  const names = (await listAuthProfiles({ home })).map((profile) => profile.name)
  assert.equal(names.includes('spare'), false, 'C8: the sidecar survived')
  const providers = (await readConfig(home))['model_providers'] as JsonObject
  assert.ok('spare' in providers, 'C8: removing a credential removed the provider block')
}

/**
 * CODEX_HOME points Codex at a different directory. ccset reports it rather
 * than following it: a variable inherited from the surrounding shell would take
 * a scratch run's writes straight out of its scratch home.
 */
export async function verifyHomeOverrideIsReported(
  home: string,
  save: () => Promise<unknown>,
): Promise<void> {
  const elsewhere = path.join(home, 'elsewhere')
  const previous = process.env['CODEX_HOME']
  process.env['CODEX_HOME'] = elsewhere
  try {
    const status = await buildStatus({ home })
    assert.equal(status.homeOverride, elsewhere, 'CODEX_HOME went unreported')
    assert.ok(
      JSON.stringify(status.sections).includes('CODEX_HOME'),
      'Status did not name the CODEX_HOME override',
    )
    await save()
  } finally {
    if (previous === undefined) delete process.env['CODEX_HOME']
    else process.env['CODEX_HOME'] = previous
  }
  await fs.access(elsewhere).then(
    () => assert.fail('ccset followed CODEX_HOME and wrote outside the home it was given'),
    () => undefined,
  )
}

/* ------------------------------------------------------- the screen walk */
/**
 * t() returns the key itself on a miss, so a string ccset paints that is
 * shaped like one of its own keys and is not in the catalog is an unresolved
 * key -- a label the user would read as `codex.field.apiKey`. Keys reached
 * indirectly (labelKey, helpKey, detailKey, a choice's labelKey) are checked
 * against the catalog directly, since a grep for t('...') cannot see them.
 */
const PREFIXES = new Set(
  [...Object.keys(en), ...Object.keys(codexMessages['en'] ?? {})].map((key) => key.split('.')[0]),
)
const KEY_SHAPE = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+$/

function assertResolved(text: string, where: string): void {
  if (!KEY_SHAPE.test(text)) return
  const prefix = text.split('.')[0] ?? ''
  if (!PREFIXES.has(prefix)) return
  assert.ok(hasKey(text), `An i18n key was painted unresolved at ${where}: ${text}`)
}

function assertKeyExists(key: string | undefined, where: string): void {
  if (key === undefined) return
  assert.ok(hasKey(key), `A screen references a missing i18n key at ${where}: ${key}`)
}

function walkForm(screen: Extract<ActionResult, { kind: 'form' }>, where: string): void {
  for (const field of screen.fields) {
    assertKeyExists(field.labelKey, `${where}/${field.id}.labelKey`)
    assertKeyExists(field.helpKey, `${where}/${field.id}.helpKey`)
    for (const choice of field.choices ?? []) {
      assertKeyExists(choice.labelKey, `${where}/${field.id}.choice`)
    }
  }
  for (const note of screen.notes ?? []) assertResolved(note, `${where}/note`)
}

function walkStatus(screen: Extract<ActionResult, { kind: 'status' }>, where: string): void {
  for (const section of screen.sections) {
    assertResolved(section.title, `${where}/section`)
    if (section.note !== undefined) assertResolved(section.note, `${where}/note`)
    for (const line of section.lines) {
      assertResolved(line.label, `${where}/label`)
      assertResolved(line.value, `${where}/value`)
    }
  }
}

function itemsOf(screen: ActionResult): ListItem[] {
  if (screen.kind === 'list' || screen.kind === 'status') return screen.items
  return []
}

function inspect(screen: ActionResult, where: string): void {
  assertResolved(screen.title, `${where}/title`)
  if (screen.kind === 'form') walkForm(screen, where)
  if (screen.kind === 'status') walkStatus(screen, where)
  if (screen.kind === 'message' || screen.kind === 'confirm') {
    for (const line of screen.lines) assertResolved(line, `${where}/line`)
  }
  if (screen.kind === 'confirm') assertResolved(screen.confirmLabel, `${where}/confirmLabel`)
  for (const item of itemsOf(screen)) {
    assertResolved(item.label, `${where}/${item.id}.label`)
    if (item.detail !== undefined) assertResolved(item.detail, `${where}/${item.id}.detail`)
  }
}

/**
 * Only `run()` is called. A confirm's `confirm()` and a form's `submit()` are
 * the writes; producing the screen that offers them is read-only, which is what
 * makes walking the whole menu safe against a populated scratch home.
 */
async function descend(screen: ActionResult, where: string, depth: number): Promise<void> {
  inspect(screen, where)
  if (depth === 0) return
  for (const item of itemsOf(screen)) {
    await descend(await item.run(), `${where}/${item.id}`, depth - 1)
  }
}

const WALK_DEPTH = 3

export async function verifyCodexScreens(ctx: Ctx): Promise<void> {
  for (const action of codexActions()) {
    assertKeyExists(action.labelKey, `${action.id}.labelKey`)
    assertKeyExists(action.detailKey ?? `${action.labelKey}Detail`, `${action.id}.detailKey`)
    await descend(await action.run(ctx), action.id, WALK_DEPTH)
  }
}

/** Backups live beside the files they came from, so they are found by name. */
export async function backupNames(dir: string, basename: string, infix: string): Promise<string[]> {
  const names = await fs.readdir(dir)
  return names.filter((name) => name.startsWith(`${path.basename(basename)}${infix}`))
}
