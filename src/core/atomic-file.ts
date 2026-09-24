import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { FILE_MODE } from './constants.js'

export function temporaryPath(directory: string, basename: string, suffix: string): string {
  return path.join(directory, `.${basename}.${process.pid}.${randomUUID()}.${suffix}`)
}

export async function writePrivateFile(filePath: string, contents: string): Promise<void> {
  const handle = await fs.open(filePath, 'wx', FILE_MODE)
  try {
    await handle.writeFile(contents)
    await setPrivateMode(handle)
  } finally {
    await handle.close()
  }
}

export async function copyPrivateFile(source: string, destination: string): Promise<void> {
  const handle = await fs.open(destination, 'wx', FILE_MODE)
  try {
    for await (const chunk of createReadStream(source)) await writeChunk(handle, chunk)
    await setPrivateMode(handle)
  } finally {
    await handle.close()
  }
}

/**
 * The file was opened exclusively at mode `0600`, so it is already private
 * before this call: a umask can only clear bits, never add them. The chmod
 * merely re-asserts that mode, so a filesystem that refuses it -- WSL's
 * `/mnt/c` DrvFs, some FUSE and SMB mounts -- must not abort the write. The
 * symlink redirection this once guarded against is closed by the exclusive
 * `wx` open and the random temporary name, not by this call, so swallowing the
 * error does not weaken the guarantee.
 */
async function setPrivateMode(handle: Awaited<ReturnType<typeof fs.open>>): Promise<void> {
  if (process.platform === 'win32') return
  try {
    await handle.chmod(FILE_MODE)
  } catch {
    /* the filesystem does not support mode changes; creation already applied 0600 */
  }
}

async function writeChunk(
  handle: Awaited<ReturnType<typeof fs.open>>,
  chunk: string | Buffer,
): Promise<void> {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
  let offset = 0
  while (offset < buffer.length) {
    const result = await handle.write(buffer, offset, buffer.length - offset)
    offset += result.bytesWritten
  }
}
