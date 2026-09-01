import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { AGENTS } from '../src/registry.js'
import { EXIT_NOT_TTY } from '../src/core/errors.js'
import {
  hasKey,
  registerMessages,
  resolveLocale,
  setLocale,
  t,
} from '../src/i18n/index.js'
import { en } from '../src/i18n/en.js'
import { zhHans } from '../src/i18n/zh-Hans.js'
import { UNICODE_TERMINAL } from '../src/ui/terminal.js'
import { UiSession } from './ui-session.js'

/**
 * The zh-Hans catalog. Locale selection is an explicit CCSET_LOCALE opt-in
 * (PRD 5.5 refused detection), so the risk is not choosing wrong but shipping
 * a catalog that silently drifts from English: a key zh-Hans lacks falls back
 * to English text, and a placeholder that does not match breaks only when a
 * user renders it. This gate pins catalog parity, the selection seam, and the
 * path into the real binary.
 */

const CLI = path.join(process.cwd(), 'dist/cli.js')

/** Keys whose Chinese value legitimately equals English: names and paths. */
const ALLOWED_IDENTICAL = new Set([
  'app.title',
  'claudeCode.action.globalDetail',
  'opencode.action.globalDetail',
  'codex.action.globalDetail',
  'codex.status.keyringLabel',
  'codex.status.homeOverrideLabel',
])

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '')
}

function assertParity(
  name: string,
  base: Record<string, string>,
  translated: Record<string, string>,
): void {
  const missing = Object.keys(base).filter((key) => !(key in translated))
  assert.deepEqual(missing, [], `${name}: keys zh-Hans is missing`)
  const extra = Object.keys(translated).filter((key) => !(key in base))
  assert.deepEqual(extra, [], `${name}: zh-Hans keys English does not have`)
  for (const [key, enValue] of Object.entries(base)) {
    const zhValue = translated[key] ?? ''
    assert.notEqual(zhValue, '', `${name}: ${key} translated to an empty string`)
    if (!ALLOWED_IDENTICAL.has(key)) {
      assert.notEqual(zhValue, enValue, `${name}: ${key} still reads as English`)
    }
    assert.deepEqual(
      placeholders(zhValue).sort(),
      placeholders(enValue).sort(),
      `${name}: ${key} placeholders differ from English`,
    )
  }
}

function assertCatalogsMatchEnglish(): void {
  assertParity('shell', en, zhHans)
  for (const agent of AGENTS) {
    const enMessages = agent.messages?.en
    const zhMessages = agent.messages?.['zh-Hans']
    assert.ok(enMessages !== undefined, `${agent.id}: no English messages`)
    assert.ok(zhMessages !== undefined, `${agent.id}: no zh-Hans messages`)
    assertParity(agent.id, enMessages, zhMessages)
  }
}

function assertSelection(): void {
  assert.equal(resolveLocale({ CCSET_LOCALE: 'zh-Hans' }), 'zh-Hans')
  // A user who reaches for an env var spells it the way their shell spells
  // LANG: case, '_' for '-', and a codeset suffix are the same request.
  assert.equal(resolveLocale({ CCSET_LOCALE: 'zh-Hans.UTF-8' }), 'zh-Hans')
  assert.equal(resolveLocale({ CCSET_LOCALE: 'zh_hans' }), 'zh-Hans')
  assert.equal(resolveLocale({ CCSET_LOCALE: 'ZH-HANS' }), 'zh-Hans')
  // A region tag is a different request: zh-TW must never select this
  // catalog, and its simplified-looking cousin gets no special case either.
  assert.equal(resolveLocale({ CCSET_LOCALE: 'zh-CN' }), 'en')
  assert.equal(resolveLocale({}), 'en')
  assert.equal(resolveLocale({ CCSET_LOCALE: '' }), 'en')
  assert.equal(resolveLocale({ CCSET_LOCALE: 'fr' }), 'en')
  setLocale('zh-Hans')
  assert.equal(t('menu.agentTitle'), '选择 Agent')
  assert.equal(t('app.agent', { name: 'Codex CLI' }), 'Agent：Codex CLI')
  assert.equal(t('codex.write.switched'), '提供商已切换')
  for (const key of Object.keys(en)) {
    assert.ok(hasKey(key), `zh-Hans cannot resolve ${key}`)
  }
  for (const agent of AGENTS) {
    for (const key of Object.keys(agent.messages?.en ?? {})) {
      assert.ok(hasKey(key), `zh-Hans cannot resolve ${key}`)
    }
  }
  setLocale('en')
  assert.equal(t('menu.agentTitle'), 'Select an agent')
}

function assertRegistrationGuards(): void {
  assert.throws(() => setLocale('fr'), /unknown locale/)
  assert.throws(() => registerMessages({ fr: {} }), /unknown locale/)
  assert.throws(
    () => registerMessages({ 'zh-Hans': { 'menu.exit': '再会' } }),
    /duplicate key/,
  )
  // A key a locale has not translated yet falls back to English text, never
  // to the raw key.
  registerMessages({ en: { 'zz.fixture.untranslated': 'English fallback' } })
  setLocale('zh-Hans')
  assert.equal(t('zz.fixture.untranslated'), 'English fallback')
  setLocale('en')
}

async function assertRenderedPaint(): Promise<void> {
  const home = await mkdtemp(path.join(tmpdir(), 'ccset-zh-'))
  try {
    setLocale('zh-Hans')
    const session = new UiSession(home, UNICODE_TERMINAL)
    try {
      await session.waitFor('选择 Agent')
      await session.waitFor('设置文件')
      session.assertNoFatal()
    } finally {
      session.stop()
    }
  } finally {
    await rm(home, { recursive: true, force: true })
  }
  setLocale('en')
}

function assertRefusedIn(locale: string, expected: string): void {
  const child = spawnSync(process.execPath, [CLI], {
    env: { ...process.env, CCSET_LOCALE: locale },
    encoding: 'utf8',
  })
  assert.equal(child.status, EXIT_NOT_TTY, `exit was ${child.status}: ${child.stderr}`)
  assert.ok(child.stderr.includes(expected), child.stderr)
}

function assertCliBoundary(): void {
  assertRefusedIn('zh-Hans', '需要终端')
  assertRefusedIn('fr', 'needs a terminal')
}

async function main(): Promise<void> {
  assertCatalogsMatchEnglish()
  assertSelection()
  assertRegistrationGuards()
  await assertRenderedPaint()
  assertCliBoundary()
  console.log('verify:i18n-zh: catalog parity, selection, and boundary all hold')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
