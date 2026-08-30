import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveProvider } from '../src/agents/claude-code/providers.js'
import { buildStatus } from '../src/agents/claude-code/status.js'
import { probeEndpoint } from '../src/agents/claude-code/test-connection.js'
import { BACKUP_INFIX, MAX_BACKUPS } from '../src/core/constants.js'
import { maskSecret } from '../src/core/mask.js'
import { backupsDir, providerSettingsPath } from '../src/core/paths.js'
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
  const inputTypes = await fs.readFile(
    path.join(process.cwd(), 'node_modules/ink-text-input/build/index.d.ts'),
    'utf8',
  )
  assert.match(fieldSource, /mask=\{field\.type === 'secret' \? MASK_CHAR : undefined\}/)
  assert.match(fieldSource, /field\.type === 'secret' \? maskSecret\(text\) : text/)
  assert.match(inputTypes, /mask\?: string/)
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
    await verifyProbeErrorIsSanitized()

    process.stdout.write('Provider settings and credential safety verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
