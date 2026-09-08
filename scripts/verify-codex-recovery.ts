import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { activateAuthProfile, loadAuthState } from '../src/agents/codex/auth.js'
import { codexActions } from '../src/agents/codex/actions.js'
import { openActivate, openRestore } from '../src/agents/codex/activate.js'
import { currentModelProvider, saveModelProvider } from '../src/agents/codex/global.js'
import { ValidationError } from '../src/core/errors.js'
import { runSave } from '../src/core/save.js'
import { loadProviders, saveProvider } from '../src/agents/codex/providers.js'
import { authProfilePath, backupsDir, codexAuthPath, codexConfigPath } from '../src/agents/codex/paths.js'
import { readTomlObject } from '../src/core/toml/index.js'
import type { ActionResult, Ctx, FormValues, JsonObject } from '../src/types.js'

/**
 * How a save and a switch fail. Recovery is where the review pass found the
 * codex module lying: a fresh-start confirm that reset the wrong file, a
 * switch that kept routing after its credential move died, a sidecar that
 * would not parse being copied over a working auth.json, a saved login with
 * no way back, and an env_key that silently outranks the credential ccset
 * saves. Each check below pins the failure to the honest outcome.
 */

const API_KEY = 'CODEX-RECOVERY-KEY-123456'

function providerValuesOf(id: string, apiKey: string): FormValues {
  return { id, displayName: 'Router', baseUrl: 'https://router.example/v1', apiKey }
}

function sidecarJson(apiKey: string): string {
  return `${JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: apiKey }, null, 2)}\n`
}

async function readConfig(home: string): Promise<JsonObject> {
  return readTomlObject(await fs.readFile(codexConfigPath(home), 'utf8'))
}

function configOf(home: string): Ctx {
  return { home }
}

async function providersScreen(ctx: Ctx): Promise<Extract<ActionResult, { kind: 'list' }>> {
  const providers = codexActions().find((action) => action.id === 'providers')
  assert.ok(providers !== undefined, 'the providers action disappeared')
  const screen = await providers.run(ctx)
  assert.equal(screen.kind, 'list')
  return screen
}

/**
 * A malformed sidecar must not cost the valid config.toml its content, and a
 * malformed config.toml must not cost the sidecar: `startFresh` is scoped to
 * the target that actually failed to parse.
 */
async function verifyFreshRecoveryIsScoped(home: string): Promise<void> {
  const target = codexConfigPath(home)
  const intact = 'unrelated_setting = true\n\n[model_providers.keep]\nname = "K"\n'
  await fs.writeFile(target, intact, { mode: 0o600 })
  const sidecar = authProfilePath(home, 'broken')
  await fs.writeFile(sidecar, '{ not json', { mode: 0o600 })

  await assert.rejects(
    () => saveProvider(configOf(home), providerValuesOf('broken', 'K-1')),
    (err: Error) => err.name === 'JsonParseError',
    'a malformed sidecar was not reported',
  )
  await saveProvider(configOf(home), providerValuesOf('broken', 'K-1'), true)
  const config = await readConfig(home)
  assert.equal(config['unrelated_setting'], true, 'a JSON error reset the valid config.toml')
  assert.ok(
    'keep' in (config['model_providers'] as JsonObject),
    'a JSON error reset unrelated providers',
  )
  const saved = JSON.parse(await fs.readFile(sidecar, 'utf8')) as JsonObject
  assert.equal(saved['OPENAI_API_KEY'], 'K-1', 'the confirmed retry did not replace the sidecar')

  const sidecarRaw = await fs.readFile(sidecar, 'utf8')
  await fs.writeFile(target, 'model = "unterminated\n', { mode: 0o600 })
  await saveProvider(configOf(home), providerValuesOf('broken', 'K-2'), true)
  assert.equal(
    (await readConfig(home))['model_providers'] !== undefined,
    true,
    'a broken config.toml was not rebuilt',
  )
  assert.equal(
    JSON.parse(await fs.readFile(sidecar, 'utf8'))['OPENAI_API_KEY'],
    'K-2',
    'a broken config.toml cost the sidecar its key',
  )
  assert.notEqual(await fs.readFile(sidecar, 'utf8'), sidecarRaw)
}

/** env_key outranks auth.json, so a save into such a block is refused. */
async function verifyCredentialSourceConflictIsRefused(home: string): Promise<void> {
  const target = codexConfigPath(home)
  const raw = '[model_providers.envy]\nname = "E"\nbase_url = "https://e/v1"\nenv_key = "E_KEY"\n'
  await fs.writeFile(target, raw, { mode: 0o600 })
  await assert.rejects(
    () => saveProvider(configOf(home), providerValuesOf('envy', API_KEY)),
    (err: unknown) =>
      err instanceof ValidationError &&
      err.messageKey === 'codex.error.credentialSourceConflict',
    'a block with env_key was saved as if auth.json would be used',
  )
  assert.equal(await fs.readFile(target, 'utf8'), raw, 'the refused save still wrote')
  const list = await loadProviders(configOf(home))
  assert.equal(
    list.records.find((record) => record.id === 'envy')?.problemKey,
    'codex.status.credentialSource',
    'Status did not report the overriding credential source',
  )
}

/** A sidecar that does not parse is never copied over a working auth.json. */
async function verifyUnreadableProfileIsRefused(home: string): Promise<void> {
  const config = '[model_providers.router]\nname = "R"\nbase_url = "https://r/v1"\n'
  await fs.writeFile(codexConfigPath(home), config, { mode: 0o600 })
  await fs.writeFile(authProfilePath(home, 'router'), '{ not json', { mode: 0o600 })
  await fs.rm(codexAuthPath(home), { force: true })

  const screen = await openActivate(configOf(home), 'router')
  assert.equal(screen.kind, 'message', 'an unreadable sidecar was offered for activation')
  assert.equal(screen.tone, 'error')
  assert.ok(
    screen.lines.some((line) => line.includes('not valid JSON')),
    'the refusal did not say the sidecar is unreadable',
  )
  await assert.rejects(
    () => activateAuthProfile(configOf(home), 'router', null),
    (err: Error) => err.name === 'JsonParseError',
    'the commit did not revalidate its source',
  )
}

/**
 * A credential move that fails after routing has landed must put the routing
 * back: pointing Codex at an endpoint whose credential never arrived sends the
 * old key to the new endpoint. The failure is injected at the adoption step --
 * the adoption target exists as a directory, so its rename fails no matter
 * what user the fixture runs as -- which is after the routing write. A sidecar
 * that vanishes while the confirmation is open is the second phase: staging
 * must stop it before anything has moved at all.
 */
async function verifyRoutingIsRestoredWhenTheMoveFails(home: string): Promise<void> {
  await saveModelProvider(configOf(home), 'other')
  await fs.writeFile(authProfilePath(home, 'gone'), sidecarJson('G'), { mode: 0o600 })
  await fs.writeFile(codexAuthPath(home), sidecarJson('PREVIOUS-KEY'), { mode: 0o600 })

  // The live credential is unknown, so the switch asks for a name -- and the
  // name's destination is a directory the adoption cannot replace.
  const switchScreen = await openActivate(configOf(home), 'gone')
  assert.equal(switchScreen.kind, 'form')
  await fs.mkdir(authProfilePath(home, 'blocked'))
  await assert.rejects(
    () => switchScreen.submit({ adoptName: 'blocked' }),
    () => true,
    'the failed credential move did not fail loudly',
  )
  assert.equal(
    await currentModelProvider(configOf(home)),
    'other',
    'routing kept pointing at the provider whose credential never landed',
  )
  await fs.rmdir(authProfilePath(home, 'blocked'))

  // A sidecar that vanishes while the confirmation is open fails at staging,
  // before the routing has moved anywhere.
  const vanished = await openActivate(configOf(home), 'gone')
  assert.equal(vanished.kind, 'form')
  await fs.rm(authProfilePath(home, 'gone'))
  await assert.rejects(
    () => vanished.submit({ adoptName: '' }),
    () => true,
    'the vanished sidecar did not fail loudly',
  )
  assert.equal(
    await currentModelProvider(configOf(home)),
    'other',
    'routing moved for a source that was never there',
  )
}

/**
 * The adopt screen promises a switchable profile. The promise holds only if
 * the login is listed with the routing it restores to, and restoring puts both
 * the credential and the routing back.
 */
async function verifyAdoptedProfileCanBeRestored(home: string): Promise<void> {
  // Distinct from the credential verifySwitch adopts: the live bytes have to
  // match no saved profile for the adopt screen to open.
  const chatgpt = `${JSON.stringify({ auth_mode: 'chatgpt', tokens: { id_token: 'oauth-recovery' } }, null, 2)}\n`
  await fs.rm(authProfilePath(home, 'router'), { force: true })
  await saveProvider(configOf(home), providerValuesOf('router', API_KEY))
  await fs.writeFile(codexAuthPath(home), chatgpt, { mode: 0o600 })
  await saveModelProvider(configOf(home), 'legacy')

  const switchScreen = await openActivate(configOf(home), 'router')
  assert.equal(switchScreen.kind, 'form', 'the live login was not offered for adoption')
  await switchScreen.submit({ adoptName: 'personal' })

  const list = await providersScreen(configOf(home))
  const entry = list.items.find((item) => item.id === 'personal')
  assert.ok(entry !== undefined, 'the adopted login has no switch-back entry anywhere')
  assert.ok(
    entry.detail?.includes('legacy') === true,
    'the restore entry does not say what routing it restores',
  )

  const restore = await openRestore(configOf(home), 'personal')
  assert.equal(restore.kind, 'confirm')
  await restore.confirm()
  assert.equal(await currentModelProvider(configOf(home)), 'legacy', 'the routing was not restored')
  const live = JSON.parse(await fs.readFile(codexAuthPath(home), 'utf8')) as JsonObject
  assert.equal(live['auth_mode'], 'chatgpt', 'the credential was not restored')

  const auth = await loadAuthState(configOf(home))
  assert.equal(auth.activeName, 'personal', 'the restored login does not match its own profile')
}

/**
 * The TUI save goes through runSave: the parse error's confirm names the file
 * that failed, and accepting it has to finish the save rather than loop.
 */
async function verifyRunSaveConfirmCompletes(home: string): Promise<void> {
  await fs.writeFile(codexConfigPath(home), 'unrelated_setting = true\n', { mode: 0o600 })
  await fs.writeFile(authProfilePath(home, 'looped'), '{ not json', { mode: 0o600 })
  const save = (fresh: boolean) =>
    saveProvider(configOf(home), providerValuesOf('looped', 'K-1'), fresh)
  const screen = await runSave('write.providerSaved', save, 'busy')
  assert.equal(screen.kind, 'confirm', 'a malformed sidecar did not ask before replacing')
  assert.ok(
    screen.lines.some((line) => line.includes('looped')),
    'the confirm did not name the sidecar that failed',
  )
  await screen.confirm()
  const config = await readConfig(home)
  assert.equal(config['unrelated_setting'], true, 'the accepted confirm reset the valid config.toml')
}

export async function verifyCodexRecovery(home: string): Promise<void> {
  await verifyFreshRecoveryIsScoped(home)
  await verifyRunSaveConfirmCompletes(home)
  await verifyCredentialSourceConflictIsRefused(home)
  await verifyUnreadableProfileIsRefused(home)
  await verifyRoutingIsRestoredWhenTheMoveFails(home)
  await verifyAdoptedProfileCanBeRestored(home)
}
