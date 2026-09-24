import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
  encoding: 'utf8',
})
const releaseTag = process.env['GITHUB_REF_NAME']
const isGitHubActions = process.env['GITHUB_ACTIONS'] === 'true'
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const dirty = status.status !== 0 || status.stdout.trim().length > 0
const invalidRelease = !isGitHubActions || releaseTag !== `v${packageJson.version}`

if (dirty || invalidRelease) {
  process.stderr.write('Publishing requires a clean GitHub Release matching v<version>.\n')
  process.exitCode = 1
}
