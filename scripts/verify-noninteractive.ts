import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildRequest, findCommand, splitCommandArgv } from '../src/core/command.js'
import { runOperation, type OperationResult } from '../src/core/operation.js'
import {
  EXIT_INVALID_CONFIG,
  EXIT_NOT_TTY,
  EXIT_UNKNOWN_AGENT,
  EXIT_UNKNOWN_COMMAND,
  EXIT_USAGE,
} from '../src/core/errors.js'
import { fileExists } from '../src/core/json-file.js'
import { findAgent } from '../src/registry.js'
import { backupsDir, claudeDir, globalSettingsPath } from '../src/agents/claude-code/paths.js'
import type { JsonObject } from '../src/types.js'

/**
 * M3.1 AC 7: the non-interactive seams, crossed both ways. In-process, a
 * request is built through the agent's declarations and executed through the
 * agent's operation implementation — the same objects the CLI adapter drives.
 * Spawned, `dist/cli.js` runs against a scratch home so the exit codes, the
 * envelopes, and the wording a script actually sees are the ones asserted.
 * The mutation-to-fail discipline applies: flip the no-op detection in
 * core/operation.ts or drop its backupFile call and this fixture must go red.
 */

const CLI = path.join(process.cwd(), 'dist/cli.js')

/** spawnSync reports null when the child died by signal; the sentinel keeps asserts loud. */
const NO_EXIT_STATUS = -1

interface CliRun {
  status: number
  stdout: string
  stderr: string
}

function runCli(args: string[], home: string): CliRun {
  const child = spawnSync(process.execPath, [CLI, ...args], {
    env: { ...process.env, CCSET_HOME: home },
    encoding: 'utf8',
  })
  return { status: child.status ?? NO_EXIT_STATUS, stdout: child.stdout ?? '', stderr: child.stderr ?? '' }
}

async function seed(home: string, data: JsonObject): Promise<void> {
  await fs.mkdir(claudeDir(home), { recursive: true })
  await fs.writeFile(globalSettingsPath(home), `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
}

async function seedMalformed(home: string): Promise<void> {
  await fs.mkdir(claudeDir(home), { recursive: true })
  await fs.writeFile(globalSettingsPath(home), '{ broken', { mode: 0o600 })
}

async function readSettings(home: string): Promise<JsonObject> {
  return JSON.parse(await fs.readFile(globalSettingsPath(home), 'utf8')) as JsonObject
}

/** The operation seam, crossed in-process exactly as the CLI adapter does. */
async function runSeam(home: string, args: string[]): Promise<OperationResult> {
  const agent = findAgent('claude-code')
  assert.ok(agent !== undefined, 'claude-code is in the registry')
  assert.ok(agent.getCommands !== undefined, 'claude-code declares commands')
  assert.ok(agent.getOperation !== undefined, 'claude-code exposes an operation')
  const decl = findCommand(agent.getCommands(), 'global', 'set')
  assert.ok(decl !== undefined, 'global.set is declared')
  const req = buildRequest(decl, splitCommandArgv(args), agent.id)
  const op = agent.getOperation(req.operation, { home })
  assert.ok(op !== undefined, 'global.set has an operation implementation')
  return runOperation(req, op)
}

async function withHome(label: string, run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `ccset-ni-${label}-`))
  try {
    await run(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

/** N1: a patch touches only its own keys; omitted and unmanaged keys survive. */
async function checkPreservation(home: string): Promise<void> {
  await seed(home, { model: 'old', hooks: { pre: 'keep' }, env: { OTHER: 'keep' } })
  const result = await runSeam(home, ['global', 'set', '--model', 'new'])
  assert.equal(result.exitCode, 0)
  assert.equal(result.changed, true)
  assert.equal(result.targets[0]?.path, globalSettingsPath(home))
  const data = await readSettings(home)
  assert.equal(data['model'], 'new')
  assert.deepEqual(data['hooks'], { pre: 'keep' })
  assert.deepEqual(data['env'], { OTHER: 'keep' })
}

/** N2: removal is explicit, and the proxy toggle deletes both of its keys. */
async function checkDeletion(home: string): Promise<void> {
  await seed(home, {
    model: 'gone',
    env: { HTTPS_PROXY: 'http://p', HTTP_PROXY: 'http://p', OTHER: 'keep' },
  })
  await runSeam(home, ['global', 'set', '--unset', 'model', '--unset', 'proxyEnabled'])
  const data = await readSettings(home)
  assert.equal('model' in data, false)
  assert.deepEqual(data['env'], { OTHER: 'keep' })
}

/** N3: a dry run reports the plan — real mode, no backup, nothing written. */
async function checkDryRun(home: string): Promise<void> {
  await seed(home, { model: 'old' })
  const run = runCli([
    '--agent', 'claude-code', 'global', 'set', '--model', 'new', '--dry-run', '--json',
  ], home)
  assert.equal(run.status, 0, run.stderr)
  const envelope = JSON.parse(run.stdout) as Record<string, any>
  assert.equal(envelope.dryRun, true)
  assert.equal(envelope.changed, true)
  assert.equal(envelope.targets[0].backupPath, null)
  assert.equal(envelope.targets[0].mode, '0600')
  assert.equal(envelope.targets[0].path, globalSettingsPath(home))
  assert.equal((await readSettings(home))['model'], 'old', 'a dry run wrote the file')
  assert.equal(await fileExists(backupsDir(home)), false, 'a dry run created a backup')

  const human = runCli(['--agent', 'claude-code', 'global', 'set', '--model', 'new', '--dry-run'], home)
  assert.equal(human.status, 0, human.stderr)
  assert.ok(human.stdout.includes('Would change:'), human.stdout)
  assert.ok(human.stdout.includes('(dry run'), human.stdout)
}

/** N4: an idempotent patch reports changed:false and skips the backup. */
async function checkNoOp(home: string): Promise<void> {
  await seed(home, { model: 'same' })
  const run = runCli(['--agent', 'claude-code', 'global', 'set', '--model', 'same', '--json'], home)
  assert.equal(run.status, 0, run.stderr)
  const envelope = JSON.parse(run.stdout) as Record<string, any>
  assert.equal(envelope.changed, false)
  assert.equal(envelope.targets[0].backupPath, null)
  assert.equal(await fileExists(backupsDir(home)), false, 'a no-op rotated a backup')
}

/** N5: the success envelope shape, --json before --agent, and no secrets. */
async function checkEnvelope(home: string): Promise<void> {
  await seed(home, {})
  const run = runCli(['--json', '--agent', 'claude-code', 'global', 'set', '--model', 'm'], home)
  assert.equal(run.status, 0, run.stderr)
  const envelope = JSON.parse(run.stdout) as Record<string, any>
  assert.deepEqual(
    Object.keys(envelope).sort(),
    ['agentId', 'changed', 'dryRun', 'exitCode', 'operation', 'schemaVersion', 'targets', 'warnings'],
  )
  assert.deepEqual(Object.keys(envelope.targets[0]).sort(), ['backupPath', 'changed', 'mode', 'path'])
  assert.deepEqual(envelope.warnings, [])
  assert.equal(envelope.operation, 'global.set')
  assert.equal(envelope.agentId, 'claude-code')
  assert.equal(envelope.exitCode, run.status)
  assert.equal(run.stdout.includes('token'), false)
}

/** N6: every documented failure code, refused before the target is read. */
async function checkExitCodes(home: string): Promise<void> {
  // The target is malformed on purpose: any path that read it first would
  // exit 4 instead of the documented code.
  await seedMalformed(home)
  const usageCases: string[][] = [
    ['global', 'set', '--model', 'x'],                                        // no agent
    ['--agent', 'claude-code', 'global', 'set', '--dry-run'],                  // empty patch
    ['--agent', 'claude-code', 'global', 'set', '--model', 'a', '--model', 'b'], // duplicate scalar
    ['--agent', 'claude-code', 'global', 'set', '--bogus', 'x'],               // unknown option
    ['--agent', 'claude-code', 'global', 'set', '--model'],                    // missing value
    ['--agent', 'claude-code', 'global', 'set', '--model', ''],                // empty value
    ['--agent', 'claude-code', 'global', 'set', '--proxyEnabled', 'true'],     // coupled URL missing
    ['--agent', 'claude-code', 'global', 'set', '--proxyEnabled', 'yes'],      // non-boolean
    ['--agent', 'claude-code', 'global', 'set', '--token-stdin'],              // deferred to M3.3
  ]
  for (const args of usageCases) {
    const run = runCli(args, home)
    assert.equal(run.status, EXIT_USAGE, `exit ${run.status} for: ${args.join(' ')}\n${run.stderr}`)
  }
  const identityCases: Array<[string[], number]> = [
    [['--agent', 'nope', 'global', 'set', '--model', 'x'], EXIT_UNKNOWN_AGENT],
    [['--agent', 'claude-code', 'global', 'get'], EXIT_UNKNOWN_COMMAND],
    [['--agent', 'opencode', 'global', 'set', '--model', 'x'], EXIT_UNKNOWN_COMMAND],
  ]
  for (const [args, expected] of identityCases) {
    const run = runCli(args, home)
    assert.equal(run.status, expected, `exit ${run.status} for: ${args.join(' ')}\n${run.stderr}`)
  }
  assert.equal((await fs.readFile(globalSettingsPath(home), 'utf8')), '{ broken',
    'a refused invocation touched the target')
}

/** N7: a malformed target is refused (4), recoverable only by explicit flag. */
async function checkMalformed(home: string): Promise<void> {
  await seedMalformed(home)
  const refused = runCli(['--agent', 'claude-code', 'global', 'set', '--model', 'x', '--json'], home)
  assert.equal(refused.status, EXIT_INVALID_CONFIG, refused.stderr)
  const envelope = JSON.parse(refused.stdout) as Record<string, any>
  assert.equal(envelope.exitCode, refused.status)
  assert.equal(envelope.operation, 'global.set')
  assert.equal(envelope.agentId, 'claude-code')
  assert.equal(envelope.error.reason.code, 'error.invalidJson')
  assert.equal(await fs.readFile(globalSettingsPath(home), 'utf8'), '{ broken')

  const recovered = runCli([
    '--agent', 'claude-code', 'global', 'set', '--model', 'x', '--replace-invalid', '--json',
  ], home)
  assert.equal(recovered.status, 0, recovered.stderr)
  const ok = JSON.parse(recovered.stdout) as Record<string, any>
  assert.equal(ok.warnings[0].code, 'replacedInvalid')
  assert.notEqual(ok.targets[0].backupPath, null, 'the unreadable original was not backed up')
  assert.equal((await readSettings(home))['model'], 'x')
}

/** N8: no subcommand keeps the TUI's TTY refusal, even with an agent named. */
async function checkTtyBoundary(home: string): Promise<void> {
  const run = runCli(['--agent', 'claude-code'], home)
  assert.equal(run.status, EXIT_NOT_TTY)
  assert.ok(run.stderr.includes('needs a terminal'), run.stderr)
}

async function main(): Promise<void> {
  await withHome('preserve', checkPreservation)
  await withHome('delete', checkDeletion)
  await withHome('dryrun', checkDryRun)
  await withHome('noop', checkNoOp)
  await withHome('envelope', checkEnvelope)
  await withHome('codes', checkExitCodes)
  await withHome('malformed', checkMalformed)
  await withHome('tty', checkTtyBoundary)
  process.stdout.write('Non-interactive verification passed.\n')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
