import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveProvider } from '../src/agents/claude-code/providers.js'
import { buildStatus } from '../src/agents/claude-code/status.js'
import { probeEndpoint, warnsPlaintextHttp } from '../src/agents/claude-code/test-connection.js'
import { BACKUP_INFIX, MASK_CHAR, MASK_FULL_HIDE_BELOW, MASK_MIDDLE_WIDTH, MAX_BACKUPS } from '../src/core/constants.js'
import { maskSecret } from '../src/core/mask.js'
import { backupsDir, providerSettingsPath } from '../src/agents/claude-code/paths.js'
import type { FormValues, JsonObject } from '../src/types.js'

const token = 'TOKEN-TEST-ALPHA-1234567890'

function values(name: string, model: string): FormValues {
  return {
    name,
    baseUrl: 'https://provider.example/v1',
    token,
    model,
    fallbackModel: 'fallback-a, fallback-b',
    defaultOpusModel: '',
    defaultSonnetModel: '',
    defaultHaikuModel: '',
  }
}

async function backupNames(home: string, configName: string): Promise<string[]> {
  const names = await fs.readdir(backupsDir(home))
  const prefix = `${configName}${BACKUP_INFIX}`
  return names.filter((name) => name.startsWith(prefix))
}

async function assertMode600(filePath: string): Promise<void> {
  if (process.platform === 'win32') return
  assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600)
}

async function verifyProbeErrorIsSanitized(): Promise<void> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error(`transport failed with ${token}`)
  }
  try {
    const result = await probeEndpoint({
      baseUrl: 'https://provider.example/v1',
      token,
      model: 'model-a',
    })
    assert.equal(JSON.stringify(result).includes(token), false)
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function verifySecretFieldMaskingContract(): Promise<void> {
  const fieldSource = await fs.readFile(path.join(process.cwd(), 'src/ui/Field.tsx'), 'utf8')
  const inputSource = await fs.readFile(path.join(process.cwd(), 'src/ui/TextField.tsx'), 'utf8')
  assert.match(fieldSource, /mask=\{field\.type === 'secret' \? glyphs\.mask : undefined\}/)
  assert.match(fieldSource, /field\.type === 'secret' \? maskSecret\(text\) : text/)
  assert.match(inputSource, /mask\?: string/)
  // Control combinations are shortcuts, never text: ctrl+s reaches the form's
  // save without its `s` landing in the focused editor.
  assert.match(inputSource, /key\.ctrl \|\| key\.meta/)
}

/**
 * The mask shows 4+4 only when that reveals at most half the secret: anything
 * shorter than MASK_FULL_HIDE_BELOW is masked entirely. A 9-character token
 * showing 8 real characters was the bug this pins shut (PRD 4.2.4).
 */
async function verifyMaskThresholds(): Promise<void> {
  const fullMask = MASK_CHAR.repeat(MASK_MIDDLE_WIDTH)
  for (let length = 1; length < MASK_FULL_HIDE_BELOW; length += 1) {
    const secret = 'x'.repeat(length)
    assert.equal(maskSecret(secret), fullMask, `a ${length}-character secret leaked its length`)
  }
  const at = 'abcdefghijklmnop'
  assert.equal(maskSecret(at), `abcd${fullMask}mnop`, 'the 16-character boundary lost the 4+4 rule')
  assert.equal(maskSecret(''), '', 'the empty secret did not stay empty')
}

/**
 * A credential over plain http travels unencrypted, so the confirm names it --
 * unless the destination is the user's own machine, where the wire never
 * leaves the host.
 */
function checkPlaintextWarning(): void {
  assert.equal(warnsPlaintextHttp('http://api.example.com/v1'), true, 'a plain-http host did not warn')
  assert.equal(warnsPlaintextHttp('http://localhost:8080/v1'), false, 'localhost warned')
  assert.equal(warnsPlaintextHttp('http://proxy.localhost:3000'), false, 'a .localhost host warned')
  assert.equal(warnsPlaintextHttp('http://127.0.0.1:8081'), false, 'a loopback address warned')
  assert.equal(warnsPlaintextHttp('http://[::1]/v1'), false, 'an IPv6 loopback warned')
  assert.equal(warnsPlaintextHttp('https://api.example.com/v1'), false, 'https warned')
  assert.equal(warnsPlaintextHttp('not a url'), false, 'an unparseable URL warned')
}

async function main(): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-provider-'))
  try {
    const alphaPath = providerSettingsPath(home, 'alpha')
    const betaPath = providerSettingsPath(home, 'beta')
    await fs.mkdir(path.dirname(alphaPath), { recursive: true })
    const original: JsonObject = {
      env: { ANTHROPIC_AUTH_TOKEN: token, CUSTOM_ENV: { nested: 'keep-me' } },
      model: 'old-model',
      permissions: { allow: ['Read', 'Bash(git status)'] },
      custom: { nested: { untouched: true } },
    }
    await fs.writeFile(alphaPath, `${JSON.stringify(original, null, 2)}\n`, { mode: 0o600 })
    await fs.writeFile(betaPath, `${JSON.stringify({ env: { CUSTOM_BETA: true } }, null, 2)}\n`, {
      mode: 0o600,
    })

    await saveProvider({ home }, values('alpha', 'model-0'))
    const first = JSON.parse(await fs.readFile(alphaPath, 'utf8')) as JsonObject
    assert.deepEqual(first['permissions'], original['permissions'])
    assert.deepEqual(first['custom'], original['custom'])
    assert.deepEqual((first['env'] as JsonObject)['CUSTOM_ENV'], { nested: 'keep-me' })

    for (let index = 1; index <= MAX_BACKUPS + 2; index += 1) {
      await saveProvider({ home }, values('alpha', `model-${index}`))
    }
    await saveProvider({ home }, values('beta', 'beta-model'))

    const alphaBackups = await backupNames(home, path.basename(alphaPath))
    const betaBackups = await backupNames(home, path.basename(betaPath))
    assert.equal(alphaBackups.length, MAX_BACKUPS)
    assert.equal(betaBackups.length, 1)
    await assertMode600(alphaPath)
    await assertMode600(betaPath)
    for (const name of [...alphaBackups, ...betaBackups]) {
      await assertMode600(path.join(backupsDir(home), name))
    }

    const status = await buildStatus({ home })
    const serializedStatus = JSON.stringify(status.sections)
    assert.equal(serializedStatus.includes(token), false)
    assert.equal(serializedStatus.includes(maskSecret(token)), true)
    assert.equal(maskSecret(token).length, maskSecret(`${token}-MUCH-LONGER`).length)
    await verifySecretFieldMaskingContract()
    await verifyMaskThresholds()
    checkPlaintextWarning()
    await verifyProbeErrorIsSanitized()

    process.stdout.write('Provider settings and credential safety verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
