import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import packageJson from '../package.json'

interface PackResult {
  filename: string
  files: Array<{ path: string }>
}

const expectedFiles = [
  'LICENSE',
  'README.md',
  'README.zh-CN.md',
  'dist/cli.js',
  'package.json',
]

/**
 * npm exports every config value as an npm_config_* variable into the child of
 * an `npm run`, so the developer's ~/.npmrc leaks into the nested install here.
 * npm 12 rejects allow-scripts for a project-scoped install, which fails this
 * gate for a reason that has nothing to do with the artifact.
 */
function installerEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env['npm_config_allow_scripts']
  return env
}

function run(command: string, args: string[], cwd = process.cwd()): string {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: installerEnv() })
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout
}

/** The process environment minus CCSET_*: an inherited CCSET_LOCALE would
 *  localize the TTY refusal and fail the wording match for reasons unrelated
 *  to the artifact -- the same stripping the pty harness applies. */
function localeFreeEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('CCSET_')),
  )
}

/**
 * npm through 11 reported `pack --json` as an array; npm 12 reports an object
 * keyed by package name. CI runs the Node 18/20/22 matrix, whose bundled npm
 * still emits the array, so both shapes have to keep working.
 */
function parsePack(raw: string): PackResult[] {
  const parsed: unknown = JSON.parse(raw)
  if (Array.isArray(parsed)) return parsed as PackResult[]
  assert.ok(parsed !== null && typeof parsed === 'object', 'npm pack --json returned neither')
  return Object.values(parsed as Record<string, PackResult>)
}

async function main(): Promise<void> {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-artifact-'))
  try {
    assert.match(packageJson.scripts.prepublishOnly, /check-release-state\.mjs/)
    await verifyWorkflowSecurity()
    await verifyReleaseState(temp)
    await verifyPackedArtifact(temp)
    process.stdout.write('Release artifact verification passed.\n')
  } finally {
    await fs.rm(temp, { recursive: true, force: true })
  }
}

async function verifyPackedArtifact(temp: string): Promise<void> {
  run('npm', ['run', 'build'])
  const packed = parsePack(run('npm', ['pack', '--json', '--pack-destination', temp]))
  assert.equal(packed.length, 1)
  const artifact = packed[0]
  assert.ok(artifact)
  assert.deepEqual(artifact.files.map((file) => file.path).sort(), expectedFiles)
  const install = path.join(temp, 'install')
  await fs.mkdir(install)
  run('npm', ['init', '-y'], install)
  run('npm', ['install', path.join(temp, artifact.filename)], install)
  await verifyInstalledArtifact(install)
}

async function verifyInstalledArtifact(install: string): Promise<void> {
  const installedPackagePath = path.join(install, 'node_modules', '@droite', 'ccset')
  const installedPackage = JSON.parse(
    await fs.readFile(path.join(installedPackagePath, 'package.json'), 'utf8'),
  ) as typeof packageJson
  assert.deepEqual(installedPackage.bin, { ccset: './dist/cli.js' })
  assert.deepEqual(installedPackage.engines, { node: '>=18' })
  assert.deepEqual(installedPackage.publishConfig, { access: 'public' })
  assert.equal(installedPackage.repository.url, 'https://github.com/Right202209/ccset.git')
  await verifyInstalledBundle(install, installedPackagePath)
}

async function verifyInstalledBundle(install: string, packagePath: string): Promise<void> {
  const bundle = path.join(packagePath, 'dist', 'cli.js')
  const bundleText = await fs.readFile(bundle, 'utf8')
  assert.equal(bundleText.startsWith('#!/usr/bin/env node\n'), true)
  assert.deepEqual(await fs.readdir(path.dirname(bundle)), ['cli.js'])
  if (process.platform !== 'win32') assert.notEqual((await fs.stat(bundle)).mode & 0o111, 0)
  const installedModules = await fs.readdir(path.join(install, 'node_modules'))
  assert.equal(installedModules.includes('ink-testing-library'), false)
  const bin = path.join(install, 'node_modules', '.bin', 'ccset')
  assert.equal(run(bin, ['--version'], install).trim(), packageJson.version)
  const nonTty = spawnSync(bin, [], { cwd: install, input: '', encoding: 'utf8', env: localeFreeEnv() })
  assert.equal(nonTty.status, 2)
  assert.match(nonTty.stderr, /interactive.*terminal/is)
  assert.equal(/\x1b/.test(`${nonTty.stdout}${nonTty.stderr}`), false)
}

async function verifyWorkflowSecurity(): Promise<void> {
  const workflowFiles = [
    '.github/workflows/ci.yml',
    '.github/workflows/deploy-pages.yml',
    '.github/workflows/pages-ci.yml',
    '.github/workflows/publish.yml',
  ]
  for (const file of workflowFiles) {
    const workflow = await fs.readFile(file, 'utf8')
    for (const line of workflow.split('\n').filter((row) => row.includes('uses:'))) {
      assert.match(line, /@[0-9a-f]{40}(?:\s|$)/, `${file} has an unpinned action: ${line}`)
    }
  }
  const deploy = await fs.readFile('.github/workflows/deploy-pages.yml', 'utf8')
  assert.match(deploy, /^permissions: \{\}/m)
  assert.match(deploy, /persist-credentials: false/)
  assert.match(deploy, /pages: write/)
  assert.match(deploy, /id-token: write/)
  const publish = await fs.readFile('.github/workflows/publish.yml', 'utf8')
  assert.match(publish, /id-token: write/)
  assert.match(publish, /npm publish --provenance --access public/)
}

async function verifyReleaseState(temp: string): Promise<void> {
  const checkout = path.join(temp, 'release-state')
  const checkScript = path.join(process.cwd(), 'scripts/check-release-state.mjs')
  await fs.mkdir(checkout)
  await fs.writeFile(path.join(checkout, 'package.json'), '{"version":"1.2.3"}\n')
  await fs.writeFile(path.join(checkout, 'tracked.txt'), 'clean\n')
  run('git', ['init', '--quiet'], checkout)
  run('git', ['config', 'user.name', 'ccset verification'], checkout)
  run('git', ['config', 'user.email', 'verification@example.invalid'], checkout)
  run('git', ['add', 'package.json', 'tracked.txt'], checkout)
  run('git', ['commit', '--quiet', '-m', 'fixture'], checkout)

  const runGuard = (tag: string, actions = true): number | null =>
    spawnSync(process.execPath, [checkScript], {
      cwd: checkout,
      encoding: 'utf8',
      env: {
        ...installerEnv(),
        GITHUB_ACTIONS: actions ? 'true' : 'false',
        GITHUB_REF_NAME: tag,
      },
    }).status

  assert.equal(runGuard('v1.2.3'), 0, 'a clean version-matched checkout was rejected')
  assert.equal(runGuard('v1.2.4'), 1, 'a mismatched release tag was accepted')
  assert.equal(runGuard('v1.2.3', false), 1, 'a local publish was accepted')
  await fs.writeFile(path.join(checkout, 'tracked.txt'), 'changed\n')
  assert.equal(runGuard('v1.2.3'), 1, 'a modified checkout was accepted')
  await fs.writeFile(path.join(checkout, 'tracked.txt'), 'clean\n')
  await fs.writeFile(path.join(checkout, 'untracked.txt'), 'untracked\n')
  assert.equal(runGuard('v1.2.3'), 1, 'an untracked file was accepted')
}

await main()
