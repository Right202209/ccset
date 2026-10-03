import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { openActivate, openRestore } from '../src/agents/codex/activate.js'
import { authProfilePath, codexAuthPath, codexConfigPath, backupsDir } from '../src/agents/codex/paths.js'

const ROUTING = 'model_provider = "legacy"\n[model_providers.legacy]\nname = "Legacy"\n[model_providers.router]\nname = "Router"\n'
const LIVE = '{"OPENAI_API_KEY":"UNKNOWN"}\n'

export async function verifyAdoptionNameConflict(home: string): Promise<void> {
  await fs.writeFile(codexConfigPath(home), ROUTING)
  await fs.writeFile(codexAuthPath(home), LIVE)
  await fs.writeFile(authProfilePath(home, 'router'), '{"OPENAI_API_KEY":"NEW"}\n')
  const form = await openActivate({ home }, 'router')
  assert.equal(form.kind, 'form')
  const target = authProfilePath(home, 'competing')
  await fs.writeFile(target, '{"tokens":"KEPT"}\n')
  await assert.rejects(() => form.submit({ adoptName: 'competing' }))
  assert.equal(await fs.readFile(target, 'utf8'), '{"tokens":"KEPT"}\n')
  assert.equal(await fs.readFile(codexAuthPath(home), 'utf8'), LIVE)
  assert.equal(await fs.readFile(codexConfigPath(home), 'utf8'), ROUTING)
}

export async function verifyKeyringActivationRefusal(home: string): Promise<void> {
  const target = codexConfigPath(home)
  const keyed = 'cli_auth_credentials_store = "keyring"\n' + ROUTING
  await fs.writeFile(target, ROUTING)
  await fs.writeFile(codexAuthPath(home), '{"OPENAI_API_KEY":"OLD"}\n')
  await fs.writeFile(authProfilePath(home, 'router'), '{"OPENAI_API_KEY":"NEW"}\n')
  await fs.writeFile(authProfilePath(home, 'old'), '{"OPENAI_API_KEY":"OLD"}\n')
  const activate = await openActivate({ home }, 'router')
  const restore = await openRestore({ home }, 'old')
  assert.equal(activate.kind, 'confirm')
  assert.equal(restore.kind, 'confirm')
  await fs.writeFile(target, keyed)
  const before = await fs.readdir(backupsDir(home)).catch(() => [])
  for (const screen of [activate, restore]) await assert.rejects(() => screen.confirm())
  for (const screen of [await openActivate({ home }, 'router'), await openRestore({ home }, 'old')]) {
    assert.equal(screen.kind, 'message', 'keyring mode offered an ineffective switch')
    assert.equal(screen.tone, 'error')
  }
  assert.equal(await fs.readFile(target, 'utf8'), keyed)
  assert.equal(await fs.readFile(codexAuthPath(home), 'utf8'), '{"OPENAI_API_KEY":"OLD"}\n')
  assert.deepEqual(await fs.readdir(backupsDir(home)).catch(() => []), before)
}
