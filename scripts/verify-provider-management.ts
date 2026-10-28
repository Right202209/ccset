import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Action, ActionResult, Ctx, ListItem } from '../src/types.js'
import '../src/registry.js'
import { t } from '../src/i18n/index.js'
import { settingsFilePath } from '../src/core/paths.js'
import { readIgnoredProviders, readSettings, saveLocale, setProviderIgnored } from '../src/core/settings.js'
import { providerSettingsPath } from '../src/agents/claude-code/paths.js'
import { loadProviders as loadClaudeProviders, removeProvider as removeClaude } from '../src/agents/claude-code/providers.js'
import { openProviders as openClaudeList, openTest } from '../src/agents/claude-code/provider-actions.js'
import { opencodeJsoncPath, opencodeTarget } from '../src/agents/opencode/paths.js'
import { removeProvider as removeOpencode } from '../src/agents/opencode/providers.js'
import { opencodeActions } from '../src/agents/opencode/actions.js'
import { modelsFile } from '../src/agents/pi/paths.js'
import { removeProvider as removePi } from '../src/agents/pi/providers.js'
import { piActions } from '../src/agents/pi/actions.js'
import { configFile as grokConfigFile } from '../src/agents/grok-build/paths.js'
import { removeProvider as removeGrok } from '../src/agents/grok-build/providers.js'
import { grokBuildActions } from '../src/agents/grok-build/actions.js'
import { authProfilePath, codexConfigPath } from '../src/agents/codex/paths.js'
import { codexConfigFile } from '../src/agents/codex/global.js'
import { removeProvider as removeCodex } from '../src/agents/codex/providers.js'
import { codexActions } from '../src/agents/codex/actions.js'
import { withHome } from './cli-harness.js'

/**
 * Deleting and ignoring providers (ADR 0019): a delete removes exactly the named
 * provider -- one file, or one block of a shared document -- leaves the siblings
 * and the document's comments alone, and keeps a backup of what went; an ignore
 * is ccset's own note, so it writes nothing into any Agent's configuration.
 */

const ACME = 'acme'
const OTHER = 'other'

async function write(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, contents, { mode: 0o600 })
}

const read = (filePath: string): Promise<string> => fs.readFile(filePath, 'utf8')
const exists = (filePath: string): Promise<boolean> => fs.access(filePath).then(() => true, () => false)

async function assertBackupHolds(backupPath: string | null, original: string): Promise<void> {
  assert.ok(backupPath !== null, 'the removal kept no backup')
  assert.equal(await read(backupPath), original, 'the backup does not hold what was removed')
}

function listOf(screen: ActionResult, where: string): ListItem[] {
  assert.equal(screen.kind, 'list', `${where} is not a list screen`)
  return screen.kind === 'list' ? screen.items : []
}

function itemById(items: ListItem[], id: string): ListItem {
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

const acmeFile = (home: string): string => providerSettingsPath(home, ACME)
const CLAUDE_DOC = `${JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'https://acme.example', ANTHROPIC_AUTH_TOKEN: 'sk-acme-0123456789' }, model: 'm' }, null, 2)}\n`
const OTHER_DOC = `${JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'https://other.example' } }, null, 2)}\n`
const GROK_DOC = '# keep me\n[model.acme]\nbase_url = "https://acme.example"\n\n[model.other]\nbase_url = "https://other.example"\n'
const CODEX_ACME_PROFILE = `${JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: 'sk-acme-0123456789' })}\n`
const OPENCODE_DOC = `{
  // kept comment
  "provider": {
    "acme": { "options": { "baseURL": "https://acme.example" } },
    "other": { "options": { "baseURL": "https://other.example" } }
  }
}
`

async function seedClaude(home: string): Promise<void> {
  await write(acmeFile(home), CLAUDE_DOC)
  await write(providerSettingsPath(home, OTHER), OTHER_DOC)
}

/* ------------------------------------------------- Claude Code: one file each */

async function verifyClaudeRemoval(home: string): Promise<void> {
  const report = await removeClaude({ home }, ACME)
  assert.equal(report.changed, true)
  assert.equal(await exists(acmeFile(home)), false, 'the provider file survived its deletion')
  await assertBackupHolds(report.targets[0]?.backupPath ?? null, CLAUDE_DOC)
  assert.equal(await read(providerSettingsPath(home, OTHER)), OTHER_DOC, 'the sibling file changed')
  const again = await removeClaude({ home }, ACME)
  assert.equal(again.changed, false, 'deleting an absent provider claimed a change')
  assert.equal(again.targets[0]?.backupPath, null, 'an absent provider was backed up')
}

/* ------------------------------------------ one document, many providers */

async function verifyOpencodeRemoval(home: string): Promise<void> {
  // The .jsonc target: that is the one whose codec is format-preserving.
  const target = opencodeJsoncPath(home)
  await write(target, OPENCODE_DOC)
  assert.equal((await opencodeTarget(home)).path, target, 'the .jsonc document is not the managed target')
  const report = await removeOpencode({ home }, ACME)
  assert.equal(report.changed, true)
  await assertBackupHolds(report.targets[0]?.backupPath ?? null, OPENCODE_DOC)
  const after = await read(target)
  assert.equal(after.includes('// kept comment'), true, 'the removal dropped an unmanaged comment')
  assert.equal(after.includes('other.example'), true, 'the removal dropped a sibling provider')
  assert.equal(after.includes('acme.example'), false, 'the removed provider is still there')
  assert.equal((await removeOpencode({ home }, 'missing')).changed, false, 'an absent block claimed a change')
  assert.equal(await read(target), after, 'deleting an absent block rewrote the document')
}

async function verifyPiRemoval(home: string): Promise<void> {
  const target = modelsFile(home)
  await write(target.path, `${JSON.stringify({ providers: { acme: { baseUrl: 'https://acme.example', models: [{ id: 'm1', cost: { in: 1 } }] }, other: { baseUrl: 'https://other.example' } } }, null, 2)}\n`)
  assert.equal((await removePi({ home }, ACME)).changed, true)
  const parsed = JSON.parse(await read(target.path)) as { providers: Record<string, unknown> }
  assert.deepEqual(Object.keys(parsed.providers), [OTHER], 'the wrong provider blocks remain')
  assert.deepEqual(parsed.providers[OTHER], { baseUrl: 'https://other.example' }, 'a sibling block was reshaped')
}

async function verifyGrokRemoval(home: string): Promise<void> {
  const target = grokConfigFile(home)
  await write(target.path, GROK_DOC)
  const report = await removeGrok({ home }, ACME)
  assert.equal(report.changed, true)
  await assertBackupHolds(report.targets[0]?.backupPath ?? null, GROK_DOC)
  const after = await read(target.path)
  assert.equal(after.includes('# keep me'), true, 'the removal dropped an unmanaged comment')
  assert.equal(after.includes('model.acme'), false, 'the removed table is still there')
  assert.equal(after.includes('other.example'), true, 'the removal dropped a sibling table')
}

async function verifyCodexRemoval(home: string): Promise<void> {
  const target = codexConfigFile(home)
  await write(target.path, 'model_provider = "other"\n\n[model_providers.acme]\nname = "Acme"\nbase_url = "https://acme.example"\n\n[model_providers.other]\nname = "Other"\nbase_url = "https://other.example"\n')
  const sidecar = authProfilePath(home, ACME)
  await write(sidecar, CODEX_ACME_PROFILE)
  const report = await removeCodex({ home }, ACME)
  assert.equal(report.changed, true)
  assert.equal(await exists(sidecar), false, 'the saved credential survived its provider')
  await assertBackupHolds(report.targets[0]?.backupPath ?? null, CODEX_ACME_PROFILE)
  const after = await read(target.path)
  assert.equal(after.includes('acme.example'), false, 'the removed table is still there')
  assert.equal(after.includes('other.example'), true, 'the removal dropped a sibling table')
}

async function verifyCodexRefusesWhileRouted(home: string): Promise<void> {
  await write(codexConfigFile(home).path, 'model_provider = "acme"\n\n[model_providers.acme]\nbase_url = "https://acme.example"\n')
  await assert.rejects(
    () => removeCodex({ home }, ACME),
    (err: unknown) => (err as { messageKey?: string }).messageKey === 'codex.validate.routedToProvider',
    'deleting the routed provider was not refused',
  )
  assert.equal((await read(codexConfigFile(home).path)).includes('acme.example'), true, 'the routed table went anyway')
}

/* -------------------------------------------------------------- ignoring */

async function verifyIgnoreStore(home: string): Promise<void> {
  await saveLocale(home, 'zh-Hans')
  await setProviderIgnored(home, 'claude-code', ACME, true)
  assert.deepEqual(await readIgnoredProviders(home, 'claude-code'), [ACME])
  // The language choice must not carry the ignore list away, nor the reverse.
  await saveLocale(home, 'en')
  assert.deepEqual(await readSettings(home), { locale: 'en', ignoredProviders: { 'claude-code': [ACME] } })
  assert.deepEqual(JSON.parse(await read(settingsFilePath(home))), {
    version: 1,
    locale: 'en',
    ignoredProviders: { 'claude-code': [ACME] },
  })
  await write(settingsFilePath(home), '{ not json')
  assert.deepEqual(await readIgnoredProviders(home, 'claude-code'), [], 'a broken document was not unchosen')
  await setProviderIgnored(home, 'claude-code', ACME, false)
  const written = JSON.parse(await read(settingsFilePath(home))) as Record<string, unknown>
  assert.equal('ignoredProviders' in written, false, 'the emptied ignore list was still written')
}

async function verifyClaudeListAndIgnore(ctx: Ctx): Promise<void> {
  const hidden = listOf(await openClaudeList(ctx), 'the provider list')
  assert.deepEqual(hidden.map((item) => item.id), ['__add__', OTHER, '__ignored__'], 'the ignored provider was offered')
  assert.equal(itemById(hidden, '__ignored__').label, t('action.showIgnored', { count: '1' }))
  const shown = listOf(await openClaudeList(ctx, true), 'the revealed provider list')
  const acme = itemById(shown, ACME)
  assert.match(acme.detail ?? '', new RegExp(t('provider.ignored')), 'a revealed row does not say it is ignored')

  // The provider is ignored, so its screen offers the way out, not the way in.
  const manage = listOf(await acme.run(), 'the provider screen')
  assert.deepEqual(manage.map((item) => item.id), ['edit', 'unignore', 'delete'], 'the provider screen is missing a verb')
  const unignore = await itemById(manage, 'unignore').run()
  assert.equal(unignore.kind, 'confirm', 'ignoring did not ask first')
  assert.deepEqual(await readIgnoredProviders(ctx.home, 'claude-code'), [ACME], 'opening it wrote the ignore list')
  if (unignore.kind !== 'confirm') return
  await unignore.confirm()
  assert.deepEqual(await readIgnoredProviders(ctx.home, 'claude-code'), [], 'un-ignoring did not clear the entry')
  const back = listOf(await itemById(listOf(await openClaudeList(ctx), 'the list'), ACME).run(), 'the provider screen')
  itemById(back, 'edit')
  assert.equal(back.some((item) => item.id === 'unignore'), false, 'an un-ignored provider still offers Stop ignoring')
}

async function verifyClaudeDeleteScreen(ctx: Ctx): Promise<void> {
  await setProviderIgnored(ctx.home, 'claude-code', ACME, true)
  const manage = listOf(await itemById(listOf(await openClaudeList(ctx, true), 'the list'), ACME).run(), 'the provider screen')
  const confirm = await itemById(manage, 'delete').run()
  assert.equal(confirm.kind, 'confirm', 'delete did not ask first')
  if (confirm.kind !== 'confirm') return
  assert.equal(confirm.lines.join('\n').includes(acmeFile(ctx.home)), true, 'the confirm does not name the file it deletes')
  assert.equal((await confirm.confirm()).kind, 'message')
  assert.equal(await exists(acmeFile(ctx.home)), false, 'the confirmed delete did not delete')
}

/** Ignoring is ccset's own note: the Agent's files must not move for it. */
async function verifyIgnoringTouchesNoAgentConfig(ctx: Ctx): Promise<void> {
  await setProviderIgnored(ctx.home, 'claude-code', OTHER, true)
  assert.equal(await read(providerSettingsPath(ctx.home, OTHER)), OTHER_DOC)
  assert.equal((await loadClaudeProviders(ctx)).length, 1, 'ignoring removed the file itself')
  await setProviderIgnored(ctx.home, 'claude-code', OTHER, false)
}

async function verifyTestListSkipsIgnored(ctx: Ctx): Promise<void> {
  await write(acmeFile(ctx.home), CLAUDE_DOC)
  await setProviderIgnored(ctx.home, 'claude-code', ACME, true)
  const items = listOf(await openTest(ctx), 'the probe list')
  assert.deepEqual(items.map((item) => item.id), [OTHER], 'the probe still offers the ignored provider')
}

/* ------------------------------------------------ the other Agents' lists */

async function verifyOtherListsHideIgnored(home: string): Promise<void> {
  const ctx: Ctx = { home }
  const cases: { agent: string; seed: string; doc: string; actions: Action[] }[] = [
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
  for (const entry of cases) {
    await write(entry.seed, entry.doc)
    await setProviderIgnored(home, entry.agent, ACME, true)
    const ids = listOf(await providersAction(entry.actions, ctx), `${entry.agent}'s provider list`).map((item) => item.id)
    assert.equal(ids.includes(ACME), false, `${entry.agent} still offers an ignored provider`)
    assert.equal(ids.includes('__ignored__'), true, `${entry.agent} has no way back to an ignored provider`)
    await setProviderIgnored(home, entry.agent, ACME, false)
  }
}

async function main(): Promise<void> {
  await withHome('provider-claude', async (home) => {
    const ctx: Ctx = { home }
    await seedClaude(home)
    await verifyClaudeRemoval(home)
    await verifyIgnoreStore(home)
    await seedClaude(home)
    await setProviderIgnored(home, 'claude-code', ACME, true)
    await verifyClaudeListAndIgnore(ctx)
    await verifyClaudeDeleteScreen(ctx)
    await verifyIgnoringTouchesNoAgentConfig(ctx)
    await verifyTestListSkipsIgnored(ctx)
  })
  await withHome('provider-opencode', verifyOpencodeRemoval)
  await withHome('provider-pi', verifyPiRemoval)
  await withHome('provider-grok', verifyGrokRemoval)
  await withHome('provider-codex', async (home) => {
    await verifyCodexRemoval(home)
    await verifyCodexRefusesWhileRouted(home)
  })
  await withHome('provider-lists', verifyOtherListsHideIgnored)
  process.stdout.write('Provider deletion and ignoring verification passed.\n')
}

await main()
