import { promises as fs } from 'node:fs'
import path from 'node:path'
import { copyPrivateFile, temporaryPath, writePrivateFile } from './atomic-file.js'
import { errorCode, wrapFsError } from './errors.js'
import { ensureDir } from './json-file.js'

/** Publish complete private bytes only if absent, even with concurrent writers. */
async function createFile(target: string, stage: (pending: string) => Promise<void>): Promise<boolean> {
  const dir = path.dirname(target)
  await ensureDir(dir)
  const pending = temporaryPath(dir, path.basename(target), 'create')
  try {
    await stage(pending)
    // A hard link publishes atomically and refuses any existing destination,
    // including a dangling symlink. There is no overwriting fallback.
    await fs.link(pending, target)
    return true
  } catch (err) {
    if (errorCode(err) === 'EEXIST') return false
    throw wrapFsError(err, target, 'rw')
  } finally {
    await fs.unlink(pending).catch(() => undefined)
  }
}

export function createTextAtomic(target: string, contents: string): Promise<boolean> {
  return createFile(target, (pending) => writePrivateFile(pending, contents))
}

export function copyFileExclusive(source: string, target: string): Promise<boolean> {
  return createFile(target, (pending) => copyPrivateFile(source, pending))
}
