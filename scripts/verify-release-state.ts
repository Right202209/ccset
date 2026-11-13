import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const EXIT_SUCCESS = 0
const EXIT_PUBLISH_REFUSED = 1

interface GuardCase {
  cwd: string
  tag: string
  prefix: string
  expected: number
  actions?: boolean
}

export async function verifyReleaseState(temp: string): Promise<void> {
  const checkout = await createReleaseCheckout(temp)
  const forwarder = path.join(checkout, 'packages', 'ccset')
  const root = { cwd: checkout, prefix: 'v' }
  const forwarded = { cwd: forwarder, prefix: 'ccset-v' }
  const cases: GuardCase[] = [
    { ...root, tag: 'v1.2.3', expected: EXIT_SUCCESS },
    { ...root, tag: 'v1.2.4', expected: EXIT_PUBLISH_REFUSED },
    { ...root, tag: 'ccset-v1.2.3', expected: EXIT_PUBLISH_REFUSED },
    { ...root, tag: 'ccset-v4.5.6', expected: EXIT_PUBLISH_REFUSED },
    { ...root, tag: 'v1.2.3', actions: false, expected: EXIT_PUBLISH_REFUSED },
    { ...forwarded, tag: 'ccset-v4.5.6', expected: EXIT_SUCCESS },
    { ...forwarded, tag: 'ccset-v4.5.7', expected: EXIT_PUBLISH_REFUSED },
    { ...forwarded, tag: 'v4.5.6', expected: EXIT_PUBLISH_REFUSED },
    { ...forwarded, tag: 'v1.2.3', expected: EXIT_PUBLISH_REFUSED },
    { ...forwarded, tag: 'ccset-v4.5.6', actions: false, expected: EXIT_PUBLISH_REFUSED },
  ]
  for (const testCase of cases) assertGuard(testCase)
  const denied = [
    { ...root, tag: 'v1.2.3', expected: EXIT_PUBLISH_REFUSED },
    { ...forwarded, tag: 'ccset-v4.5.6', expected: EXIT_PUBLISH_REFUSED },
  ]
  await fs.writeFile(path.join(checkout, 'tracked.txt'), 'changed\n')
  for (const testCase of denied) assertGuard(testCase)
  await fs.writeFile(path.join(checkout, 'tracked.txt'), 'clean\n')
  await fs.writeFile(path.join(checkout, 'untracked.txt'), 'untracked\n')
  for (const testCase of denied) assertGuard(testCase)
}

async function createReleaseCheckout(temp: string): Promise<string> {
  const checkout = path.join(temp, 'release-state')
  const forwarder = path.join(checkout, 'packages', 'ccset')
  await fs.mkdir(forwarder, { recursive: true })
  await fs.writeFile(path.join(checkout, 'package.json'),
    '{"name":"@droite/ccset","version":"1.2.3"}\n')
  await fs.writeFile(path.join(forwarder, 'package.json'),
    '{"name":"ccset","version":"4.5.6"}\n')
  await fs.writeFile(path.join(checkout, 'tracked.txt'), 'clean\n')
  const commands = [
    ['init', '--quiet'],
    ['config', 'user.name', 'ccset verification'],
    ['config', 'user.email', 'verification@example.invalid'],
    ['add', 'package.json', 'tracked.txt', 'packages'],
    ['commit', '--quiet', '-m', 'fixture'],
  ]
  for (const args of commands) {
    const result = spawnSync('git', args, { cwd: checkout, encoding: 'utf8' })
    assert.equal(result.status, EXIT_SUCCESS, result.stderr)
  }
  return checkout
}

function assertGuard(options: GuardCase): void {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('CCSET_')),
  )
  const result = spawnSync(process.execPath, [path.join(process.cwd(), 'scripts/check-release-state.mjs')], {
    cwd: options.cwd,
    encoding: 'utf8',
    env: {
      ...env,
      GITHUB_ACTIONS: options.actions === false ? 'false' : 'true',
      GITHUB_REF_NAME: options.tag,
    },
  })
  assert.equal(result.status, options.expected, `${options.cwd} / ${options.tag}: ${result.stderr}`)
  assert.equal(result.stdout, '')
  const expectedError = options.expected === EXIT_SUCCESS ? ''
    : `Publishing requires a clean GitHub Release matching ${options.prefix}<version>.\n`
  assert.equal(result.stderr, expectedError)
}
