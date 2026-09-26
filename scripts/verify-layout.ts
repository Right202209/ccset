import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createElement } from 'react'
import { render } from 'ink'
import stringWidth from 'string-width'
import type { Agent, FieldSpec, FormScreen, Viewport } from '../src/types.js'
import { setLocale, t } from '../src/i18n/index.js'
import { App } from '../src/ui/App.js'
import { helpFor } from '../src/ui/keymap.js'
import { ASCII_TERMINAL, UNICODE_TERMINAL, type Terminal } from '../src/ui/terminal.js'
import { assertPaintsAreAscii, assertPaintsFit } from './ui-assertions.js'
import { verifyLayoutRules } from './layout-rules.js'
import { ENTER, UiSession } from './ui-session.js'

/**
 * The application frame drawn around every Screen: bordered Panels, the key
 * help in the bottom border, side Panels on a wide terminal, and no frame at
 * all below the minimums. The pure rules (plan, path title, text fitting) are
 * asserted in layout-rules.ts; this drives the real App.
 */

const CTRL_S = '\x13'
const SAVED_TITLE = 'Layout saved'
const SAVED_LINE = 'layout-saved-line'
const MENU_LABEL = 'Open the form'

const FIELDS: FieldSpec[] = Array.from({ length: 14 }, (_, index) => ({
  id: `field-${index + 1}`,
  labelKey: `Field ${index + 1}`,
  type: 'text' as const,
}))

const FORM: FormScreen = {
  kind: 'form',
  title: 'Layout form',
  fields: FIELDS,
  values: {},
  baseline: {},
  submit: async () => ({ kind: 'message', title: SAVED_TITLE, lines: [SAVED_LINE], tone: 'success' }),
}

function layoutAgent(detected: boolean): Agent {
  return {
    id: detected ? 'layout' : 'layout-missing',
    name: detected ? 'Layout agent' : 'Missing agent',
    detect: async () => detected,
    getActions: () => [{ id: 'form', labelKey: MENU_LABEL, run: async () => FORM }],
  }
}

function session(home: string, viewport: Viewport, options: { terminal?: Terminal; detected?: boolean } = {}): UiSession {
  const agent = layoutAgent(options.detected ?? true)
  return new UiSession(home, options.terminal ?? UNICODE_TERMINAL, {
    agents: [agent],
    agentId: agent.id,
    viewport,
  })
}

async function withSession(created: UiSession, run: (active: UiSession) => Promise<void>): Promise<void> {
  try {
    await run(created)
  } finally {
    created.stop()
  }
}

/**
 * Every row is exactly as wide as the terminal, and every row inside the main
 * Panel opens and closes on both nested side borders: the Panels line up.
 * Yoga would squeeze an over-long border row back to width, so the label is
 * checked in place too.
 */
async function verifyFrameGeometry(home: string, terminal: Terminal): Promise<void> {
  const viewport = { rows: 24, columns: 80 }
  await withSession(session(home, viewport, { terminal }), async (active) => {
    const paint = await active.waitFor(MENU_LABEL)
    const lines = paint.split('\n')
    for (const line of lines) {
      assert.equal(stringWidth(line), viewport.columns, `A frame row is not ${viewport.columns} columns:\n${paint}`)
    }
    const { box } = terminal.glyphs
    for (const line of lines.slice(2, -2)) {
      const sides = line.startsWith(`${box.left}${box.left}`) && line.endsWith(`${box.right}${box.right}`)
      assert.ok(sides, `A row inside the main Panel lost a side border:\n${paint}`)
    }
    const top = lines[0] ?? ''
    const bottom = lines.at(-1) ?? ''
    assert.ok(top.startsWith(box.topLeft) && top.endsWith(box.topRight), `No top border:\n${paint}`)
    assert.ok(top.includes(`${box.top} ${terminal.fold(t('app.title'))}  `), `The title left its border:\n${paint}`)
    assert.ok(top.includes(terminal.fold(t('app.tagline'))), `The tagline left the top border:\n${paint}`)
    assert.ok((lines[1] ?? '').includes(t('app.agent', { name: 'Layout agent' })), `No path title:\n${paint}`)
    assert.ok(bottom.startsWith(box.bottomLeft), `No bottom border:\n${paint}`)
    assert.ok(bottom.includes(terminal.fold(helpFor('list'))), `The list help is not in the border:\n${paint}`)
    if (terminal === ASCII_TERMINAL) assertPaintsAreAscii(active.paints())
  })
}

/** Side Panels need 100 columns; a message Screen keeps the full width for copying. */
async function verifySidePanels(home: string): Promise<void> {
  await withSession(session(home, { rows: 24, columns: 99 }), async (active) => {
    const paint = await active.waitFor(MENU_LABEL)
    assert.equal(paint.includes(t('side.resultTitle')), false, `Side Panels at 99 columns:\n${paint}`)
  })
  await withSession(session(home, { rows: 24, columns: 100 }), async (active) => {
    // detect() settles after the first paint, so the wait is on its outcome.
    let paint = await active.waitFor(t('side.configFound'))
    assert.ok(paint.includes(t('side.resultTitle')), `No result Panel at 100 columns:\n${paint}`)
    assert.ok(paint.includes(t('side.noResult')), `An empty result Panel is not labelled:\n${paint}`)
    await active.send('1')
    await active.waitFor(FORM.title)
    await active.send(CTRL_S)
    paint = await active.waitFor(SAVED_LINE)
    assert.equal(paint.includes(t('side.resultTitle')), false, `A message Screen shares its width:\n${paint}`)
    await active.send(ENTER)
    paint = await active.waitFor(t('side.resultTitle'))
    assert.ok(paint.includes(SAVED_TITLE) && paint.includes(SAVED_LINE), `The last result was lost:\n${paint}`)
    assertPaintsFit(active.paints(), { rows: 24, columns: 100 })
  })
  await withSession(session(home, { rows: 24, columns: 100 }, { detected: false }), async (active) => {
    const paint = await active.waitFor(t('side.configMissing'))
    assert.ok(paint.includes(t('menu.notDetected')), `The main Panel dropped its warning:\n${paint}`)
  })
}

/** Both locales, at the two widths the review rules name, on a short and a tall terminal. */
const FORM_CASES = ['en', 'zh-Hans'].flatMap((locale) =>
  [80, 100].flatMap((columns) => [12, 21].map((rows) => ({ locale, viewport: { rows, columns } }))),
)

/**
 * The form's help is the longest; the frame reserves what it paints, in both
 * locales, whether the help sits in the border or wraps inside the frame.
 */
async function verifyFormHelpFits(home: string): Promise<void> {
  for (const { locale, viewport } of FORM_CASES) {
    setLocale(locale)
    await withSession(session(home, viewport), async (active) => {
      await active.send('1')
      const paint = await active.waitFor(FORM.title)
      assertPaintsFit(active.paints(), viewport)
      const shown = viewport.rows < 16 || paint.includes('ctrl+s')
      assert.ok(shown, `${locale} at ${viewport.columns} columns painted no form help:\n${paint}`)
    })
  }
  setLocale('zh-Hans')
  await withSession(session(home, { rows: 21, columns: 100 }), async (active) => {
    await active.send('1')
    const bottom = (await active.waitFor(FORM.title)).split('\n').at(-1) ?? ''
    assert.ok(bottom.includes(helpFor('form')), `The zh-Hans form help missed the border:\n${bottom}`)
  })
  setLocale('en')
}

/** Below seven rows the chrome would cost more than it shows: the View paints alone. */
async function verifyFrameless(home: string): Promise<void> {
  const viewport = { rows: 6, columns: 80 }
  await withSession(session(home, viewport), async (active) => {
    const paint = await active.waitFor(MENU_LABEL)
    assert.equal(paint.includes(UNICODE_TERMINAL.glyphs.box.topLeft), false, `A frame at six rows:\n${paint}`)
    assertPaintsFit(active.paints(), viewport)
  })
}

/** A label longer than its row is cut with the Terminal's own ellipsis, never Ink's `…`. */
async function verifyLongLabelsFold(home: string): Promise<void> {
  const label = 'provider-with-a-name-far-longer-than-any-row-can-hold'
  const agent: Agent = {
    id: 'long-label',
    name: 'Long label',
    detect: async () => true,
    getActions: () => [{
      id: 'list',
      labelKey: MENU_LABEL,
      run: async () => ({
        kind: 'list' as const,
        title: 'Long labels',
        items: [{ id: 'long', label, detail: 'https://provider.example/v1', run: async () => FORM }],
      }),
    }],
  }
  const viewport = { rows: 12, columns: 40 }
  await withSession(new UiSession(home, ASCII_TERMINAL, { agents: [agent], agentId: agent.id, viewport }), async (active) => {
    await active.send('1')
    const paint = await active.waitFor('provider-with')
    assert.ok(paint.includes(`${label.slice(0, 20)}`) && paint.includes('...'), `The label was not cut:\n${paint}`)
    assertPaintsAreAscii(active.paints())
  })
}

/** Not a TTY on purpose: cli-cursor would then queue a cursor restore on the real stderr. */
class FakeStdout extends EventEmitter {
  readonly writes: string[] = []
  constructor(public columns: number, public rows: number) {
    super()
  }
  write = (chunk: string): boolean => {
    this.writes.push(chunk)
    return true
  }
}

class FakeStdin extends EventEmitter {
  readonly isTTY = true
  setEncoding(): void {}
  setRawMode(): void {}
  resume(): void {}
  pause(): void {}
  ref(): void {}
  unref(): void {}
  read(): null {
    return null
  }
}

async function until(check: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 5_000
  while (!check()) {
    assert.ok(Date.now() < deadline, message)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/**
 * Rows painted to the last column rewrap when the terminal narrows, and Ink's
 * erase cannot count them; a narrowing clears the visible screen first. Only
 * the visible screen: the scrollback is what ADR 0002 keeps the output for.
 */
async function verifyResizeClears(home: string): Promise<void> {
  const stdout = new FakeStdout(100, 30)
  const agent = layoutAgent(true)
  const app = createElement(App, { ctx: { home }, agents: [agent], agentId: agent.id, terminal: UNICODE_TERMINAL })
  const instance = render(app, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: new FakeStdin() as unknown as NodeJS.ReadStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  })
  const clears = (): number => stdout.writes.filter((chunk) => chunk.includes('\x1b[2J')).length
  const widest = (): number => Math.max(...(stdout.writes.at(-1) ?? '').split('\n').map((line) => stringWidth(line)))
  try {
    await until(() => stdout.writes.some((chunk) => chunk.includes(MENU_LABEL)), 'the App never painted')
    assert.equal(clears(), 0, 'the App cleared the screen on mount')
    stdout.columns = 90
    stdout.emit('resize')
    await until(() => widest() === 90, 'the frame never followed the terminal to 90 columns')
    assert.equal(clears(), 1, 'narrowing did not clear the visible screen first')
    stdout.columns = 120
    stdout.rows = 20
    stdout.emit('resize')
    await until(() => widest() === 120, 'the frame never followed the terminal to 120 columns')
    assert.equal(clears(), 1, 'widening or shortening cleared the screen')
    assert.equal(stdout.writes.some((chunk) => chunk.includes('\x1b[3J')), false, 'a resize erased the scrollback')
  } finally {
    instance.unmount()
  }
}

async function main(): Promise<void> {
  verifyLayoutRules()
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-layout-'))
  try {
    await verifyFrameGeometry(home, UNICODE_TERMINAL)
    await verifyFrameGeometry(home, ASCII_TERMINAL)
    await verifySidePanels(home)
    await verifyFormHelpFits(home)
    await verifyFrameless(home)
    await verifyLongLabelsFold(home)
    await verifyResizeClears(home)
    process.stdout.write('Layout verification passed.\n')
  } finally {
    setLocale('en')
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
