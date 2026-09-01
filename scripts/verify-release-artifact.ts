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
    run('npm', ['run', 'build'])
    const packed = parsePack(run('npm', ['pack', '--json', '--pack-destination', temp]))
    assert.equal(packed.length, 1)
    const artifact = packed[0]
    assert.ok(artifact)
    assert.deepEqual(
      artifact.files.map((file) => file.path).sort(),
      expectedFiles,
    )

    const tarball = path.join(temp, artifact.filename)
    const install = path.join(temp, 'install')
    await fs.mkdir(install)
    run('npm', ['init', '-y'], install)
    run('npm', ['install', tarball], install)

    const installedPackagePath = path.join(install, 'node_modules', '@droite', 'ccset')
    const installedPackage = JSON.parse(
      await fs.readFile(path.join(installedPackagePath, 'package.json'), 'utf8'),
    ) as typeof packageJson
    assert.deepEqual(installedPackage.bin, { ccset: './dist/cli.js' })
    assert.deepEqual(installedPackage.engines, { node: '>=18' })
    assert.deepEqual(installedPackage.publishConfig, { access: 'public' })

    const bundle = path.join(installedPackagePath, 'dist', 'cli.js')
    const bundleText = await fs.readFile(bundle, 'utf8')
    assert.equal(bundleText.startsWith('#!/usr/bin/env node\n'), true)
    const distFiles = await fs.readdir(path.dirname(bundle))
    assert.deepEqual(distFiles, ['cli.js'])
    if (process.platform !== 'win32') {
      assert.notEqual((await fs.stat(bundle)).mode & 0o111, 0)
    }

    // The render gate's library is a devDependency, so installing the artifact
    // must not pull it in: a test renderer has no business on a user's machine.
    const installedModules = await fs.readdir(path.join(install, 'node_modules'))
    assert.equal(installedModules.includes('ink-testing-library'), false)

    const bin = path.join(install, 'node_modules', '.bin', 'ccset')
    assert.equal(run(bin, ['--version'], install).trim(), packageJson.version)
    const nonTty = spawnSync(bin, [], { cwd: install, input: '', encoding: 'utf8' })
    assert.equal(nonTty.status, 2)
    assert.match(nonTty.stderr, /interactive.*terminal/is)
    assert.equal(/\x1b/.test(`${nonTty.stdout}${nonTty.stderr}`), false)

    process.stdout.write('Release artifact verification passed.\n')
  } finally {
    await fs.rm(temp, { recursive: true, force: true })
  }
}

await main()
