import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import '../src/registry.js'
import { openRestore } from '../src/agents/codex/activate.js'
import { adoptedRoutingPath, authProfilePath, codexAuthPath, codexConfigPath, backupsDir } from '../src/agents/codex/paths.js'
import { runCli } from './cli-harness.js'

const LIVE = '{"auth_mode":"chatgpt","tokens":{"id_token":"TEST-ROUNDTRIP"}}\n'
const TABLES = '[model_providers.router]\nname = "Router"\n[model_providers.legacy]\nname = "Legacy"\n'

async function use(home: string, id: string, flags: string[] = []) {
  return runCli(['--agent', 'codex', 'provider', 'use', id, ...flags, '--json'], {
    CCSET_HOME: home, CODEX_HOME: undefined,
  })
}

async function roundTrip(home: string, route: string): Promise<void> {
  const config = codexConfigPath(home)
  const original = route + TABLES
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, original)
  await fs.writeFile(codexAuthPath(home), LIVE)
  await fs.writeFile(authProfilePath(home, 'router'), '{"OPENAI_API_KEY":"TEST-NEW"}\n')
  const dry = await use(home, 'router', ['--adopt-current-as', 'saved', '--dry-run'])
  assert.equal(dry.code, 0)
  const planned = JSON.parse(dry.stdout) as { targets: { path: string }[] }
  assert.ok(planned.targets.some((target) => target.path === adoptedRoutingPath(home)))
  await assert.rejects(() => fs.stat(adoptedRoutingPath(home)))
  assert.equal((await use(home, 'router', ['--adopt-current-as', 'saved'])).code, 0)
  assert.equal((await use(home, 'saved')).code, 0)
  assert.equal(await fs.readFile(config, 'utf8'), original)
  assert.equal(await fs.readFile(codexAuthPath(home), 'utf8'), LIVE)
  assert.equal((await use(home, 'router')).code, 0)
  const restore = await openRestore({ home }, 'saved')
  assert.equal(restore.kind, 'confirm')
  await restore.confirm()
  assert.equal(await fs.readFile(config, 'utf8'), original)
  assert.equal(await fs.readFile(codexAuthPath(home), 'utf8'), LIVE)
}

async function missingRoute(home: string): Promise<void> {
  await roundTrip(home, 'model_provider = "legacy"\n')
  await fs.writeFile(codexConfigPath(home), TABLES.replace('[model_providers.legacy]\nname = "Legacy"\n', ''))
  const before = await fs.readFile(codexConfigPath(home), 'utf8')
  const backups = await fs.readdir(backupsDir(home))
  const result = await use(home, 'saved')
  assert.notEqual(result.code, 0)
  assert.equal(JSON.parse(result.stdout).error.code, 'codex.error.missingRoute')
  assert.equal(await fs.readFile(codexConfigPath(home), 'utf8'), before)
  assert.deepEqual(await fs.readdir(backupsDir(home)), backups)
}

export async function verifyAdoptionRoundTrips(): Promise<void> {
  for (const route of ['', 'model_provider = "legacy"\n']) {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-roundtrip-'))
    try {
      await roundTrip(home, route)
    } finally {
      await fs.rm(home, { recursive: true, force: true })
    }
  }
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-missing-route-'))
  try {
    await missingRoute(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}
