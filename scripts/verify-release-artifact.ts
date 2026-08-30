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

function run(command: string, args: string[], cwd = process.cwd()): string {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout
}

async function main(): Promise<void> {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-artifact-'))
  try {
    run('npm', ['run', 'build'])
    const packed = JSON.parse(
      run('npm', ['pack', '--json', '--pack-destination', temp]),
    ) as PackResult[]
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
