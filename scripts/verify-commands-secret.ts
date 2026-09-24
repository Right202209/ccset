import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { claudeDir, providerSettingsPath } from '../src/agents/claude-code/paths.js'
import { EXIT_INVALID_CONFIG, EXIT_RUNTIME, EXIT_USAGE } from '../src/core/errors.js'
import { runCli as spawnCli, type RunResult } from './cli-harness.js'
import { CcsetError } from '../src/core/errors.js'
import { secretFromStdin } from '../src/commands/secret.js'

/**
 * M3.3: secure Secret sources and Claude Code provider set, across the
 * process seam. CCSET_TOKEN and explicit --token-stdin are the only doors;
 * every other shape -- both together, token flags, positional or file-borne
 * secrets, padded or multi-line or NUL-bearing or oversized values -- is a
 * usage refusal before any write, and the secret never reaches stdout,
 * stderr, JSON, or an error envelope.
 */

const TOKEN = 'M3-SECRET-TOKEN-0123456789'
const OTHER_TOKEN = 'M3-OTHER-TOKEN-0987654321'

/** Every case runs against one scratch home; stdin carries the token cases. */
const runCli = (
  args: string[],
  home: string,
  input: string | Buffer = '',
  env: Record<string, string> = {},
): Promise<RunResult> => spawnCli(args, { CCSET_HOME: home, ...env }, input)

const SET = ['--agent', 'claude-code', 'provider', 'set', 'acme', '--base-url', 'https://acme.example']

async function tokenOf(home: string, name = 'acme'): Promise<unknown> {
  const data = JSON.parse(await fs.readFile(providerSettingsPath(home, name), 'utf8')) as {
    env?: Record<string, unknown>
  }
  return data['env']?.['ANTHROPIC_AUTH_TOKEN']
}

async function checkAllowedSources(home: string): Promise<void> {
  const viaEnv = await runCli(SET, home, '', { CCSET_TOKEN: TOKEN })
  assert.equal(viaEnv.code, 0, `the env source failed: ${viaEnv.stderr}`)
  assert.equal(await tokenOf(home), TOKEN)
  assert.equal(`${viaEnv.stdout}${viaEnv.stderr}`.includes(TOKEN), false, 'env token reached output')

  const viaStdin = await runCli([...SET, '--model', 'm2', '--token-stdin'], home, `${OTHER_TOKEN}\n`)
  assert.equal(viaStdin.code, 0, `the stdin source failed: ${viaStdin.stderr}`)
  assert.equal(await tokenOf(home), OTHER_TOKEN, 'the final stdin line ending was not removed')
  assert.equal(`${viaStdin.stdout}${viaStdin.stderr}`.includes(OTHER_TOKEN), false)
}

async function checkRejectedSources(home: string): Promise<void> {
  const cases: [string[], Record<string, string>, RegExp][] = [
    [[...SET, '--token-stdin'], { CCSET_TOKEN: 'x' }, /not both/],
    [[...SET, '--token', TOKEN], {}, /Unknown option/],
    [[...SET, '--token-file', '/tmp/secret'], {}, /Unknown option/],
    [[...SET, TOKEN], {}, /Unexpected argument/],
  ]
  for (const [args, env, stderr] of cases) {
    const result = await runCli(args, home, 'unused-stdin', env)
    assert.equal(result.code, EXIT_USAGE, `${args.join(' ')} did not exit 64`)
    assert.match(result.stderr, stderr, `${args.join(' ')} refused with the wrong wording`)
    assert.equal(await fs.access(providerSettingsPath(home, 'acme')).then(() => true, () => false), false)
  }
}

async function checkUsageErrorsAreRedacted(home: string): Promise<void> {
  const cases = [
    [...SET, TOKEN, '--json'],
    ['--agent', 'claude-code', 'unknown-command', TOKEN, '--json'],
    ['--agent', TOKEN, 'provider', 'set', 'acme', '--json'],
    [...SET, '--token', TOKEN, '--json'],
    [...SET, `--token=${TOKEN}`, '--json'],
  ]
  for (const [index, args] of cases.entries()) {
    const result = await runCli(args, home)
    assert.notEqual(result.code, 0, `usage case ${index} was unexpectedly accepted`)
    assert.equal(`${result.stdout}${result.stderr}`.includes(TOKEN), false, `usage case ${index} printed the token`)
    if (result.stdout.trim().startsWith('{')) {
      const envelope = JSON.parse(result.stdout) as { error?: { params?: Record<string, string> } }
      assert.equal(JSON.stringify(envelope.error?.params ?? {}).includes(TOKEN), false, 'JSON params leaked the token')
    }
  }
}

async function checkTokenStdinRefusesTty(): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true })
  try {
    await assert.rejects(
      secretFromStdin(),
      (error: Error) => error instanceof CcsetError && error.messageKey === 'cli.secret.ttyInput',
      'an interactive terminal was allowed to echo a token',
    )
  } finally {
    if (descriptor === undefined) Reflect.deleteProperty(process.stdin, 'isTTY')
    else Object.defineProperty(process.stdin, 'isTTY', descriptor)
  }
}

async function checkRejectedValues(home: string): Promise<void> {
  const oversized = 'x'.repeat(64 * 1024 + 1)
  const cases: [string, string][] = [
    [' padded ', 'whitespace'],
    ['two\nlines\n', 'single line'],
    ['nul\0byte', 'NUL'],
    [oversized, '64 KiB'],
  ]
  for (const [token, why] of cases) {
    const result = await runCli([...SET, '--token-stdin'], home, token)
    assert.equal(result.code, EXIT_USAGE, `a ${why} secret was not refused`)
    assert.equal(await fs.access(providerSettingsPath(home, 'acme')).then(() => true, () => false), false)
  }
  // Node would re-encode lone surrogates in a JS string; raw bytes reach the
  // pipe unchanged, which is what an actually invalid sequence needs.
  const invalidUtf8 = await runCli([...SET, '--token-stdin'], home, Buffer.from([0xff, 0xfe]))
  assert.equal(invalidUtf8.code, EXIT_USAGE, 'an invalid UTF-8 secret was not refused')
  const emptyStdin = await runCli([...SET, '--token-stdin'], home, '')
  assert.equal(emptyStdin.code, EXIT_USAGE, 'an empty secret was not refused')
  assert.equal(await fs.access(providerSettingsPath(home, 'acme')).then(() => true, () => false), false)
}

async function checkPatchSemantics(home: string): Promise<void> {
  await fs.mkdir(claudeDir(home), { recursive: true })
  const target = providerSettingsPath(home, 'acme')
  await fs.writeFile(
    target,
    `${JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: TOKEN, CUSTOM: 'keep-me' }, permissions: { allow: ['Read'] } }, null, 2)}\n`,
    { mode: 0o600 },
  )
  const sibling = providerSettingsPath(home, 'sibling')
  await fs.writeFile(sibling, `${JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: OTHER_TOKEN } })}\n`, { mode: 0o600 })

  const patched = await runCli([...SET, '--fallback-model', 'fa', '--fallback-model', 'fb'], home)
  assert.equal(patched.code, 0, `the patch failed: ${patched.stderr}`)
  const saved = JSON.parse(await fs.readFile(target, 'utf8')) as Record<string, unknown>
  assert.deepEqual(saved['permissions'], { allow: ['Read'] }, 'an unmanaged key was lost')
  assert.equal((saved['env'] as Record<string, unknown>)['CUSTOM'], 'keep-me', 'an env sibling was lost')
  assert.deepEqual(saved['fallbackModel'], ['fa', 'fb'], 'the repeatable list did not accumulate')
  const siblingToken = JSON.parse(await fs.readFile(sibling, 'utf8')) as Record<string, unknown>
  assert.equal((siblingToken['env'] as Record<string, unknown>)['ANTHROPIC_AUTH_TOKEN'], OTHER_TOKEN)

  const repeat = await runCli([...SET, '--fallback-model', 'fa', '--fallback-model', 'fb'], home)
  assert.equal(repeat.code, 0)
  assert.match(repeat.stdout, /Changed: no/, 'an idempotent provider patch claimed a change')

  const unset = await runCli([...SET, '--unset', 'fallbackModel'], home)
  assert.equal(unset.code, 0)
  const cleared = JSON.parse(await fs.readFile(target, 'utf8')) as Record<string, unknown>
  assert.equal('fallbackModel' in cleared, false, '--unset did not remove the list')
  assert.equal(await tokenOf(home), TOKEN, 'an omitted secret did not keep the disk token')

  const dry = await runCli([...SET, '--model', 'm9', '--dry-run'], home)
  assert.equal(dry.code, 0)
  assert.equal((JSON.parse(await fs.readFile(target, 'utf8')) as Record<string, unknown>)['model'], undefined)
}

async function checkNewProviderRules(home: string): Promise<void> {
  const noUrl = await runCli(['--agent', 'claude-code', 'provider', 'set', 'fresh', '--token-stdin'], home, TOKEN)
  assert.equal(noUrl.code, EXIT_RUNTIME, 'a new provider was created without a base URL')
  assert.match(noUrl.stderr, /--base-url/)
  const noToken = await runCli(
    ['--agent', 'claude-code', 'provider', 'set', 'fresh', '--base-url', 'https://fresh.example'],
    home,
  )
  assert.equal(noToken.code, EXIT_RUNTIME, 'a new provider was created without a secret')
  assert.match(noToken.stderr, /token from CCSET_TOKEN/)

  const created = await runCli([...SET], home, '', { CCSET_TOKEN: TOKEN })
  assert.equal(created.code, 0, `a complete new provider failed: ${created.stderr}`)
  assert.equal((await fs.stat(providerSettingsPath(home, 'acme'))).mode & 0o777, 0o600)
  assert.equal(await tokenOf(home), TOKEN)
  assert.equal(created.stdout.includes(TOKEN), false)

  // A secret on its own is a legitimate patch against an existing provider.
  const rotated = await runCli(
    ['--agent', 'claude-code', 'provider', 'set', 'acme', '--token-stdin'],
    home,
    `${OTHER_TOKEN}\n`,
  )
  assert.equal(rotated.code, 0, 'a secret-only rotation was refused')
  assert.equal(await tokenOf(home), OTHER_TOKEN)
  assert.equal(`${rotated.stdout}${rotated.stderr}`.includes(OTHER_TOKEN), false)
}

async function checkInvalidTarget(home: string): Promise<void> {
  await fs.mkdir(claudeDir(home), { recursive: true })
  const target = providerSettingsPath(home, 'acme')
  await fs.writeFile(target, '{ broken\n', { mode: 0o600 })
  const refused = await runCli([...SET, '--json'], home, '', { CCSET_TOKEN: TOKEN })
  assert.equal(refused.code, EXIT_INVALID_CONFIG, 'a malformed provider file was not refused')
  const envelope = JSON.parse(refused.stdout) as { error: { code: string } }
  assert.equal(envelope.error.code, 'error.invalidJson')
  assert.equal(await fs.readFile(target, 'utf8'), '{ broken\n')

  const replaced = await runCli([...SET, '--replace-invalid', '--json'], home, '', { CCSET_TOKEN: TOKEN })
  assert.equal(replaced.code, 0, 'a permitted replacement failed')
  const envelope2 = JSON.parse(replaced.stdout) as { targets: { backupPath: string | null }[] }
  assert.ok(envelope2.targets[0]?.backupPath, 'the replaced original was not backed up')
  assert.equal(await tokenOf(home), TOKEN)
}

async function withHome(label: string, run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `ccset-m33-${label}-`))
  try {
    await run(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  await withHome('sources', checkAllowedSources)
  await withHome('reject', checkRejectedSources)
  await withHome('redacted-usage', checkUsageErrorsAreRedacted)
  await checkTokenStdinRefusesTty()
  await withHome('values', checkRejectedValues)
  await withHome('patch', checkPatchSemantics)
  await withHome('new', checkNewProviderRules)
  await withHome('invalid', checkInvalidTarget)
  process.stdout.write('Secret source and provider set verification passed.\n')
}

await main()
