import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveGlobal } from '../src/agents/claude-code/global.js'
import { globalSettingsPath } from '../src/agents/claude-code/paths.js'
import type { FormValues, JsonObject } from '../src/types.js'

const original: JsonObject = {
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'check.sh' }] }],
  },
  statusLine: { type: 'command', command: 'status.sh', padding: 2 },
  enabledPlugins: { 'example@marketplace': true },
  effortLevel: 'high',
  tui: { theme: 'dark', nested: { untouched: true } },
  verbose: true,
  env: {
    HTTPS_PROXY: 'http://old-proxy.example:8080',
    HTTP_PROXY: 'http://old-proxy.example:8080',
    USER_MANAGED: 'keep-me',
  },
  model: 'old-model',
  cleanupPeriodDays: 30,
}

const values: FormValues = {
  proxyEnabled: false,
  proxyUrl: 'http://unused.example:8080',
  disableNonessentialTraffic: '1',
  attributionHeader: '0',
  disableInstallationChecks: '1',
  enableToolSearch: '1',
  cleanupPeriodDays: '720',
  model: 'claude-sonnet-5',
}

async function readJson(filePath: string): Promise<JsonObject> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as JsonObject
}

async function main(): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-global-'))
  try {
    const target = globalSettingsPath(home)
    await fs.mkdir(path.dirname(target), { recursive: true })
    const originalText = `${JSON.stringify(original, null, 2)}\n`
    await fs.writeFile(target, originalText, { mode: 0o600 })

    const first = await saveGlobal({ home }, values)
    assert.ok(first.backupPath)
    assert.equal(await fs.readFile(first.backupPath, 'utf8'), originalText)

    const saved = await readJson(target)
    assert.deepEqual(saved['hooks'], original['hooks'])
    assert.deepEqual(saved['statusLine'], original['statusLine'])
    assert.deepEqual(saved['enabledPlugins'], original['enabledPlugins'])
    assert.equal(saved['effortLevel'], original['effortLevel'])
    assert.deepEqual(saved['tui'], original['tui'])
    assert.equal(saved['verbose'], original['verbose'])
    assert.equal((saved['env'] as JsonObject)['USER_MANAGED'], 'keep-me')
    assert.equal(Object.hasOwn(saved['env'] as JsonObject, 'HTTPS_PROXY'), false)
    assert.equal(Object.hasOwn(saved['env'] as JsonObject, 'HTTP_PROXY'), false)

    const firstText = await fs.readFile(target, 'utf8')
    const second = await saveGlobal({ home }, values)
    const secondText = await fs.readFile(target, 'utf8')
    assert.equal(secondText, firstText)
    assert.ok(second.backupPath)
    assert.equal(await fs.readFile(second.backupPath, 'utf8'), firstText)
    assert.deepEqual(JSON.parse(secondText), saved)

    if (process.platform !== 'win32') {
      const targetMode = (await fs.stat(target)).mode & 0o777
      const backupMode = (await fs.stat(second.backupPath)).mode & 0o777
      assert.equal(targetMode, 0o600)
      assert.equal(backupMode, 0o600)
    }

    process.stdout.write('Global settings preservation verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
