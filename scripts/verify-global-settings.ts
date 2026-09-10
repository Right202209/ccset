import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveGlobal } from '../src/agents/claude-code/global.js'
import { validateCleanupPeriodDays } from '../src/agents/claude-code/manifest.js'
import { activationCommand, globalSettingsPath } from '../src/agents/claude-code/paths.js'
import { makeOptionalIntValidator } from '../src/core/validate.js'
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

/**
 * The activation line is what the user pastes into a shell, so a home directory
 * with a space must arrive as one argument: the path is single-quoted, and an
 * embedded quote is escaped the POSIX way. The report carries the same line.
 */
function checkActivationCommand(target: string, reportCommand: string): void {
  const spaced = '/tmp/has space/.claude/settings.json'
  assert.equal(activationCommand(spaced), `claude --settings '${spaced}'`, 'a space in the path broke the activation command into two arguments')
  const quoted = "/tmp/it's/.claude/settings.json"
  assert.equal(activationCommand(quoted), `claude --settings '/tmp/it'\\''s/.claude/settings.json'`, 'an embedded quote was not escaped')
  assert.equal(reportCommand, `claude --settings '${target}'`, 'the save report did not carry the quoted activation command')
}

/**
 * The minimum is a real bound, not just "zero is rejected": a validator built
 * with minimum 5 must refuse 3, and the shipped day validator must refuse 0
 * while taking 1 and blank. Blank still means omit, whichever the bounds.
 */
function checkIntValidatorBounds(): void {
  const atLeastFive = makeOptionalIntValidator(5, 100)
  assert.notEqual(atLeastFive('3'), null, 'a value below the minimum was accepted')
  assert.equal(atLeastFive('5'), null, 'the minimum itself was refused')
  assert.notEqual(atLeastFive('0'), null, 'zero below a positive minimum was accepted')
  assert.equal(atLeastFive('100'), null, 'the maximum was refused')
  assert.notEqual(atLeastFive('101'), null, 'a value over the maximum was accepted')
  assert.equal(atLeastFive(''), null, 'a blank stopped meaning omit')
  assert.notEqual(atLeastFive('1.5'), null, 'a non-integer was accepted')
  assert.notEqual(validateCleanupPeriodDays('0'), null, 'day zero was accepted')
  assert.equal(validateCleanupPeriodDays('1'), null, 'day one was refused')
}

async function main(): Promise<void> {
  checkIntValidatorBounds()
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-global-'))
  try {
    const target = globalSettingsPath(home)
    await fs.mkdir(path.dirname(target), { recursive: true })
    const originalText = `${JSON.stringify(original, null, 2)}\n`
    await fs.writeFile(target, originalText, { mode: 0o600 })

    const first = await saveGlobal({ home }, values)
    assert.ok(first.backupPath)
    assert.equal(await fs.readFile(first.backupPath, 'utf8'), originalText)
    checkActivationCommand(target, first.command)

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
