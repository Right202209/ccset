import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

/**
 * Harness for the built-CLI gates. Not a gate itself -- it holds no assertion
 * about ccset's behaviour, only the machinery for driving the bundled binary
 * through a real PTY: send keys, wait for text, read the scrollback back.
 * Extracted from verify-malformed-dirty so a second gate reuses the same
 * bridge instead of a drifting copy, and so neither file outgrows the limit.
 */

export const DOWN = '\x1b[B'
export const UP = '\x1b[A'
export const ENTER = '\r'
export const ESC = '\x1b'
export const CTRL_C = '\x03'

/** Pause between keypresses so the PTY delivers them as separate reads. */
export const KEY_DELAY_MS = 150

const ANSI = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g

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

export function plain(text: string): string {
  return text.replace(ANSI, '').replace(/\r/g, '')
}

/**
 * Ink refuses to paint interactive frames once `is-in-ci` fires, so a session
 * driven through a real PTY has to look like a user terminal, not a CI job.
 * `CI` itself and every `CI_` relative are dropped; GITHUB_ACTIONS survives,
 * because supports-color reads it to keep color on. `extra` carries the
 * variables under test (CCSET_LOCALE, ...); every other CCSET_* variable is
 * deleted, so one exported in the driving shell cannot leak into a scenario
 * that needs its absence.
 */
export function terminalEnv(home: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    LANG: 'C',
    LC_ALL: 'C',
    TERM: 'xterm-256color',
    ...extra,
  }
  for (const key of Object.keys(env)) {
    if (key === 'CI' || key === 'CONTINUOUS_INTEGRATION' || key.startsWith('CI_')) delete env[key]
  }
  for (const key of ['CCSET_LOCALE', 'CCSET_ASCII', 'CCSET_HOME']) {
    if (!(key in extra)) delete env[key]
  }
  return env
}

export interface CliSessionOptions {
  /** Full argv for the bridged command, e.g. ['node', 'dist/cli.js']. */
  args: string[]
  env: NodeJS.ProcessEnv
}

export class CliSession {
  private readonly child: ChildProcessWithoutNullStreams
  private output = ''
  private readonly exitCode: Promise<number | null>

  constructor(options: CliSessionOptions) {
    this.child = spawn('python3', ['-c', PTY_BRIDGE, ...options.args], {
      cwd: process.cwd(),
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child.stdout.on('data', (chunk: Buffer) => {
      this.output += chunk.toString('utf8')
    })
    this.child.stderr.on('data', (chunk: Buffer) => {
      this.output += chunk.toString('utf8')
    })
    this.exitCode = new Promise((resolve) => {
      this.child.once('exit', (code) => resolve(code))
    })
  }

  send(input: string): void {
    this.child.stdin.write(input)
  }

  async sendEach(input: string, count: number): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      this.send(input)
      await new Promise((resolve) => setTimeout(resolve, KEY_DELAY_MS))
    }
  }

  /** Resolves with the code the process ended with on its own, null if killed. */
  waitExit(): Promise<number | null> {
    return this.exitCode
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
