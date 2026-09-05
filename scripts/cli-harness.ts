import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * The process-seam harness the command gates share: they all cross the seam
 * through the built dist/cli.js, so the spawn, the scratch home, and the
 * result shape are declared once here and imported by each gate.
 */

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

/**
 * One run of the built CLI. An `env` entry overrides the ambient environment,
 * and an `undefined` value strips the variable -- how the codex gates remove
 * an inherited CODEX_HOME. `input` is fed to stdin, which is how the
 * --token-stdin cases deliver their secret.
 */
export function runCli(
  args: string[],
  env: Record<string, string | undefined> = {},
  input: string | Buffer = '',
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), 'dist/cli.js'), ...args], {
      env: { ...process.env, ...env },
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

/** A scratch home under os.tmpdir() that removes itself whatever the outcome. */
export async function withHome(label: string, run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `ccset-cmd-${label}-`))
  try {
    await run(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}
