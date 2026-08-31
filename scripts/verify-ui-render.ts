import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import packageJson from '../package.json'
import { App } from '../src/ui/App.js'
import { AGENTS } from '../src/registry.js'
import type { CcsetError } from '../src/core/errors.js'
import { FILE_MODE, MASK_CHAR } from '../src/core/constants.js'
import { maskSecret } from '../src/core/mask.js'
import {
  claudeDir,
  claudeStatePath,
  globalSettingsPath,
  providerSettingsPath,
} from '../src/core/paths.js'
import { t } from '../src/i18n/index.js'

/**
 * The one gate that renders. The other five assert on data and on the CLI
 * boundary, which left every interface change unverifiable; this one drives the
 * real component tree through simulated key input and asserts on the Rendered
 * paints it produces. It changes no interface behaviour -- everything here
 * holds against the interface as it stands.
 */

/** Carried by every focusable row -- SelectList, FieldRow and ControlRow all print it. */
const FOCUS_MARKER = '❯'
const ANSI = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g

const DOWN = '\x1b[B'
const ENTER = '\r'
const ESC = '\x1b'

const POLL_MS = 10
const WAIT_TIMEOUT_MS = 5_000

/** Menu and list rows are addressed by their printed number (PRD 5.4). */
const MENU_PROVIDERS = '2'
const MENU_STATUS = '3'
const LIST_PROVIDER_ROW = '2'
/** Provider name -> Base URL -> Auth token. */
const STEPS_TO_TOKEN_ROW = 2

/** A drive that paints less than this did not reach the interface at all. */
const MIN_PAINTS = 12

const PROVIDER = 'acme'
const BASE_URL = 'https://provider.example'
const TOKEN = 'UI-RENDER-GATE-TOKEN-0123456789'
const TEST_LIBRARY = 'ink-testing-library'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function plain(paint: string): string {
  return paint.replace(ANSI, '')
}

function focusMarkers(paint: string): number {
  return paint.split(FOCUS_MARKER).length - 1
}

function focusedRow(label: string): string {
  return `${FOCUS_MARKER} ${label}`
}

/**
 * One rendered application, driven the way the PTY harness in
 * verify-malformed-dirty drives the built CLI: send keys, wait for text, read
 * what came back. The difference is that paints are kept apart here rather than
 * concatenated into a scrollback stream, which is what makes a per-paint
 * invariant expressible at all.
 */
class UiSession {
  private readonly instance: ReturnType<typeof render>
  private fatal: CcsetError | null = null

  constructor(home: string) {
    this.instance = render(
      createElement(App, {
        ctx: { home },
        agents: AGENTS,
        onFatal: (error: CcsetError) => {
          this.fatal = error
        },
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

  async waitFor(text: string): Promise<string> {
    const deadline = Date.now() + WAIT_TIMEOUT_MS
    while (Date.now() < deadline) {
      const paint = this.paint()
      if (paint.includes(text)) return paint
      await sleep(POLL_MS)
    }
    throw new Error(`Timed out waiting for ${JSON.stringify(text)}. Last paint:\n${this.paint()}`)
  }

  assertNoFatal(): void {
    assert.equal(this.fatal, null, `The app reported a fatal error: ${this.fatal?.messageKey}`)
  }

  stop(): void {
    this.instance.unmount()
    this.instance.cleanup()
  }
}

/** Real files, not in-memory fixtures: the gate reads what ccset would read. */
async function seedHome(home: string): Promise<void> {
  await fs.mkdir(claudeDir(home), { recursive: true })
  const write = (target: string, data: unknown): Promise<void> =>
    fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, { mode: FILE_MODE })
  // Present, so Status offers only the non-destructive item and the drive can
  // reach a confirm screen without a write standing in front of it.
  await write(claudeStatePath(home), { hasCompletedOnboarding: true })
  await write(globalSettingsPath(home), { unmanaged: 'kept' })
  await write(providerSettingsPath(home, PROVIDER), {
    env: { ANTHROPIC_BASE_URL: BASE_URL, ANTHROPIC_AUTH_TOKEN: TOKEN },
  })
}

/* ------------------------------------------------------------------ drive */

/** The exactly-one half of the focus invariant, for a Screen that has focus. */
function assertSingleFocus(paint: string, screen: string): void {
  assert.equal(focusMarkers(paint), 1, `The ${screen} paint has no single focused row:\n${paint}`)
}

function assertPainted(paint: string, text: string, missing: string): void {
  assert.ok(paint.includes(text), `${missing}:\n${paint}`)
}

async function driveMenu(session: UiSession): Promise<void> {
  const paint = await session.waitFor(t('action.testDetail'))
  assertSingleFocus(paint, 'main menu')
  assertPainted(paint, `${focusedRow('1.')} ${t('action.global')}`, 'The menu does not focus row 1')
}

async function driveProviderList(session: UiSession): Promise<void> {
  await session.send(MENU_PROVIDERS)
  const paint = await session.waitFor(BASE_URL)
  assertSingleFocus(paint, 'provider list')
  const first = `${focusedRow('1.')} ${t('action.providerAdd')}`
  assertPainted(paint, first, 'The provider list does not focus row 1')
}

/** The token sits unfocused here, so the review form paints maskSecret's form. */
async function driveProviderForm(session: UiSession): Promise<void> {
  await session.send(LIST_PROVIDER_ROW)
  const paint = await session.waitFor(t('action.providerEdit', { name: PROVIDER }))
  assertSingleFocus(paint, 'review form')
  assertPainted(paint, focusedRow(t('field.providerName')), 'The form does not focus row 1')
  assertPainted(paint, maskSecret(TOKEN), 'The form does not carry the masked token')
}

/** Focused, the same field becomes an editor -- which masks every character. */
async function driveTokenEditor(session: UiSession): Promise<void> {
  await session.sendEach(DOWN, STEPS_TO_TOKEN_ROW)
  const paint = await session.waitFor(MASK_CHAR.repeat(TOKEN.length))
  assertSingleFocus(paint, 'token editor')
  assertPainted(paint, focusedRow(t('field.token')), 'The editor does not focus the token row')
}

async function driveStatus(session: UiSession): Promise<void> {
  await session.send(ESC)
  await session.waitFor(t('action.providerAddDetail'))
  await session.send(ESC)
  await session.waitFor(t('action.testDetail'))
  await session.send(MENU_STATUS)
  const paint = await session.waitFor(t('status.providerTitle', { name: PROVIDER }))
  assertSingleFocus(paint, 'Status')
  assertPainted(paint, maskSecret(TOKEN), 'The Status paint does not carry the masked token')
}

/** Never confirmed: the cursor is read, then Esc backs out, so no backup is cleared. */
async function driveConfirm(session: UiSession): Promise<void> {
  await session.send(ENTER)
  const paint = await session.waitFor(t('confirm.clear'))
  assertSingleFocus(paint, 'confirm')
  const safe = `${focusedRow('2.')} ${t('form.cancel')}`
  assertPainted(paint, safe, 'A destructive confirm must open on the safe row')
  await session.send(ESC)
  await session.waitFor(t('status.providerTitle', { name: PROVIDER }))
}

/* ------------------------------------------------------------- invariants */

/**
 * A token never reaches a Rendered paint. Asserted over every paint rather than
 * the visited ones, so a transitional paint cannot leak what a settled one hides.
 */
function assertTokenNeverPainted(paints: string[]): void {
  for (const paint of paints) {
    assert.equal(paint.includes(TOKEN), false, `The token reached a Rendered paint:\n${paint}`)
  }
  const masked = paints.some((paint) => paint.includes(maskSecret(TOKEN)))
  assert.ok(masked, 'No paint carried the masked token, so nothing proved the mask was reached')
}

/**
 * Focus is single-valued: the marker says where Enter lands, so two of them
 * would be two answers to one question. None is legal -- a message Screen and
 * the busy line have nothing to land on -- so the exactly-one half is asserted
 * per Screen by the drive above, and never-two is asserted here over all paints.
 */
function assertFocusIsSingular(paints: string[]): void {
  for (const paint of paints) {
    assert.ok(focusMarkers(paint) <= 1, `Two rows carry the focus marker:\n${paint}`)
  }
}

/** The renderer used to test the interface must never ship with it. */
function assertTestLibraryIsDevOnly(): void {
  const declared = Object.keys(packageJson.devDependencies)
  const shipped = Object.keys(packageJson.dependencies)
  assert.ok(declared.includes(TEST_LIBRARY), `${TEST_LIBRARY} must be a devDependency`)
  assert.equal(shipped.includes(TEST_LIBRARY), false, `${TEST_LIBRARY} would ship in the artifact`)
}

async function verifyRenderedPaints(home: string): Promise<void> {
  const session = new UiSession(home)
  try {
    await driveMenu(session)
    await driveProviderList(session)
    await driveProviderForm(session)
    await driveTokenEditor(session)
    await driveStatus(session)
    await driveConfirm(session)
    session.assertNoFatal()
    const paints = session.paints()
    assert.ok(
      paints.length >= MIN_PAINTS,
      `Only ${paints.length} paints were captured; the drive did not exercise the interface`,
    )
    assertTokenNeverPainted(paints)
    assertFocusIsSingular(paints)
  } finally {
    session.stop()
  }
}

async function main(): Promise<void> {
  assertTestLibraryIsDevOnly()
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-ui-render-'))
  try {
    await seedHome(home)
    await verifyRenderedPaints(home)
    process.stdout.write('UI render verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
