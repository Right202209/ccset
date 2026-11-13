import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import packageJson from '../package.json'
import { verifyReleaseState } from './verify-release-state.js'

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
  await verifyForwardingPackage(temp, install)
}

async function verifyForwardingPackage(temp: string, install: string): Promise<void> {
  const source = path.join(process.cwd(), 'packages', 'ccset')
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8')) as {
    name: string
    bin: Record<string, string>
    dependencies: Record<string, string>
    scripts: Record<string, string>
    repository: { url: string; directory: string }
  }
  assert.equal(manifest.name, 'ccset')
  assert.deepEqual(manifest.bin, { ccset: './cli.js' })
  assert.deepEqual(manifest.scripts, { prepublishOnly: 'node ../../scripts/check-release-state.mjs' })
  assert.equal(manifest.repository.url, packageJson.repository.url)
  assert.equal(manifest.repository.directory, 'packages/ccset')
  const targetVersion = manifest.dependencies['@droite/ccset']
  assert.ok(targetVersion)
  assert.match(targetVersion, /^\d+\.\d+\.\d+$/)
  const packed = parsePack(run('npm', ['pack', '--json', '--pack-destination', temp], source))
  assert.equal(packed.length, 1)
  const artifact = packed[0]
  assert.ok(artifact)
  assert.deepEqual(artifact.files.map((file) => file.path).sort(), [
    'LICENSE', 'README.md', 'README.zh-CN.md', 'cli.js', 'package.json',
  ])
  run('npm', ['install', path.join(temp, artifact.filename)], install)
  const cli = path.join(install, 'node_modules', 'ccset', 'cli.js')
  assert.equal((await fs.readFile(cli, 'utf8')).startsWith('#!/usr/bin/env node\n'), true)
  if (process.platform !== 'win32') assert.notEqual((await fs.stat(cli)).mode & 0o111, 0)
  verifyForwardedCommands({ cli, install, home: path.join(temp, 'forwarder-home'), version: targetVersion })
}

function verifyForwardedCommands(options: {
  cli: string
  install: string
  home: string
  version: string
}): void {
  const env = { ...localeFreeEnv(), CCSET_HOME: options.home, CCSET_LOCALE: 'en' }
  const targetPath = createRequire(options.cli).resolve('@droite/ccset/dist/cli.js')
  for (const args of [['--version'], ['--help'], [], ['--unknown-forwarder-option']]) {
    const forwarded = spawnSync(process.execPath, [options.cli, ...args], {
      cwd: options.install, input: '', encoding: 'utf8', env,
    })
    const direct = spawnSync(process.execPath, [targetPath, ...args], {
      cwd: options.install, input: '', encoding: 'utf8', env,
    })
    assert.notEqual(forwarded.status, null)
    assert.equal(forwarded.status, direct.status)
    assert.equal(forwarded.stdout, direct.stdout)
    assert.equal(forwarded.stderr, direct.stderr)
    if (args[0] === '--version') assert.equal(forwarded.stdout.trim(), options.version)
  }
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
  verifyPublishWorkflow(publish)
}

function verifyPublishWorkflow(publish: string): void {
  assert.match(publish, /^permissions: \{\}/m)
  assert.doesNotMatch(publish, /NODE_AUTH_TOKEN|NPM_TOKEN/)
  const jobs = publish.split(/^  publish-forwarder:\n/m)
  assert.equal(jobs.length, 2, 'forwarding publish job missing or duplicated')
  const root = jobs[0]
  const forwarder = jobs[1]
  assert.ok(root)
  assert.ok(forwarder)
  verifyPublishJob(root, 'v')
  verifyPublishJob(forwarder, 'ccset-v')
  assert.doesNotMatch(root, /working-directory:/)
  assert.match(root, /run: node scripts\/check-release-state\.mjs/)
  assert.match(forwarder, /run: node \.\.\/\.\.\/scripts\/check-release-state\.mjs\n        working-directory: packages\/ccset/)
  assert.match(forwarder, /run: npm publish --provenance --access public\n        working-directory: packages\/ccset/)
}

function verifyPublishJob(job: string, prefix: string): void {
  assert.ok(job.includes(`if: github.repository == 'Right202209/ccset' && startsWith(github.event.release.tag_name, '${prefix}')`))
  assert.match(job, /environment: npm-publish/)
  assert.match(job, /permissions:\n      contents: read\n      id-token: write/)
  assert.match(job, /persist-credentials: false/)
  assert.match(job, /node-version: 24/)
  assert.match(job, /registry-url: https:\/\/registry\.npmjs\.org/)
  assert.match(job, /npm ci[\s\S]*npm run typecheck[\s\S]*npm test[\s\S]*npm publish --provenance --access public/)
}

await main()
