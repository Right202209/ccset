import { spawn } from 'node:child_process'
import { constants } from 'node:os'
import { CcsetError, EXIT_RUNTIME } from '../core/errors.js'
import type { OperationResult } from '../operations/types.js'

/** Only the explicit run adapter executes an Agent. Detection and use never do. */
export async function launchSession(result: OperationResult, args: string[]): Promise<number> {
  const launch = result.launch
  if (launch === undefined) throw new CcsetError('cli.launch.failed', EXIT_RUNTIME)
  return new Promise((resolve, reject) => {
    const child = spawn(launch.executable, [...launch.args, ...args], { stdio: 'inherit', shell: false })
    const forward = (signal: NodeJS.Signals): void => { child.kill(signal) }
    const interrupt = (): void => forward('SIGINT')
    const terminate = (): void => forward('SIGTERM')
    process.on('SIGINT', interrupt)
    process.on('SIGTERM', terminate)
    const cleanup = (): void => {
      process.off('SIGINT', interrupt)
      process.off('SIGTERM', terminate)
    }
    child.once('error', () => {
      cleanup()
      reject(new CcsetError('cli.launch.failed', EXIT_RUNTIME))
    })
    child.once('close', (code, signal) => {
      cleanup()
      resolve(code ?? (signal === null ? EXIT_RUNTIME : 128 + constants.signals[signal]))
    })
  })
}
