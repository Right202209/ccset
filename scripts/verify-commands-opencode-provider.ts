import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { opencodeConfigPath } from '../src/agents/opencode/paths.js'
import { EXIT_RUNTIME, EXIT_USAGE } from '../src/core/errors.js'

/**
 * M3.5: opencode provider set with per-model merge, across the process seam.
 * A patch may add and drop model ids one at a time -- the options under a
 * retained model id must stay byte-equivalent, unmanaged siblings of the
 * managed keys survive, a secret lands only in the named block, and nothing
 * is activated. The fixture goes red if the model map is written wholesale.
 */

const OLD_KEY = 'OC-PROVIDER-OLD-KEY-0123456789'
const NEW_KEY = 'OC-PROVIDER-NEW-KEY-0987654321'

const ORIGINAL = `{
  "theme": "tokyonight",
  "provider": {
    "hand-written": { "npm": "@ai-sdk/openai-compatible", "options": { "baseURL": "https://keep.me" } },
    "router": {
      "options": { "baseURL": "https://old.example", "apiKey": "${OLD_KEY}", "headers": { "x-custom": "keep" } },
      "models": {
        "model-keep": { "name": "Keep me", "options": { "temperature": 0.2 } },
        "model-drop": {}
      }
    }
  }
}
`

interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

function runCli(args: string[], home: string, input = ''): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), 'dist/cli.js'), ...args], {
      env: { ...process.env, CCSET_HOME: home },
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

async function seed(home: string): Promise<string> {
  const target = opencodeConfigPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, ORIGINAL, { mode: 0o600 })
  return target
}

async function configOf(home: string): Promise<Record<string, any>> {
  return JSON.parse(await fs.readFile(opencodeConfigPath(home), 'utf8'))
}

const SET = ['--agent', 'opencode', 'provider', 'set', 'router', '--base-url', 'https://new.example']

async function checkPerModelMerge(home: string): Promise<void> {
  await seed(home)
  const result = await runCli([...SET, '--model', 'model-keep', '--model', 'model-new', '--json'], home)
  assert.equal(result.code, 0, `provider set failed: ${result.stderr}`)
  const router = (await configOf(home))['provider']['router']
  assert.deepEqual(
    router['models']['model-keep'],
    { name: 'Keep me', options: { temperature: 0.2 } },
    'a retained model lost its per-model options',
  )
  assert.equal('model-drop' in router['models'], false, 'a dropped model id survived')
  assert.deepEqual(router['models']['model-new'], {}, 'a new model id was not added')
  assert.deepEqual(router['options']['headers'], { 'x-custom': 'keep' }, 'an unmanaged sibling was lost')
  assert.equal(router['options']['apiKey'], OLD_KEY, 'an omitted secret disturbed the disk key')
  assert.equal(
    (await configOf(home))['provider']['hand-written']['options']['baseURL'],
    'https://keep.me',
    'an unrelated provider block changed',
  )
  assert.equal(JSON.stringify(router).includes('opencode'), false)
}

async function checkSecretAndNewProvider(home: string): Promise<void> {
  await seed(home)
  const rotated = await runCli([...SET, '--token-stdin', '--json'], home, `${NEW_KEY}\n`)
  assert.equal(rotated.code, 0, 'a secret rotation failed')
  const router = (await configOf(home))['provider']['router']
  assert.equal(router['options']['apiKey'], NEW_KEY, 'the secret did not land in the named block')
  assert.equal(`${rotated.stdout}${rotated.stderr}`.includes(NEW_KEY), false, 'the secret reached output')

  const created = await runCli(
    ['--agent', 'opencode', 'provider', 'set', 'fresh', '--base-url', 'https://f.example', '--npm', '@ai-sdk/anthropic', '--token-stdin'],
    home,
    `${OLD_KEY}\n`,
  )
  assert.equal(created.code, 0, 'a complete new provider failed')
  const fresh = (await configOf(home))['provider']['fresh']
  assert.equal(fresh['options']['apiKey'], OLD_KEY)
  assert.deepEqual(fresh['models'], undefined, 'a new provider grew a models map out of nowhere')

  const noUrl = await runCli(['--agent', 'opencode', 'provider', 'set', 'second', '--token-stdin'], home, NEW_KEY)
  assert.equal(noUrl.code, EXIT_RUNTIME, 'a new provider was created without a base URL')
  const noKey = await runCli(['--agent', 'opencode', 'provider', 'set', 'second', '--base-url', 'https://s.example'], home)
  assert.equal(noKey.code, EXIT_RUNTIME, 'a new provider was created without a secret')
  assert.equal(await fs.access(opencodeConfigPath(home)).then(() => true, () => false), true)
  const config = await configOf(home)
  assert.equal(config['provider']['second'], undefined, 'a refused provider was still written')
}

async function checkUnsetNoOpDryRun(home: string): Promise<void> {
  await seed(home)
  const timeout = await runCli([...SET, '--timeout', '4000'], home)
  assert.equal(timeout.code, 0)
  let router = (await configOf(home))['provider']['router']
  assert.equal(router['options']['timeout'], 4000, 'the int field was not a number')

  const unsetModels = await runCli([...SET, '--unset', 'models'], home)
  assert.equal(unsetModels.code, 0)
  router = (await configOf(home))['provider']['router']
  assert.equal('models' in router, false, '--unset models did not delete the map')

  const repeat = await runCli([...SET, '--unset', 'models'], home)
  assert.equal(repeat.code, 0)
  assert.match(repeat.stdout, /Changed: no/, 'an idempotent provider patch claimed a change')

  const dry = await runCli([...SET, '--display-name', 'Router', '--dry-run', '--json'], home)
  assert.equal(dry.code, 0)
  const envelope = JSON.parse(dry.stdout) as { changed: boolean; targets: { backupPath: string | null }[] }
  assert.equal(envelope.changed, true)
  assert.equal(envelope.targets[0]?.backupPath, null)
  router = (await configOf(home))['provider']['router']
  assert.equal(router['displayName'] ?? router['name'], undefined, 'a dry run wrote the block')

  const reserved = await runCli(['--agent', 'opencode', 'provider', 'set', 'openai', '--base-url', 'https://x.example'], home)
  assert.equal(reserved.code, EXIT_USAGE, 'a reserved provider id was not a usage error')
  const badUrl = await runCli([...SET, '--base-url', 'not a url'], home)
  assert.equal(badUrl.code, EXIT_USAGE, 'an invalid base URL was not a usage error')
}

async function checkRecovery(home: string): Promise<void> {
  await seed(home)
  await fs.writeFile(opencodeConfigPath(home), '{ broken\n', { mode: 0o600 })
  const refused = await runCli([...SET, '--model', 'm1'], home)
  assert.equal(refused.code, 4, 'a malformed document was not refused')
  assert.equal(await fs.readFile(opencodeConfigPath(home), 'utf8'), '{ broken\n')

  // A replacement rebuilds from an empty base, so the new-provider rules
  // apply and the invocation has to carry a complete, usable configuration.
  const replaced = await runCli(
    [...SET, '--model', 'm1', '--replace-invalid', '--token-stdin', '--json'],
    home,
    `${NEW_KEY}\n`,
  )
  assert.equal(replaced.code, 0, 'a permitted replacement failed')
  const envelope = JSON.parse(replaced.stdout) as { targets: { backupPath: string | null }[] }
  assert.ok(envelope.targets[0]?.backupPath, 'the unreadable original was not backed up')
  const rebuilt = (await configOf(home))['provider']['router']
  assert.equal(rebuilt['options']['apiKey'], NEW_KEY)
}

async function withHome(label: string, run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `ccset-m35-${label}-`))
  try {
    await run(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  await withHome('merge', checkPerModelMerge)
  await withHome('secret', checkSecretAndNewProvider)
  await withHome('unset', checkUnsetNoOpDryRun)
  await withHome('recover', checkRecovery)
  process.stdout.write('opencode provider set verification passed.\n')
}

await main()
