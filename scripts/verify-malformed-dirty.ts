import assert from 'node:assert/strict'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { backupsDir, globalSettingsPath } from '../src/agents/claude-code/paths.js'

const ANSI = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g
const DOWN = '\x1b[B'
const UP = '\x1b[A'
const ENTER = '\r'
const ESC = '\x1b'

const PTY_BRIDGE = `
import os, pty, select, sys
pid, fd = pty.fork()
if pid == 0:
    os.execvpe(sys.argv[1], sys.argv[1:], os.environ)
while True:
    readable, _, _ = select.select([fd, sys.stdin.buffer], [], [])
    if sys.stdin.buffer in readable:
        data = os.read(sys.stdin.fileno(), 4096)
        if not data:
            break
        os.write(fd, data)
    if fd in readable:
        try:
            data = os.read(fd, 4096)
        except OSError:
            break
        if not data:
            break
        os.write(sys.stdout.fileno(), data)
`

function plain(text: string): string {
  return text.replace(ANSI, '').replace(/\r/g, '')
}

class CliSession {
  private readonly child: ChildProcessWithoutNullStreams
  private output = ''

  constructor(home: string) {
    // --agent names the agent under test rather than letting the run stop on
    // the selection Screen, which exists now that a second agent is registered.
    // It is also the only coverage the flag has against more than one legal id.
    this.child = spawn('python3', [
      '-c',
      PTY_BRIDGE,
      'node',
      'dist/cli.js',
      '--agent',
      'claude-code',
    ], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: home, LANG: 'C', LC_ALL: 'C', TERM: 'xterm-256color' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child.stdout.on('data', (chunk: Buffer) => {
      this.output += chunk.toString('utf8')
    })
    this.child.stderr.on('data', (chunk: Buffer) => {
      this.output += chunk.toString('utf8')
    })
  }

  send(input: string): void {
    this.child.stdin.write(input)
  }

  async sendEach(input: string, count: number): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      this.send(input)
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  async waitFor(text: string, from = 0): Promise<number> {
    const deadline = Date.now() + 5_000
    while (Date.now() < deadline) {
      const index = plain(this.output).indexOf(text, from)
      if (index >= 0) return index
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error(`Timed out waiting for ${JSON.stringify(text)}. Output:\n${plain(this.output)}`)
  }

  snapshot(): string {
    return plain(this.output)
  }

  async stop(): Promise<void> {
    if (this.child.exitCode === null) this.child.kill('SIGTERM')
    await new Promise<void>((resolve) => {
      if (this.child.exitCode !== null) resolve()
      else this.child.once('exit', () => resolve())
    })
  }
}

async function backupFiles(home: string): Promise<string[]> {
  try {
    return await fs.readdir(backupsDir(home))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

async function openGlobal(session: CliSession, from = 0): Promise<number> {
  await session.waitFor('Global settings', from)
  await new Promise((resolve) => setTimeout(resolve, 100))
  session.send(ENTER)
  return session.waitFor('esc cancel', from)
}

async function verifyMalformedRecovery(home: string): Promise<void> {
  const target = globalSettingsPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, '{"unmanaged":"original"}\n', { mode: 0o600 })
  const session = new CliSession(home)
  try {
    let cursor = await openGlobal(session)
    session.send(' ')
    await fs.writeFile(target, '{ malformed fixture\n', { mode: 0o600 })
    const malformed = await fs.readFile(target, 'utf8')
    await session.sendEach(DOWN, 8)
    await new Promise((resolve) => setTimeout(resolve, 250))
    session.send(ENTER)
    cursor = await session.waitFor('File is not valid JSON', cursor)
    assert.match(session.snapshot().slice(cursor), /Back it up and start fresh/)

    session.send(ENTER)
    cursor = await session.waitFor('esc cancel', cursor + 1)
    assert.equal(await fs.readFile(target, 'utf8'), malformed)
    assert.deepEqual(await backupFiles(home), [])
    const returnedForm = session.snapshot().slice(session.snapshot().lastIndexOf('Global settings'))
    assert.match(returnedForm, /Proxy\s+\* On/)

    await session.sendEach(DOWN, 8)
    await new Promise((resolve) => setTimeout(resolve, 250))
    session.send(ENTER)
    cursor = await session.waitFor('File is not valid JSON', cursor + 1)
    session.send(UP)
    await new Promise((resolve) => setTimeout(resolve, 250))
    session.send(ENTER)
    await session.waitFor('Global settings saved', cursor)

    const names = await backupFiles(home)
    assert.equal(names.length, 1)
    assert.equal(await fs.readFile(path.join(backupsDir(home), names[0]!), 'utf8'), malformed)
    const saved = JSON.parse(await fs.readFile(target, 'utf8')) as Record<string, unknown>
    assert.equal(saved['unmanaged'], undefined)
    assert.equal((saved['env'] as Record<string, unknown>)['HTTPS_PROXY'], 'http://127.0.0.1:7890')
  } finally {
    await session.stop()
  }
}

async function verifyDirtyExit(home: string): Promise<void> {
  const session = new CliSession(home)
  try {
    let cursor = await openGlobal(session)
    session.send(ESC)
    cursor = await session.waitFor('Global settings', cursor + 1)
    assert.equal(session.snapshot().slice(cursor).includes('Unsaved edits'), false)

    cursor = await openGlobal(session, cursor)
    session.send(' ')
    await new Promise((resolve) => setTimeout(resolve, 500))
    session.send(ESC)
    cursor = await session.waitFor('Unsaved edits', cursor)
    session.send(ENTER)
    cursor = await session.waitFor('esc cancel', cursor + 1)
    const returnedForm = session.snapshot().slice(session.snapshot().lastIndexOf('Global settings'))
    assert.match(returnedForm, /Proxy\s+\* On/)

    await session.sendEach(DOWN, 9)
    await new Promise((resolve) => setTimeout(resolve, 250))
    session.send(ENTER)
    cursor = await session.waitFor('Unsaved edits', cursor + 1)
    session.send(UP)
    await new Promise((resolve) => setTimeout(resolve, 250))
    session.send(ENTER)
    await session.waitFor('Global settings', cursor + 1)
  } finally {
    await session.stop()
  }
}

async function main(): Promise<void> {
  assert.equal(process.platform, 'linux', 'built-CLI PTY verification currently requires Linux')
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-malformed-dirty-'))
  try {
    await verifyMalformedRecovery(home)
    await fs.rm(home, { recursive: true, force: true })
    await fs.mkdir(home)
    await verifyDirtyExit(home)
    process.stdout.write('Malformed recovery and dirty-exit verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
