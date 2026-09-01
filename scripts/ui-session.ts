import assert from 'node:assert/strict'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { App } from '../src/ui/App.js'
import { AGENTS } from '../src/registry.js'
import type { Terminal } from '../src/ui/terminal.js'
import type { Agent, Viewport } from '../src/types.js'

/**
 * Harness for the rendering gates. Not a gate itself -- it holds no assertion
 * about ccset's behaviour, only the machinery for driving a rendered
 * application and reading the Rendered paints back out. It lives apart from
 * the gates so that neither file has to be trimmed to stay inside the 300-line
 * limit.
 */

const ANSI = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g

export const DOWN = '\x1b[B'
export const ENTER = '\r'
export const ESC = '\x1b'

const POLL_MS = 10
const WAIT_TIMEOUT_MS = 5_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function plain(paint: string): string {
  return paint.replace(ANSI, '')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Counted line-anchored rather than by substring, because the ASCII glyph set
 * marks focus with '>' and painted text contains that character too
 * ('settings.<name>.json'). Only a marker in a row's gutter means focus.
 */
export function focusMarkers(paint: string, marker: string): number {
  const gutter = new RegExp(`^\\s*${escapeRegExp(marker)} `)
  return paint.split('\n').filter((line) => gutter.test(line)).length
}

/**
 * One rendered application, driven the way the PTY harness in
 * verify-malformed-dirty drives the built CLI: send keys, wait for text, read
 * what came back. The difference is that paints are kept apart here rather than
 * concatenated into a scrollback stream, which is what makes a per-paint
 * invariant expressible at all.
 *
 * The Terminal capability is handed to App as a prop, so selecting a glyph set
 * never means mutating process.env underneath a running render.
 */
export class UiSession {
  private readonly instance: ReturnType<typeof render>
  private readonly marker: string

  constructor(
    home: string,
    terminal: Terminal,
    options: { agents?: Agent[]; viewport?: Viewport } = {},
  ) {
    this.marker = terminal.glyphs.focus
    this.instance = render(
      createElement(App, {
        ctx: { home },
        agents: options.agents ?? AGENTS,
        terminal,
        viewport: options.viewport,
      }),
    )
  }

  /**
   * Ink reads stdin through the 'readable' event, and it registers that listener
   * from an effect -- which has not run yet on the paint that follows mount. A
   * key written before then is left sitting unread, so it is re-sent until Ink
   * takes it rather than sent once into a guessed-at delay.
   */
  async send(input: string): Promise<void> {
    const deadline = Date.now() + WAIT_TIMEOUT_MS
    do {
      this.instance.stdin.write(input)
      await sleep(POLL_MS)
    } while (this.instance.stdin.data !== null && Date.now() < deadline)
    assert.equal(
      this.instance.stdin.data,
      null,
      `Ink never read the key ${JSON.stringify(input)}. Last paint:\n${this.paint()}`,
    )
  }

  async sendEach(input: string, count: number): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await this.send(input)
    }
  }

  /** The current Rendered paint. */
  paint(): string {
    return plain(this.instance.lastFrame() ?? '')
  }

  /** Every Rendered paint since mount, in order. */
  paints(): string[] {
    return this.instance.frames.map(plain)
  }

  /** A focused row as this session's glyph set spells it. */
  focusedRow(label: string): string {
    return `${this.marker} ${label}`
  }

  /** The exactly-one half of the focus invariant, for a Screen that has focus. */
  assertSingleFocus(paint: string, screen: string): void {
    const found = focusMarkers(paint, this.marker)
    assert.equal(found, 1, `The ${screen} paint has no single focused row:\n${paint}`)
  }

  /**
   * Focus is single-valued: the marker says where Enter lands, so two of them
   * would be two answers to one question. None is legal -- a message Screen and
   * the busy line have nothing to land on -- so the exactly-one half is asserted
   * per Screen by the drive, and never-two is asserted here over every paint.
   */
  assertFocusIsSingular(): void {
    for (const paint of this.paints()) {
      assert.ok(focusMarkers(paint, this.marker) <= 1, `Two rows carry the focus marker:\n${paint}`)
    }
  }

  async waitFor(text: string): Promise<string> {
    const deadline = Date.now() + WAIT_TIMEOUT_MS
    while (Date.now() < deadline) {
      const paint = this.paint()
      if (paint.includes(text)) return paint
      await sleep(POLL_MS)
    }
    throw new Error(`Timed out waiting for ${JSON.stringify(text)}. Last paint:\n${this.paint()}`)
  }

  /** The app is still painting: no render-tree failure ejected it. */
  assertAlive(): void {
    assert.ok(this.instance.lastFrame() !== undefined, 'The app stopped painting')
  }

  stop(): void {
    this.instance.unmount()
    this.instance.cleanup()
  }
}
