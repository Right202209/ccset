import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveProvider } from '../src/agents/claude-code/providers.js'
import { saveProjectModelMapping, seedProjectModelMapping } from '../src/agents/claude-code/model-mappings.js'
import { openProjectModelMappingForm } from '../src/agents/claude-code/model-mapping-screen.js'
import { buildStatus } from '../src/agents/claude-code/status.js'
import { probeEndpoint, warnsPlaintextHttp } from '../src/agents/claude-code/test-connection.js'
import { BACKUP_INFIX, MASK_CHAR, MASK_FULL_HIDE_BELOW, MASK_MIDDLE_WIDTH, MAX_BACKUPS } from '../src/core/constants.js'
import { ConfigParseError } from '../src/core/errors.js'
import { maskSecret } from '../src/core/mask.js'
import { backupsDir, globalSettingsPath, projectSettingsPath, providerSettingsPath } from '../src/agents/claude-code/paths.js'
import type { FormValues, JsonObject } from '../src/types.js'
import '../src/registry.js'
import { t } from '../src/i18n/index.js'

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

async function verifyProbeDoesNotFollowRedirects(): Promise<void> {
  const originalFetch = globalThis.fetch
  let calls = 0
  let redirect: RequestRedirect | undefined
  globalThis.fetch = async (_input, init) => {
    calls += 1
    redirect = init?.redirect
    return new Response(null, { status: 302, headers: { location: 'https://unconfirmed.example/' } })
  }
  try {
    const result = await probeEndpoint({ baseUrl: 'https://confirmed.example/v1', token, model: 'model-a' })
    assert.equal(result.ok, false, 'a redirect was reported as an accepted token')
    assert.equal(calls, 1, 'the probe followed a redirect')
    assert.equal(redirect, 'manual', 'the probe did not disable redirects')
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
  assert.equal(warnsPlaintextHttp('http://127.255.255.255:8081'), false, 'the end of 127/8 warned')
  assert.equal(warnsPlaintextHttp('http://127.attacker.example:8081'), true, 'a lookalike domain skipped the warning')
  assert.equal(warnsPlaintextHttp('http://[::1]/v1'), false, 'an IPv6 loopback warned')
  assert.equal(warnsPlaintextHttp('https://api.example.com/v1'), false, 'https warned')
  assert.equal(warnsPlaintextHttp('not a url'), false, 'an unparseable URL warned')
}

async function verifyMappingWarningAndSeed(ctx: { home: string; projectDir: string }): Promise<void> {
  const form = await openProjectModelMappingForm(ctx, ['claude-sonnet-4', 'claude-opus-4'])
  assert.equal(form.kind, 'form')
  if (form.kind !== 'form') return
  assert.ok(form.notes?.includes(t('claudeCode.warning.modelMappingClaudeNames')))
  assert.ok(form.fields.every((field) => field.suggestions?.includes('claude-sonnet-4')))
  assert.deepEqual(await seedProjectModelMapping(ctx), {
    anthropicModel: '',
    defaultOpusModel: 'old-opus',
    defaultSonnetModel: '',
    defaultHaikuModel: 'old-haiku',
    subagentModel: '',
  })
}

async function verifyMappingWrites(
  ctx: { home: string; projectDir: string },
  target: string,
  homeTarget: string,
  homeContents: string,
  mappings: FormValues,
): Promise<void> {
  await saveProjectModelMapping(ctx, mappings)
  let written = JSON.parse(await fs.readFile(target, 'utf8')) as JsonObject
  let env = written['env'] as JsonObject
  assert.equal(env['ANTHROPIC_MODEL'], 'deepseek-flash[1m]')
  assert.equal(env['ANTHROPIC_DEFAULT_OPUS_MODEL'], 'opus-router')
  assert.equal(env['ANTHROPIC_DEFAULT_SONNET_MODEL'], 'sonnet-router')
  assert.equal(env['ANTHROPIC_DEFAULT_HAIKU_MODEL'], 'haiku-router')
  assert.equal(env['CLAUDE_CODE_SUBAGENT_MODEL'], 'subagent-router')
  assert.deepEqual(env['CUSTOM_ENV'], { nested: 'keep-me' })
  assert.deepEqual(written['permissions'], { allow: ['Read'] })
  await assertMode600(target)

  await saveProjectModelMapping(ctx, { ...mappings, defaultSonnetModel: '' })
  written = JSON.parse(await fs.readFile(target, 'utf8')) as JsonObject
  env = written['env'] as JsonObject
  assert.equal(Object.hasOwn(env, 'ANTHROPIC_DEFAULT_SONNET_MODEL'), false)
  assert.equal(env['ANTHROPIC_MODEL'], 'deepseek-flash[1m]')
  assert.equal(env['ANTHROPIC_DEFAULT_OPUS_MODEL'], 'opus-router')
  assert.equal(env['ANTHROPIC_DEFAULT_HAIKU_MODEL'], 'haiku-router')
  assert.equal(env['CLAUDE_CODE_SUBAGENT_MODEL'], 'subagent-router')
  assert.equal(await fs.readFile(homeTarget, 'utf8'), homeContents)
}

async function verifyMalformedMappingBackup(
  ctx: { home: string; projectDir: string },
  target: string,
  mappings: FormValues,
): Promise<void> {
  await fs.writeFile(target, '{ malformed', { mode: 0o600 })
  await assert.rejects(() => saveProjectModelMapping(ctx, mappings), ConfigParseError)
  const replaced = await saveProjectModelMapping(ctx, mappings, true)
  assert.ok(replaced.backupPath !== null)
  assert.equal(
    replaced.backupPath?.startsWith(path.join(ctx.projectDir, '.claude', 'backups', 'ccset')),
    true,
  )
  assert.equal(await fs.readFile(replaced.backupPath ?? '', 'utf8'), '{ malformed')
}

async function verifyProjectModelMappings(home: string): Promise<void> {
  const projectDir = path.join(home, 'workspace')
  const ctx = { home, projectDir }
  const target = projectSettingsPath(projectDir)
  const homeTarget = globalSettingsPath(home)
  const homeContents = `${JSON.stringify({ env: { HOME_ONLY: 'untouched' }, model: 'home-model' }, null, 2)}\n`
  const original: JsonObject = {
    env: {
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'old-haiku',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'old-opus',
      CUSTOM_ENV: { nested: 'keep-me' },
    },
    permissions: { allow: ['Read'] },
  }
  const mappings: FormValues = {
    anthropicModel: 'deepseek-flash[1m]',
    defaultOpusModel: 'opus-router',
    defaultSonnetModel: 'sonnet-router',
    defaultHaikuModel: 'haiku-router',
    subagentModel: 'subagent-router',
  }
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.mkdir(path.dirname(homeTarget), { recursive: true })
  await fs.writeFile(homeTarget, homeContents)
  await fs.writeFile(target, `${JSON.stringify(original, null, 2)}\n`, { mode: 0o600 })
  await verifyMappingWarningAndSeed(ctx)
  await verifyMappingWrites(ctx, target, homeTarget, homeContents, mappings)
  await verifyMalformedMappingBackup(ctx, target, mappings)
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
    await verifyProbeDoesNotFollowRedirects()
    await verifyProjectModelMappings(home)

    process.stdout.write('Provider settings and credential safety verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
