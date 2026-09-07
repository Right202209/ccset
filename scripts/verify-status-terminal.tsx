import assert from 'node:assert/strict'
import React from 'react'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { render } from 'ink-testing-library'
import { buildStatus } from '../src/agents/claude-code/status.js'
import { maskSecret } from '../src/core/mask.js'
import { activationCommand, claudeDir, providerSettingsPath } from '../src/agents/claude-code/paths.js'
import { UNICODE_TERMINAL, TerminalContext } from '../src/ui/terminal.js'
import { stripAnsi } from './ui-assertions.js'
import { StatusView } from '../src/ui/Status.js'
import { ViewportProvider } from '../src/ui/Viewport.js'
import type { StatusScreen } from '../src/types.js'

const DOWN = '\x1b[B'

const token = 'STATUS-TEST-TOKEN-1234567890'
const longBaseUrl = `https://provider.example/${'long-path-segment/'.repeat(8)}v1`

interface CommandResult {
  code: number | null
  stdout: string
  stderr: string
}

function run(command: string, args: string[], input?: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
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

async function verifyStatus(home: string): Promise<void> {
  const directory = claudeDir(home)
  await fs.mkdir(directory, { recursive: true })
  const completePath = providerSettingsPath(home, 'complete')
  const incompletePath = providerSettingsPath(home, 'incomplete')
  const malformedPath = providerSettingsPath(home, 'malformed')
  await fs.writeFile(
    completePath,
    `${JSON.stringify({
      env: { ANTHROPIC_BASE_URL: longBaseUrl, ANTHROPIC_AUTH_TOKEN: token },
      model: 'status-model',
    }, null, 2)}\n`,
  )
  await fs.writeFile(incompletePath, `${JSON.stringify({ env: { CUSTOM: true } }, null, 2)}\n`)
  await fs.writeFile(malformedPath, '{ invalid json\n')

  const status = await buildStatus({ home })
  assert.deepEqual(status.providers.map((provider) => provider.name), [
    'complete',
    'incomplete',
    'malformed',
  ])
  assert.equal(status.providers[0]?.command, activationCommand(completePath))
  assert.equal(path.isAbsolute(completePath), true)
  assert.equal(status.providers[1]?.parsed, true)
  assert.equal(status.providers[1]?.problemKey, 'claudeCode.status.noBaseUrl')
  assert.equal(status.providers[2]?.parsed, false)
  assert.equal(status.providers[2]?.problemKey, 'status.parseError')

  const renderedData = JSON.stringify(status.sections)
  assert.equal(renderedData.includes(token), false)
  assert.equal(renderedData.includes(maskSecret(token)), true)
  assert.equal(renderedData.includes(activationCommand(completePath)), true)
  assert.equal(renderedData.includes(longBaseUrl), true)
  for (const filePath of [completePath, incompletePath, malformedPath]) {
    assert.equal(renderedData.includes(filePath), true)
  }

  const addedPath = providerSettingsPath(home, 'added-after-first-read')
  await fs.writeFile(addedPath, `${JSON.stringify({ env: { ANTHROPIC_BASE_URL: longBaseUrl } })}\n`)
  const refreshed = await buildStatus({ home })
  assert.equal(refreshed.providers.some((provider) => provider.path === addedPath), true)
}

async function verifyCliBoundary(): Promise<void> {
  const cli = path.join(process.cwd(), 'dist/cli.js')
  const packageJson = JSON.parse(await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')) as {
    version: string
  }
  const version = await run(process.execPath, [cli, '--version'])
  assert.equal(version.code, 0)
  assert.equal(version.stdout.trim(), packageJson.version)
  assert.equal(version.stderr, '')

  const piped = await run(process.execPath, [cli], '')
  assert.equal(piped.code, 2)
  assert.match(piped.stderr, /terminal/i)
  assert.equal(`${piped.stdout}${piped.stderr}`.includes('\x1b'), false)
}

/** lastFrame carries ANSI attributes; the text itself is what asserts read. */
function stripAnsi(paint: string): string {
  // eslint-disable-next-line no-control-regex
  return paint.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '')
}

const SCROLL_POLL_MS = 10

/**
 * A Status taller than its row budget must still reach its last section: with
 * the window pinned at zero the later diagnostics never rendered anywhere.
 */
async function verifyStatusScrolls(): Promise<void> {
  const sections = Array.from({ length: 20 }, (_, index) => ({
    title: `Section ${index + 1}`,
    lines: [{ label: 'Detail', value: `value-${index + 1}` }],
  }))
  const screen: StatusScreen = { kind: 'status', title: 'Status', sections, items: [] }
  const instance = render(
    <TerminalContext.Provider value={UNICODE_TERMINAL}>
      <ViewportProvider viewport={{ rows: 12, columns: 80 }}>
        <StatusView screen={screen} onSelect={() => undefined} />
      </ViewportProvider>
    </TerminalContext.Provider>,
  )
  try {
    const pinned = stripAnsi(instance.lastFrame() ?? '')
    assert.ok(pinned.includes('Section 1'), 'the first section did not render')
    assert.equal(pinned.includes('Section 20'), false, 'the budget did not cut anything')
    for (let press = 0; press < 60; press += 1) {
      instance.stdin.write(DOWN)
      await new Promise((resolve) => setTimeout(resolve, SCROLL_POLL_MS))
    }
    const scrolled = stripAnsi(instance.lastFrame() ?? '')
    assert.ok(
      scrolled.includes('Section 20'),
      `the last section never became reachable:\n${scrolled}`,
    )
  } finally {
    instance.unmount()
  }
}

async function main(): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-status-'))
  try {
    await verifyStatus(home)
    await verifyCliBoundary()
    await verifyStatusScrolls()
    process.stdout.write('Status and terminal boundary verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
