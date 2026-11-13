import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Action, ActionResult, Ctx, FormScreen, ListItem } from '../src/types.js'
import '../src/registry.js'
import { t } from '../src/i18n/index.js'
import { readIgnoredProviders, setProviderIgnored } from '../src/core/settings.js'
import { providerSettingsPath } from '../src/agents/claude-code/paths.js'
import { openProviders as openClaudeList } from '../src/agents/claude-code/provider-actions.js'
import { opencodeTarget } from '../src/agents/opencode/paths.js'
import { opencodeActions } from '../src/agents/opencode/actions.js'
import { modelsFile } from '../src/agents/pi/paths.js'
import { piActions } from '../src/agents/pi/actions.js'
import { configFile as grokConfigFile } from '../src/agents/grok-build/paths.js'
import { grokBuildActions } from '../src/agents/grok-build/actions.js'
import { codexConfigPath } from '../src/agents/codex/paths.js'
import { codexActions } from '../src/agents/codex/actions.js'
import { UNICODE_TERMINAL } from '../src/ui/terminal.js'
import { ENTER, UP, UiSession } from './ui-session.js'

/**
 * The provider Screens walked as the interface reaches them, for the checks
 * `verify:provider-management` makes on what the user is shown rather than on
 * the files: an ignored provider is hidden, a deleted one is gone from the
 * interface as well as from the disk, and an Edit form shows the file as it is.
 * Not a fixture of its own: it runs inside `verify:provider-management`.
 */

export const ACME = 'acme'
export const OTHER = 'other'

const OLD_TOKEN = 'sk-TEST-DO-NOT-USE-before'
const NEW_TOKEN = 'sk-TEST-DO-NOT-USE-rotated'

/** Row numbers as the Screens print them (PRD 5.4). */
const MENU_PROVIDERS = '2'
const LIST_ACME_ROW = '2'
const MANAGE_DELETE_ROW = '3'

export async function write(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, contents, { mode: 0o600 })
}

export function listOf(screen: ActionResult, where: string): ListItem[] {
  assert.equal(screen.kind, 'list', `${where} is not a list screen`)
  return screen.kind === 'list' ? screen.items : []
}

export function itemById(items: ListItem[], id: string): ListItem {
  const found = items.find((item) => item.id === id)
  assert.ok(found !== undefined, `no item ${id} among ${items.map((item) => item.id).join(', ')}`)
  return found
}

/** The providers entry of an Agent's menu, exactly as the interface reaches it. */
async function providersAction(actions: Action[], ctx: Ctx): Promise<ActionResult> {
  const action = actions.find((candidate) => candidate.id === 'providers')
  assert.ok(action !== undefined, 'the agent has no providers action')
  return action.run(ctx)
}

/**
 * Confirms the delete on a provider's own Screen. Its outcome has to close the
 * Screen it was confirmed from: that Screen has no provider left to edit,
 * ignore or delete.
 */
export async function confirmDelete(manage: ListItem[], where: string): Promise<void> {
  const confirm = await itemById(manage, 'delete').run()
  assert.equal(confirm.kind, 'confirm', `${where}: delete did not ask first`)
  if (confirm.kind !== 'confirm') return
  const outcome = await confirm.confirm()
  assert.equal(outcome.kind, 'message', `${where}: the delete did not end on a message`)
  assert.equal(
    outcome.kind === 'message' && outcome.closesOrigin === true,
    true,
    `${where}: the delete's outcome leaves the deleted provider's Screen open`,
  )
}

/* ------------------------------------------- Claude Code: the Edit form */

const claudeDoc = (token: string): string =>
  `${JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'https://acme.example', ANTHROPIC_AUTH_TOKEN: token }, model: 'first-model' }, null, 2)}\n`

/** Opens a provider's own Screen from its list row and takes the Edit entry. */
async function editForm(row: ListItem): Promise<FormScreen> {
  const manage = listOf(await row.run(), 'the provider screen')
  const form = await itemById(manage, 'edit').run()
  if (form.kind !== 'form') assert.fail('Edit did not open a form')
  return form
}

/**
 * The provider's own Screen outlives the saves made from it, and the interface
 * re-runs its list row on the way back from each one. The Edit form has to be
 * seeded from the file as it is then. Seeded from the record the list was built
 * with, a second save wrote every managed field back as it was before the first
 * -- a rotated token included -- and a provider deleted meanwhile came back
 * with its credential.
 */
export async function verifyClaudeEditReadsTheFileAgain(ctx: Ctx): Promise<void> {
  const file = providerSettingsPath(ctx.home, ACME)
  await write(file, claudeDoc(OLD_TOKEN))
  const row = itemById(listOf(await openClaudeList(ctx), 'the provider list'), ACME)
  const first = await editForm(row)
  await first.submit({ ...first.values, token: NEW_TOKEN })
  assert.equal((await fs.readFile(file, 'utf8')).includes(NEW_TOKEN), true, 'the first save did not write the new token')

  const second = await editForm(row)
  assert.equal(second.values['token'], NEW_TOKEN, 'the Edit form was seeded from before the last save')
  await second.submit({ ...second.values, model: 'second-model' })
  const saved = await fs.readFile(file, 'utf8')
  assert.equal(saved.includes(NEW_TOKEN), true, 'a later edit wrote the token from before the rotation back')
  assert.equal(saved.includes(OLD_TOKEN), false, 'a later edit restored the rotated token')

  await fs.rm(file)
  const gone = await editForm(row)
  const seeded = Object.values(gone.values)
  for (const token of [OLD_TOKEN, NEW_TOKEN]) {
    assert.equal(seeded.includes(token), false, 'a provider that is gone still seeds its Edit form with a credential')
  }
}

/* ------------------------------------------------ the other Agents' lists */

interface AgentCase {
  agent: string
  seed: string
  doc: string
  actions: Action[]
}

async function otherAgents(home: string): Promise<AgentCase[]> {
  return [
    {
      agent: 'opencode',
      seed: (await opencodeTarget(home)).path,
      doc: '{"provider":{"acme":{"options":{"baseURL":"https://acme.example"}}}}\n',
      actions: opencodeActions(),
    },
    {
      agent: 'pi',
      seed: modelsFile(home).path,
      doc: '{"providers":{"acme":{"baseUrl":"https://acme.example"}}}\n',
      actions: piActions(),
    },
    {
      agent: 'grok-build',
      seed: grokConfigFile(home).path,
      doc: '[model.acme]\nbase_url = "https://acme.example"\n',
      actions: grokBuildActions(),
    },
    {
      agent: 'codex',
      seed: codexConfigPath(home),
      doc: '[model_providers.acme]\nbase_url = "https://acme.example"\n',
      actions: codexActions(),
    },
  ]
}

/**
 * An ignored provider is hidden until it is revealed, and deleting it takes its
 * ignore note along: the note describes a provider that no longer exists, and
 * kept, it would hide the next provider saved under that name.
 */
export async function verifyOtherAgentsIgnoreAndDelete(home: string): Promise<void> {
  const ctx: Ctx = { home }
  for (const entry of await otherAgents(home)) {
    await write(entry.seed, entry.doc)
    await setProviderIgnored(home, entry.agent, ACME, true)
    const hidden = listOf(await providersAction(entry.actions, ctx), `${entry.agent}'s provider list`)
    const ids = hidden.map((item) => item.id)
    assert.equal(ids.includes(ACME), false, `${entry.agent} still offers an ignored provider`)
    assert.equal(ids.includes('__ignored__'), true, `${entry.agent} has no way back to an ignored provider`)

    const revealed = listOf(await itemById(hidden, '__ignored__').run(), `${entry.agent}'s revealed list`)
    const manage = listOf(await itemById(revealed, ACME).run(), `${entry.agent}'s provider screen`)
    await confirmDelete(manage, entry.agent)
    assert.equal((await fs.readFile(entry.seed, 'utf8')).includes('acme.example'), false, `${entry.agent} kept the deleted provider`)
    assert.deepEqual(await readIgnoredProviders(home, entry.agent), [], `${entry.agent} kept the ignore note of a deleted provider`)
    const after = listOf(await providersAction(entry.actions, ctx), `${entry.agent}'s list after the delete`)
    assert.equal(after.some((item) => item.id === ACME || item.id === '__ignored__'), false, `${entry.agent} still shows a trace of the deleted provider`)
  }
}

/* ------------------------------------------------------ the rendered drive */

/**
 * Leaving the "Provider deleted" message has to land on the provider list. It
 * used to land on the deleted provider's own Screen, whose Edit form still held
 * the values read before the delete -- the credential among them -- and saving
 * it wrote the file back.
 */
export async function verifyDeleteReturnsToTheList(home: string): Promise<void> {
  const acme = providerSettingsPath(home, ACME)
  await write(acme, `${JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'https://acme.example', ANTHROPIC_AUTH_TOKEN: 'sk-TEST-DO-NOT-USE-acme' } }, null, 2)}\n`)
  await write(providerSettingsPath(home, OTHER), `${JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'https://other.example' } }, null, 2)}\n`)
  const session = new UiSession(home, UNICODE_TERMINAL, { agentId: 'claude-code' })
  try {
    await session.waitFor(t('action.testDetail'))
    await session.send(MENU_PROVIDERS)
    await session.waitFor('https://acme.example')
    await session.send(LIST_ACME_ROW)
    await session.waitFor(t('action.providerDelete'))
    await session.send(MANAGE_DELETE_ROW)
    await session.waitFor(t('confirm.delete'))
    // The confirm opens on Cancel; the destructive row is the one above it.
    await session.send(UP)
    await session.send(ENTER)
    await session.waitFor(t('write.providerDeleted'))
    assert.equal(await fs.access(acme).then(() => true, () => false), false, 'the confirmed delete did not delete')
    await session.send(ENTER)
    const paint = await session.waitFor(session.focusedRow('1.'))
    const ghost = t('action.providerEdit', { name: ACME })
    assert.equal(paint.includes(ghost), false, `Leaving the delete message reopened the deleted provider's Screen:\n${paint}`)
    assert.equal(paint.includes(t('action.providerAdd')), true, `Leaving the delete message did not land on the provider list:\n${paint}`)
    assert.equal(paint.includes('https://other.example'), true, `The provider list lost the sibling provider:\n${paint}`)
    assert.equal(paint.includes('https://acme.example'), false, `The provider list still offers the deleted provider:\n${paint}`)
  } finally {
    session.stop()
  }
}
