import { EventEmitter } from 'node:events'
import type { ReactElement } from 'react'
import { render } from 'ink'

/**
 * A width-controlled static render. `ink-testing-library` hardcodes 100 columns
 * and the whole question here is what happens at 80 and at 60, so its stdout
 * stub is the one piece the prototype has to replace. `debug: true` makes Ink
 * write the whole paint instead of a cursor-diff, which is what makes a paint
 * quotable in a markdown file.
 *
 * Prototype code for issue #9.
 */

/** Long enough for React's effects to flush; no paint here waits on I/O. */
const SETTLE_MS = 25

class ProtoStdout extends EventEmitter {
  /** CONTEXT.md's term is a rendered paint, not a frame, even here. */
  readonly paints: string[] = []

  constructor(readonly columns: number) {
    super()
  }

  write = (paint: string): void => {
    this.paints.push(paint)
  }

  last(): string {
    return this.paints[this.paints.length - 1] ?? ''
  }
}

/**
 * Ink throws rather than degrades when raw mode is unavailable, and
 * `ink-text-input` asks for it through `useInput`. So the stub claims to be a
 * TTY and does nothing, exactly as `ink-testing-library`'s does.
 */
class ProtoStdin extends EventEmitter {
  readonly isTTY = true

  read = (): null => null

  setEncoding(): void {}
  setRawMode(): void {}
  resume(): void {}
  pause(): void {}
  ref(): void {}
  unref(): void {}
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Ink ends a paint with a newline and pads nothing; trailing blanks are noise. */
export function trimPaint(paint: string): string {
  return paint.replace(/[ \t]+$/gm, '').replace(/\n+$/, '')
}

export async function paintAt(columns: number, tree: ReactElement): Promise<string> {
  const stdout = new ProtoStdout(columns)
  const stdin = new ProtoStdin()
  const instance = render(tree, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  })
  try {
    await sleep(SETTLE_MS)
    return trimPaint(stdout.last())
  } finally {
    instance.unmount()
    instance.cleanup()
  }
}
