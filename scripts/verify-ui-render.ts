import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import packageJson from '../package.json'
import { FILE_MODE } from '../src/core/constants.js'
import { maskSecret } from '../src/core/mask.js'
import {
  claudeDir,
  claudeStatePath,
  globalSettingsPath,
  providerSettingsPath,
} from '../src/core/paths.js'
import {
  ASCII_GLYPHS,
  ASCII_TERMINAL,
  UNICODE_GLYPHS,
  UNICODE_TERMINAL,
  resolveTerminal,
  type Terminal,
} from '../src/ui/terminal.js'
import { t } from '../src/i18n/index.js'
import { DOWN, ENTER, ESC, UiSession } from './ui-session.js'

/**
 * The one gate that renders. The other five assert on data and on the CLI
 * boundary, which left every interface change unverifiable; this one drives the
 * real component tree through simulated key input and asserts on the Rendered
 * paints it produces.
 *
 * The whole drive runs once per glyph set. A glyph the terminal cannot draw is
 * not a cosmetic difference -- focus is read off the marker the set chose -- so
 * the ASCII set has to satisfy the same invariants as the Unicode one.
 */

/** A drive that paints less than this did not reach the interface at all. */
const MIN_PAINTS = 12

/** Menu and list rows are addressed by their printed number (PRD 5.4). */
const MENU_PROVIDERS = '2'
const MENU_STATUS = '3'
const LIST_PROVIDER_ROW = '2'
/** Provider name -> Base URL -> Auth token. */
const STEPS_TO_TOKEN_ROW = 2

const PROVIDER = 'acme'
const BASE_URL = 'https://provider.example'
const TOKEN = 'UI-RENDER-GATE-TOKEN-0123456789'
const TEST_LIBRARY = 'ink-testing-library'

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

function assertPainted(paint: string, text: string, missing: string): void {
  assert.ok(paint.includes(text), `${missing}:\n${paint}`)
}

async function driveMenu(session: UiSession): Promise<void> {
  const paint = await session.waitFor(t('action.testDetail'))
  session.assertSingleFocus(paint, 'main menu')
  const first = `${session.focusedRow('1.')} ${t('action.global')}`
  assertPainted(paint, first, 'The menu does not focus row 1')
}

async function driveProviderList(session: UiSession): Promise<void> {
  await session.send(MENU_PROVIDERS)
  const paint = await session.waitFor(BASE_URL)
  session.assertSingleFocus(paint, 'provider list')
  const first = `${session.focusedRow('1.')} ${t('action.providerAdd')}`
  assertPainted(paint, first, 'The provider list does not focus row 1')
}

/** The token sits unfocused here, so the review form paints maskSecret's form. */
async function driveProviderForm(session: UiSession, terminal: Terminal): Promise<void> {
  await session.send(LIST_PROVIDER_ROW)
  const paint = await session.waitFor(t('action.providerEdit', { name: PROVIDER }))
  session.assertSingleFocus(paint, 'review form')
  assertPainted(paint, session.focusedRow(t('field.providerName')), 'The form does not focus row 1')
  assertPainted(paint, terminal.fold(maskSecret(TOKEN)), 'The form does not carry the masked token')
}

/** Focused, the same field becomes an editor -- which masks every character. */
async function driveTokenEditor(session: UiSession, terminal: Terminal): Promise<void> {
  await session.sendEach(DOWN, STEPS_TO_TOKEN_ROW)
  const paint = await session.waitFor(terminal.glyphs.mask.repeat(TOKEN.length))
  session.assertSingleFocus(paint, 'token editor')
  const row = session.focusedRow(t('field.token'))
  assertPainted(paint, row, 'The editor does not focus the token row')
}

async function driveStatus(session: UiSession, terminal: Terminal): Promise<void> {
  await session.send(ESC)
  await session.waitFor(t('action.providerAddDetail'))
  await session.send(ESC)
  await session.waitFor(t('action.testDetail'))
  await session.send(MENU_STATUS)
  const paint = await session.waitFor(t('status.providerTitle', { name: PROVIDER }))
  session.assertSingleFocus(paint, 'Status')
  assertPainted(paint, terminal.fold(maskSecret(TOKEN)), 'The Status paint does not carry the masked token')
}

/** Never confirmed: the cursor is read, then Esc backs out, so no backup is cleared. */
async function driveConfirm(session: UiSession): Promise<void> {
  await session.send(ENTER)
  const paint = await session.waitFor(t('confirm.clear'))
  session.assertSingleFocus(paint, 'confirm')
  const safe = `${session.focusedRow('2.')} ${t('form.cancel')}`
  assertPainted(paint, safe, 'A destructive confirm must open on the safe row')
  await session.send(ESC)
  await session.waitFor(t('status.providerTitle', { name: PROVIDER }))
}

/* ------------------------------------------------------------- invariants */

/**
 * A token never reaches a Rendered paint. Asserted over every paint rather than
 * the visited ones, so a transitional paint cannot leak what a settled one hides.
 */
function assertTokenNeverPainted(paints: string[], terminal: Terminal): void {
  for (const paint of paints) {
    assert.equal(paint.includes(TOKEN), false, `The token reached a Rendered paint:\n${paint}`)
  }
  const masked = paints.some((paint) => paint.includes(terminal.fold(maskSecret(TOKEN))))
  assert.ok(masked, 'No paint carried the masked token, so nothing proved the mask was reached')
}

/** The renderer used to test the interface must never ship with it. */
function assertTestLibraryIsDevOnly(): void {
  const declared = Object.keys(packageJson.devDependencies)
  const shipped = Object.keys(packageJson.dependencies)
  assert.ok(declared.includes(TEST_LIBRARY), `${TEST_LIBRARY} must be a devDependency`)
  assert.equal(shipped.includes(TEST_LIBRARY), false, `${TEST_LIBRARY} would ship in the artifact`)
}

/** A glyph is one or more printable ASCII characters -- an empty glyph is not one. */
const ASCII_GLYPH = /^[\x20-\x7e]+$/

/**
 * A paint spans lines, so the line breaks and tabs Ink emits are allowed beside
 * printable ASCII -- and nothing else. `\s` would have admitted U+00A0, U+2028
 * and U+3000, which are precisely the characters this assertion exists to catch.
 */
const ASCII_PAINT = /^[\x20-\x7e\n\r\t]*$/

/**
 * The seven-bit guarantee, asserted over every paint rather than the visited
 * ones. Any paint site that forgets to fold turns this red on its own, which is
 * what makes the fold safe to spread across the interface.
 */
function assertPaintsAreAscii(paints: string[]): void {
  const unrenderable = 'A paint under the ASCII set carries a character it cannot draw'
  for (const paint of paints) {
    assert.match(paint, ASCII_PAINT, `${unrenderable}:\n${paint}`)
  }
}

/**
 * The environment override, checked without touching process.env: the ASCII set
 * has to be reachable from CCSET_ASCII=1, has to be free of any glyph a
 * seven-bit terminal cannot draw, and has to actually differ from the default.
 */
function assertGlyphSetsAreSelectable(): void {
  for (const [name, glyph] of Object.entries(ASCII_GLYPHS)) {
    assert.ok(ASCII_GLYPH.test(glyph), `The ASCII glyph set's ${name} is not ASCII: ${glyph}`)
  }
  const ascii = resolveTerminal({ CCSET_ASCII: '1' })
  assert.equal(ascii, ASCII_TERMINAL, 'CCSET_ASCII=1 must select the ASCII set')
  assert.equal(resolveTerminal({}), UNICODE_TERMINAL, 'An unset CCSET_ASCII must select Unicode')
  assert.notEqual(ASCII_GLYPHS.focus, UNICODE_GLYPHS.focus, 'The two focus markers are identical')
}

async function verifyRenderedPaints(home: string, set: string, terminal: Terminal): Promise<void> {
  const session = new UiSession(home, terminal)
  try {
    await driveMenu(session)
    await driveProviderList(session)
    await driveProviderForm(session, terminal)
    await driveTokenEditor(session, terminal)
    await driveStatus(session, terminal)
    await driveConfirm(session)
    session.assertNoFatal()
    const paints = session.paints()
    assert.ok(
      paints.length >= MIN_PAINTS,
      `Only ${paints.length} ${set} paints were captured; the drive did not exercise the interface`,
    )
    assertTokenNeverPainted(paints, terminal)
    if (set === ASCII_SET) assertPaintsAreAscii(paints)
    session.assertFocusIsSingular()
    process.stdout.write(`  ${set} glyph set: ${paints.length} paints.\n`)
  } finally {
    session.stop()
  }
}

/** Every set the drive runs against. Unicode first: it is what an unset environment gets. */
const ASCII_SET = 'ASCII'
const GLYPH_SETS: Array<[string, Terminal]> = [
  ['Unicode', UNICODE_TERMINAL],
  [ASCII_SET, ASCII_TERMINAL],
]

async function main(): Promise<void> {
  assertTestLibraryIsDevOnly()
  assertGlyphSetsAreSelectable()
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-ui-render-'))
  try {
    await seedHome(home)
    // The drive never confirms anything, so both runs read the same seeded home.
    for (const [set, terminal] of GLYPH_SETS) {
      await verifyRenderedPaints(home, set, terminal)
    }
    process.stdout.write('UI render verification passed.\n')
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

await main()
