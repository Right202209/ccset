import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { CcsetError, EXIT_USAGE } from '../core/errors.js'
import { t } from '../i18n/index.js'
import type { Secret } from '../operations/types.js'
import { secretFromEnv } from './secret.js'

/** Readline owns terminal restoration; the output sink never echoes key bytes. */
export async function promptSecret(): Promise<Secret> {
  const hidden = new Writable({ write(_chunk, _encoding, done) { done() } })
  const reader = createInterface({ input: process.stdin, output: hidden, terminal: true, historySize: 0 })
  process.stderr.write(`${t('cli.preset.keyPrompt')} `)
  try {
    const value = await new Promise<string>((resolve, reject) => {
      const cancel = (): void => reject(new CcsetError('cli.preset.cancelled', EXIT_USAGE))
      reader.once('SIGINT', cancel)
      reader.once('close', cancel)
      reader.question('', resolve)
    })
    const secret = secretFromEnv(value)
    if (secret === null) throw new CcsetError('cli.secret.empty', EXIT_USAGE)
    return secret
  } finally {
    reader.close()
    hidden.end()
    process.stderr.write('\n')
  }
}
