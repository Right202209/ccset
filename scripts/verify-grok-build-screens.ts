import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ActionResult, Ctx, ListItem } from '../src/types.js'
import { configPath } from '../src/agents/grok-build/paths.js'
import { grokBuildMessages } from '../src/agents/grok-build/messages.js'
import { grokBuildActions } from '../src/agents/grok-build/actions.js'
import '../src/registry.js'
import { en } from '../src/i18n/en.js'
import { hasKey } from '../src/i18n/index.js'
import { withHome } from './cli-harness.js'

/**
 * The grok-build screen walk, on the verify-codex-auth pattern: every action
 * is run and every list item descended, but only through `run()` -- `submit()`
 * and `confirm()` are the writes -- asserting both that painted strings
 * resolve and that every labelKey, helpKey, detailKey and choice label exists.
 * The data-safety checks live in verify-grok-build.ts.
 */

const SECRET = 'sk-TEST-DO-NOT-USE-0123456789'

const CONFIG_WITH_EXTRAS = `# grok config
[models]
temperature = 0.5

[model.relay]
model = "claude-x"
base_url = "https://r.example/v1"
api_key = "${SECRET}"
extra_headers = { "x-custom" = "keep" }
`

/** t() returns the key itself on a miss, so a key-shaped string that is not in
 *  the catalog paints at the user. Indirect keys are checked against the
 *  catalog directly, since a grep for t('...') cannot see them. */
const PREFIXES = new Set(
  [...Object.keys(en), ...Object.keys(grokBuildMessages['en'] ?? {})].map((key) => key.split('.')[0]),
)
const KEY_SHAPE = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+$/

function assertResolved(text: string, where: string): void {
  if (!KEY_SHAPE.test(text)) return
  if (!PREFIXES.has(text.split('.')[0] ?? '')) return
  assert.ok(hasKey(text), `An i18n key was painted unresolved at ${where}: ${text}`)
}

function assertKeyExists(key: string | undefined, where: string): void {
  if (key === undefined) return
  assert.ok(hasKey(key), `A screen references a missing i18n key at ${where}: ${key}`)
}

function itemsOf(screen: ActionResult): ListItem[] {
  if (screen.kind === 'list' || screen.kind === 'status') return screen.items
  return []
}

function inspectForm(screen: Extract<ActionResult, { kind: 'form' }>, where: string): void {
  for (const field of screen.fields) {
    assertKeyExists(field.labelKey, `${where}/${field.id}.labelKey`)
    assertKeyExists(field.helpKey, `${where}/${field.id}.helpKey`)
    for (const choice of field.choices ?? []) assertKeyExists(choice.labelKey, `${where}/${field.id}.choice`)
  }
}

function inspectStatus(screen: Extract<ActionResult, { kind: 'status' }>, where: string): void {
  for (const section of screen.sections) {
    assertResolved(section.title, `${where}/section`)
    if (section.note !== undefined) assertResolved(section.note, `${where}/note`)
    for (const line of section.lines) {
      assertResolved(line.label, `${where}/label`)
      assertResolved(line.value, `${where}/value`)
    }
  }
}

function inspect(screen: ActionResult, where: string): void {
  assertResolved(screen.title, `${where}/title`)
  if (screen.kind === 'form') inspectForm(screen, where)
  if (screen.kind === 'status') inspectStatus(screen, where)
  if (screen.kind === 'message' || screen.kind === 'confirm') {
    for (const line of screen.lines) assertResolved(line, `${where}/line`)
  }
  if (screen.kind === 'confirm') assertResolved(screen.confirmLabel, `${where}/confirmLabel`)
  for (const item of itemsOf(screen)) {
    assertResolved(item.label, `${where}/${item.id}.label`)
    if (item.detail !== undefined) assertResolved(item.detail, `${where}/${item.id}.detail`)
  }
}

/** Only run() is called; confirm() and submit() are the writes. */
async function descend(screen: ActionResult, where: string, depth: number): Promise<void> {
  inspect(screen, where)
  if (depth === 0) return
  for (const item of itemsOf(screen)) await descend(await item.run(), `${where}/${item.id}`, depth - 1)
}

async function checkScreens(home: string): Promise<void> {
  const target = configPath(home)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, CONFIG_WITH_EXTRAS, { mode: 0o600 })
  const ctx: Ctx = { home }
  for (const action of grokBuildActions()) {
    assertKeyExists(action.labelKey, `${action.id}.labelKey`)
    assertKeyExists(action.detailKey ?? `${action.labelKey}Detail`, `${action.id}.detailKey`)
    await descend(await action.run(ctx), action.id, 3)
  }
}

async function main(): Promise<void> {
  await withHome('grok-screens', checkScreens)
  process.stdout.write('grok-build screen walk passed.\n')
}

await main()
