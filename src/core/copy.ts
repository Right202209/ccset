import { promises as fs } from 'node:fs'
import path from 'node:path'
import { FILE_MODE } from './constants.js'
import { wrapFsError } from './errors.js'
import { ensureDir } from './json-file.js'

/**
 * Copy to a temp name in the destination directory, then rename into place.
 * fs.copyFile is not atomic: a crash partway through leaves a truncated file
 * under the real name, indistinguishable from a complete one. Where the copy is
 * a backup that is the only surviving original, and where it is a credential
 * the agent is about to read, a half-written file is the failure that matters.
 *
 * A byte copy is also the only honest way to move a document ccset does not
 * model. Nothing is parsed, so nothing can be dropped.
 */
export async function copyFileAtomic(source: string, destination: string): Promise<void> {
  const dir = path.dirname(destination)
  await ensureDir(dir)
  const pending = path.join(dir, `.${path.basename(destination)}.${process.pid}.copy`)
  try {
    await fs.copyFile(source, pending)
    await fs.chmod(pending, FILE_MODE).catch(() => undefined)
    await fs.rename(pending, destination)
  } catch (err) {
    await fs.unlink(pending).catch(() => undefined)
    throw wrapFsError(err, destination, 'rw')
  }
}
