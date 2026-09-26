import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import '../src/registry.js'
import { setLocale, t } from '../src/i18n/index.js'
import { claudeCode } from '../src/agents/claude-code/index.js'
import { providerSettingsPath, globalSettingsPath, claudeStatePath } from '../src/agents/claude-code/paths.js'
import { UiSession, DOWN, ENTER } from './ui-session.js'
import { assertPaintsFit } from './ui-assertions.js'
import { UNICODE_TERMINAL } from '../src/ui/terminal.js'
import { glanceLine, previewLine } from '../src/ui/preview-safety.js'

const HOME_PREFIX = 'ccset-side-info-'
const SENTINEL = 'sk-DO-NOT-PAINT-side-info'
const PROVIDER_URL = 'https://demo.example/v1?region=us'
const SAFE_PROVIDER_URL = 'https://demo.example/…'
const DISK_PROVIDER_URL = `https://account:${SENTINEL}@demo.example/v1/${SENTINEL}?access_key=${SENTINEL}&region=us`
const CTRL_S = '\x13'

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

async function prepareHome(): Promise<string> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), HOME_PREFIX))
  await writeJson(globalSettingsPath(home), { model: 'global-model' })
  await writeJson(providerSettingsPath(home, 'demo'), {
    env: { ANTHROPIC_BASE_URL: DISK_PROVIDER_URL, ANTHROPIC_AUTH_TOKEN: SENTINEL },
    model: 'demo-model',
  })
  return home
}

async function snapshot(home: string): Promise<string> {
  const hash = createHash('sha256')
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(file)
      else hash.update(path.relative(home, file)).update(await fs.readFile(file))
    }
  }
  await visit(home)
  return hash.digest('hex')
}

function session(home: string, viewport: { rows: number; columns: number }): UiSession {
  return new UiSession(home, UNICODE_TERMINAL, {
    agents: [claudeCode],
    agentId: claudeCode.id,
    viewport,
  })
}

async function verifyBrowsingIsReadOnly(home: string): Promise<void> {
  const before = await snapshot(home)
  const active = session(home, { rows: 24, columns: 110 })
  try {
    let paint = await active.waitFor(t('side.configTitle'))
    assert.ok(paint.includes('settings.json'), `The config path is missing:\n${paint}`)
    assert.ok(paint.includes(`${t('glance.providers')}: 1`), `The provider count is missing:\n${paint}`)
    assertNoSecret(active.paints())
    await active.send(DOWN)
    paint = await active.waitFor('demo')
    assert.ok(paint.includes(`${t('glance.providerNames')}: demo`), `The focused Providers preview is missing:\n${paint}`)
    await active.send(ENTER)
    await active.waitFor(t('action.providerAdd'))
    await active.send(DOWN)
    paint = await active.waitFor(`${t('field.token')}: ${t('status.yes')}`)
    assert.ok(paint.includes(SAFE_PROVIDER_URL), `The provider preview omitted its safe base URL:\n${paint}`)
    assertNoSecret(active.paints())
    active.assertFocusIsSingular()
  } finally {
    active.stop()
  }
  assert.equal(await snapshot(home), before, 'Browsing changed files in the scratch home')
}

function coordinates(paint: string, text: string): { x: number; y: number } {
  const lines = paint.split('\n')
  const row = lines.findIndex((line) => line.includes(text))
  assert.notEqual(row, -1, `The clickable row ${JSON.stringify(text)} is missing:\n${paint}`)
  const column = lines[row]?.indexOf(text) ?? -1
  assert.notEqual(column, -1, `The clickable text ${JSON.stringify(text)} is missing:\n${paint}`)
  return { x: column + Math.max(1, Math.floor(text.length / 2)) + 1, y: row + 1 }
}

async function clickText(active: UiSession, text: string, splitEscape = false): Promise<void> {
  const { x, y } = coordinates(active.paint(), text)
  const sequence = `\x1b[<0;${x};${y}M`
  if (splitEscape) {
    await active.send('\x1b')
    await active.send(sequence.slice(1))
  } else {
    await active.send(sequence)
  }
}

async function verifyMouseClicks(): Promise<void> {
  const mouseHome = await fs.mkdtemp(path.join(os.tmpdir(), `${HOME_PREFIX}mouse-`))
  await writeJson(globalSettingsPath(mouseHome), {})
  await writeJson(providerSettingsPath(mouseHome, 'demo'), {
    env: { ANTHROPIC_BASE_URL: 'https://demo.example/v1', ANTHROPIC_AUTH_TOKEN: SENTINEL },
    model: 'demo-model',
  })
  await writeJson(claudeStatePath(mouseHome), {})
  const before = await snapshot(mouseHome)
  const active = session(mouseHome, { rows: 24, columns: 110 })
  let after = ''
  try {
    await active.waitFor(t('side.noWarnings'))
    await active.send('\x1b[<0;1;1M')
    assert.ok(active.paint().includes(t('action.providers')), 'A click outside the list changed screens')
    await clickText(active, '2. Providers', true)
    await active.waitFor(t('action.providerAdd'))
    await clickText(active, '2. demo')
    const paint = await active.waitFor(t('field.providerName'))
    assert.ok(paint.includes('https://demo.example/v1'), `A mouse-opened provider omitted its URL:\n${paint}`)
    assertNoSecret(active.paints())
    active.assertFocusIsSingular()
  } finally {
    active.stop()
    after = await snapshot(mouseHome)
    await fs.rm(mouseHome, { recursive: true, force: true })
  }
  assert.equal(after, before, 'Mouse browsing changed files in the scratch home')
}

function verifyPreviewSafety(): void {
  const credentialLines = [
    glanceLine({ labelKey: 'field.token', value: SENTINEL }),
    glanceLine({ labelKey: 'codex.field.apiKey', value: SENTINEL }),
    previewLine({ label: t('field.token'), value: SENTINEL }),
  ]
  for (const line of credentialLines) {
    assert.equal(line.value, t('status.yes'), 'A credential value reached a Glance or Preview line')
    assert.equal(line.value.includes(SENTINEL), false)
  }
  const unsetCredential = previewLine({ label: t('field.token'), value: t('status.no') })
  assert.equal(unsetCredential.value, t('status.no'), 'An unset credential was shown as set')
  const url = previewLine({ label: t('field.baseUrl'), value: DISK_PROVIDER_URL })
  assert.equal(url.value, SAFE_PROVIDER_URL, 'URL credentials and path details were not omitted from a Preview')
  assert.equal(url.value.includes(SENTINEL), false)
  const queryUrl = previewLine({ label: t('field.baseUrl'), value: `https://demo.example/v1?access_key=${SENTINEL}` })
  assert.equal(queryUrl.value, SAFE_PROVIDER_URL, 'A credential query parameter reached a Preview')
  const fragmentUrl = previewLine({ label: t('field.baseUrl'), value: `${PROVIDER_URL}#access_token=${SENTINEL}` })
  assert.equal(fragmentUrl.value, SAFE_PROVIDER_URL, 'URL fragments were not omitted from a Preview')
  const malformedUrl = previewLine({ label: t('field.baseUrl'), value: `https://[${SENTINEL}` })
  assert.equal(malformedUrl.value, t('side.urlOmitted'), 'An unparseable base URL was not hidden')
}

function assertNoSecret(paints: string[]): void {
  for (const paint of paints) assert.equal(paint.includes(SENTINEL), false, 'A Rendered paint contains the sentinel key')
}

async function verifyFindings(home: string): Promise<void> {
  const noBase = providerSettingsPath(home, 'no-base')
  const malformed = providerSettingsPath(home, 'broken')
  await writeJson(noBase, { env: { ANTHROPIC_AUTH_TOKEN: SENTINEL } })
  await fs.writeFile(malformed, '{"env":}\n', { mode: 0o600 })
  const active = session(home, { rows: 24, columns: 110 })
  try {
    const paint = await active.waitFor('Provider no-base')
    assert.ok(paint.includes(t('side.warningsTitle', { count: 1 })), `The warning count is missing:\n${paint}`)
    assert.ok(paint.includes('Could not parse'), `The parse error finding is missing:\n${paint}`)
    assertNoSecret(active.paints())
  } finally {
    active.stop()
  }
}

async function createProvider(active: UiSession): Promise<void> {
  await active.send(DOWN)
  await active.send(ENTER)
  await active.waitFor(t('action.providerAdd'))
  await active.send(ENTER)
  await active.waitFor(t('field.providerName'))
  await active.send('second')
  await active.send(DOWN)
  await active.send(PROVIDER_URL)
  await active.send(DOWN)
  await active.send(SENTINEL)
  await active.send(CTRL_S)
}

async function verifyRefresh(home: string): Promise<void> {
  const active = session(home, { rows: 24, columns: 110 })
  try {
    await active.waitFor(`${t('glance.providers')}: 1`)
    await createProvider(active)
    await active.waitFor(t('write.providerSaved'))
    assertNoSecret(active.paints())
    await active.send(ENTER)
    const paint = await active.waitFor(`${t('glance.providers')}: 2`)
    assert.ok(paint.includes(t('side.configTitle')), `The refreshed config summary is missing:\n${paint}`)
  } finally {
    active.stop()
  }
}

async function verifyWidths(home: string): Promise<void> {
  for (const locale of ['en', 'zh-Hans']) {
    setLocale(locale)
    const strip = session(home, { rows: 24, columns: 90 })
    try {
      const paint = await strip.waitFor(t('side.detailsTitle', { count: 1 }))
      assertPaintsFit(strip.paints(), { rows: 24, columns: 90 })
      assert.ok(paint.includes(t('side.detailsTitle', { count: 1 })))
      await strip.send(DOWN)
      await strip.send(ENTER)
      await strip.waitFor(t('action.providerAdd'))
      await strip.send(DOWN)
      await strip.send(DOWN)
      const preview = await strip.waitFor('demo-model')
      assert.ok(preview.includes(SAFE_PROVIDER_URL), `The strip omitted the focused base URL:\n${preview}`)
      assert.ok(preview.includes(t('side.compactKey')), `The strip omitted key presence:\n${preview}`)
      assert.ok(preview.includes(t('status.yes')), `The strip omitted the key-set state:\n${preview}`)
      assert.ok(preview.includes('settings.demo.json'), `The strip omitted the provider file:\n${preview}`)
      assertNoSecret(strip.paints())
      assertPaintsFit(strip.paints(), { rows: 24, columns: 90 })
    } finally {
      strip.stop()
    }
    const narrow = session(home, { rows: 24, columns: 79 })
    try {
      const paint = await narrow.waitFor(t('action.providers'))
      assert.equal(paint.includes(t('side.detailsTitle', { count: 1 })), false)
      assertPaintsFit(narrow.paints(), { rows: 24, columns: 79 })
    } finally {
      narrow.stop()
    }
  }
  setLocale('en')
}

async function verifyHeight(home: string): Promise<void> {
  for (let index = 0; index < 12; index += 1) {
    await writeJson(providerSettingsPath(home, `height-${String(index).padStart(2, '0')}`), { model: 'height-test' })
  }
  for (const viewport of [{ rows: 16, columns: 100 }, { rows: 18, columns: 110 }]) {
    const active = session(home, viewport)
    try {
      const omitted = viewport.rows === 16 ? 4 : 2
      const paint = await active.waitFor(t('side.warningsTitle', { count: 13 }))
      assert.ok(paint.includes(t('side.more', { count: omitted })), `The warning panel did not fill its reserved height:\n${paint}`)
      assert.ok(paint.includes('Could not parse'), `An error finding was dropped before warnings:\n${paint}`)
      for (const paint of active.paints()) {
        assert.ok(paint.split('\n').length < viewport.rows, `A paint reached the ${viewport.rows}-row terminal:\n${paint}`)
      }
    } finally {
      active.stop()
    }
  }
}

async function main(): Promise<void> {
  const home = await prepareHome()
  try {
    await writeJson(claudeStatePath(home), {})
    await verifyBrowsingIsReadOnly(home)
    await verifyMouseClicks()
    verifyPreviewSafety()
    await verifyRefresh(home)
    await verifyFindings(home)
    await verifyWidths(home)
    if (process.env['CCSET_VISUAL'] === '1') await showVisual(home)
    await verifyHeight(home)
    process.stdout.write('Side information verification passed.\n')
  } finally {
    setLocale('en')
    await fs.rm(home, { recursive: true, force: true })
  }
}

async function showVisual(home: string): Promise<void> {
  for (const columns of [130, 100, 90, 79]) {
    const active = session(home, { rows: 24, columns })
    try {
      const marker = visualMarker(columns)
      const paint = await active.waitFor(marker)
      process.stdout.write(`\n--- ${columns} columns ---\n${paint}\n`)
    } finally {
      active.stop()
    }
  }
}

function visualMarker(columns: number): string {
  if (columns >= 100) return t('side.configTitle')
  if (columns >= 80) return t('side.detailsTitle', { count: 1 })
  return t('action.providers')
}

await main()
