import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { executeOperation } from '../src/operations/index.js'
import type { OperationRequest } from '../src/operations/types.js'
import { findAgent } from '../src/registry.js'
import { ConfigParseError, EXIT_USAGE, EXIT_UNKNOWN_AGENT } from '../src/core/errors.js'
import { backupsDir, claudeDir, globalSettingsPath } from '../src/agents/claude-code/paths.js'
import type { Agent } from '../src/types.js'
import '../src/registry.js'

/**
 * M3.1: the Non-interactive seam. The top half crosses the operation seam
 * directly (the deep entry point against a scratch home); the bottom half
 * crosses the process seam through dist/cli.js, which is why this fixture
 * builds first. Together they pin preservation, deletion, dry-run, no-op,
 * output, and the exit codes, and they fail if any of those is mutated.
 */

const found = findAgent('claude-code')
if (found === undefined) throw new Error('the claude-code agent is not registered')
const agent: Agent = found

const UNMANAGED = { hooks: { PreToolUse: 'keep-me' }, env: { USER_MANAGED: 'keep-me' } }

function request(patch: Record<string, unknown>, extra: Record<string, unknown> = {}): OperationRequest {
  return {
    operation: 'global.set',
    patch,
    unsets: [],
    replaceInvalid: false,
    dryRun: false,
    ...extra,
  } as OperationRequest
}

async function seed(home: string, data: object): Promise<string> {
  const target = globalSettingsPath(home)
  await fs.mkdir(claudeDir(home), { recursive: true })
  await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
  return target
}

async function backupCount(home: string): Promise<number> {
  try {
    return (await fs.readdir(backupsDir(home))).length
  } catch {
    return 0
  }
}

async function checkSeamPreservation(home: string): Promise<void> {
  const target = await seed(home, { ...UNMANAGED, model: 'old' })
  const result = await executeOperation(agent, { home }, request({ model: 'new' }))
  assert.equal(result.changed, true)
  assert.equal(result.targets[0]?.backupPath !== null, true)
  const saved = JSON.parse(await fs.readFile(target, 'utf8')) as Record<string, unknown>
  assert.deepEqual(saved['hooks'], UNMANAGED['hooks'], 'an unmanaged top-level key was lost')
  assert.deepEqual(saved['env'], UNMANAGED['env'], 'an unmanaged env sibling was lost')
  assert.equal(saved['model'], 'new')
  assert.equal((await fs.stat(target)).mode & 0o777, 0o600)
}

async function checkSeamDeletion(home: string): Promise<void> {
  const target = await seed(home, {
    env: { HTTPS_PROXY: 'http://old.example', HTTP_PROXY: 'http://old.example' },
    model: 'old',
  })
  const off = await executeOperation(agent, { home }, request({ proxy: false }))
  assert.equal(off.changed, true)
  const afterOff = JSON.parse(await fs.readFile(target, 'utf8')) as Record<string, unknown>
  const env = afterOff['env'] as Record<string, unknown> | undefined
  assert.equal(env !== undefined && 'HTTPS_PROXY' in env, false, 'proxy off did not delete')
  const unset = await executeOperation(agent, { home }, request({}, { unsets: ['model'] }))
  assert.equal(unset.changed, true)
  const afterUnset = JSON.parse(await fs.readFile(target, 'utf8')) as Record<string, unknown>
  assert.equal('model' in afterUnset, false, '--unset did not delete the key')
}

async function checkSeamDryRunAndNoOp(home: string): Promise<void> {
  const target = await seed(home, { model: 'same' })
  const bytes = await fs.readFile(target, 'utf8')
  const dry = await executeOperation(
    agent,
    { home },
    request({ model: 'would-change' }, { dryRun: true }),
  )
  assert.equal(dry.changed, true, 'a dry run must still report what would change')
  assert.equal(dry.targets[0]?.changed, true, 'a dry run record did not report the change')
  assert.equal(dry.targets[0]?.backupPath, null, 'a dry run reported a backup')
  assert.equal(await fs.readFile(target, 'utf8'), bytes, 'a dry run wrote the file')
  assert.equal(await backupCount(home), 0, 'a dry run created a backup')

  const repeat = await executeOperation(agent, { home }, request({ model: 'same' }))
  assert.equal(repeat.changed, false, 'an idempotent patch reported a change')
  assert.equal(repeat.targets[0]?.changed, false)
  assert.equal(await backupCount(home), 0, 'a no-op created a backup')
  assert.equal(await fs.readFile(target, 'utf8'), bytes)
}

async function checkSeamRecovery(home: string): Promise<void> {
  const target = globalSettingsPath(home)
  await fs.mkdir(claudeDir(home), { recursive: true })
  await fs.writeFile(target, '{ not json\n', { mode: 0o600 })
  let caught: unknown
  try {
    await executeOperation(agent, { home }, request({ model: 'x' }))
  } catch (err) {
    caught = err
  }
  assert.ok(caught instanceof ConfigParseError, 'a malformed target was not refused')
  assert.equal(await fs.readFile(target, 'utf8'), '{ not json\n', 'the malformed target was touched')

  const replaced = await executeOperation(
    agent,
    { home },
    request({ model: 'x' }, { replaceInvalid: true }),
  )
  assert.equal(replaced.changed, true)
  const backups = await fs.readdir(backupsDir(home))
  assert.equal(backups.length, 1, 'the replaced original was not backed up')
  const backupText = await fs.readFile(path.join(backupsDir(home), backups[0] ?? ''), 'utf8')
  assert.equal(backupText, '{ not json\n', 'the backup is not the unreadable original')
}

/* ------------------------------------------------- the process seam */

interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

function runCli(args: string[], env: Record<string, string> = {}, input = ''): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), 'dist/cli.js'), ...args], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('close', (code) => resolve({ code, stdout, stderr }))
    child.stdin.end(input)
  })
}

async function expectUsage(args: string[], code: string): Promise<void> {
  const result = await runCli(args)
  assert.equal(result.code, EXIT_USAGE, `${args.join(' ')} did not exit 64: ${result.stderr}`)
  assert.ok(result.stderr.includes(code), `the reason is not named: ${result.stderr}`)
  assert.equal(result.stdout, '')
}

async function checkCliOutputs(home: string): Promise<void> {
  const target = await seed(home, { model: 'old' })
  const json = await runCli(
    ['--agent', 'claude-code', 'global', 'set', '--model', 'cli-model', '--json'],
    { CCSET_HOME: home, CCSET_TOKEN: 'CLI-SECRET-SHOULD-BE-IGNORED' },
  )
  assert.equal(json.code, 0)
  const envelope = JSON.parse(json.stdout) as {
    schemaVersion: number
    operation: string
    ok: boolean
    exitCode: number
    changed: boolean
    targets: { path: string }[]
  }
  assert.equal(envelope.schemaVersion, 1)
  assert.equal(envelope.operation, 'global.set')
  assert.equal(envelope.ok, true)
  assert.equal(envelope.exitCode, 0)
  assert.equal(envelope.changed, true)
  assert.equal(envelope.targets[0]?.path, target)
  assert.equal(json.stdout.includes('CLI-SECRET'), false, 'a secret reached the JSON output')

  const human = await runCli(['--agent', 'claude-code', 'global', 'set', '--model', 'cli-model'], {
    CCSET_HOME: home,
  })
  assert.equal(human.code, 0)
  assert.ok(human.stdout.includes(target), 'the human output does not name the path')
  assert.ok(human.stdout.includes('0600'), 'the human output does not name the mode')
  assert.ok(human.stdout.includes('Changed: no'), 'an idempotent command did not say so')
  assert.equal(`${human.stdout}${human.stderr}`.includes('\x1b'), false, 'ANSI reached the output')
}

async function checkCliExitCodes(home: string): Promise<void> {
  const base = ['--agent', 'claude-code', 'global', 'set']
  await expectUsage([...base, '--model', 'a', '--model', 'b'], 'more than once')
  await expectUsage([...base, '--model', 'a', '--unset', 'model'], 'both set and unset')
  await expectUsage([...base, '--proxy-url', 'not a url'], 'Not a valid URL')
  await expectUsage([...base, '--no-such-option', 'x'], 'Unknown option')
  await expectUsage([...base, '--unset', 'proxy'], 'does not support --unset')
  await expectUsage(['global', 'set', '--model', 'a'], 'explicit agent')

  const unknownAgent = await runCli(['--agent', 'nope', 'global', 'set', '--model', 'a'], {
    CCSET_HOME: home,
  })
  assert.equal(unknownAgent.code, EXIT_UNKNOWN_AGENT, 'an unknown agent did not exit 65')
  const unknownVerb = await runCli(['--agent', 'claude-code', 'frobnicate'], { CCSET_HOME: home })
  assert.equal(unknownVerb.code, EXIT_USAGE, 'an unknown verb did not exit 64')
}

/**
 * A parse-stage failure still owes --json its envelope, and the envelope names
 * what parsing had already recognized: the operation once a declaration
 * matched, an agent only when one was actually named.
 */
async function checkCliFailureEnvelopes(home: string): Promise<void> {
  const emptyPatch = await runCli(['--agent', 'claude-code', 'global', 'set', '--json'], {
    CCSET_HOME: home,
  })
  assert.equal(emptyPatch.code, EXIT_USAGE, 'an empty patch did not exit 64')
  const envelope = JSON.parse(emptyPatch.stdout) as {
    agent: string | null
    operation: string | null
    ok: boolean
    exitCode: number
    error: { code: string }
  }
  assert.equal(envelope.agent, 'claude-code')
  assert.equal(envelope.operation, 'global.set', 'a recognized operation was not named')
  assert.equal(envelope.exitCode, EXIT_USAGE)
  assert.equal(envelope.error?.code, 'cli.usage.emptyPatch')

  const swallowed = await runCli(['--agent', '--json', 'status'], { CCSET_HOME: home })
  assert.equal(swallowed.code, EXIT_USAGE, '--agent before a flag did not exit 64')
  const misread = JSON.parse(swallowed.stdout) as {
    agent: string | null
    error: { code: string }
  }
  assert.equal(misread.agent, null, 'an agent id was read out of the next flag')
  assert.equal(misread.error?.code, 'cli.usage.missingValue')

  await expectUsage(['--agent', 'claude-code', 'status', '--dry-run'], 'dry-run is not accepted')
}

/** A syntax error must precede any read: the malformed target plays no part. */
async function checkSyntaxBeforeReads(home: string): Promise<void> {
  await seed(home, { model: 'old' })
  const target = globalSettingsPath(home)
  await fs.writeFile(target, '{ not json\n', { mode: 0o600 })
  const result = await runCli(
    ['--agent', 'claude-code', 'global', 'set', '--model', 'a', '--model', 'b'],
    { CCSET_HOME: home },
  )
  assert.equal(result.code, EXIT_USAGE, 'a syntax error did not beat the filesystem read')
  assert.equal(await fs.readFile(target, 'utf8'), '{ not json\n', 'the target was touched')
}

async function withHome(label: string, run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `ccset-cmd-${label}-`))
  try {
    await run(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  await withHome('preserve', checkSeamPreservation)
  await withHome('delete', checkSeamDeletion)
  await withHome('noop', checkSeamDryRunAndNoOp)
  await withHome('recover', checkSeamRecovery)
  await withHome('cli-out', checkCliOutputs)
  await withHome('cli-codes', checkCliExitCodes)
  await withHome('cli-failures', checkCliFailureEnvelopes)
  await withHome('cli-order', checkSyntaxBeforeReads)
  process.stdout.write('Non-interactive command verification passed.\n')
}

await main()
