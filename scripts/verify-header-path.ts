import assert from 'node:assert/strict'
import type { ActionResult, Agent, ListItem, Viewport } from '../src/types.js'
import { t } from '../src/i18n/index.js'
import { ASCII_TERMINAL, UNICODE_TERMINAL, type Terminal } from '../src/ui/terminal.js'
import { UiSession } from './ui-session.js'

const HOME = '/header-path-verification'
const WIDE: Viewport = { rows: 24, columns: 80 }
const NARROW: Viewport = { rows: 24, columns: 50 }

const ROOT_TITLE = '第一目的地'
const MIDDLE_TITLE = 'Second destination'
const LEAF_TITLE = 'Final destination'

function nextItem(id: string, label: string, screen: ActionResult): ListItem {
  return { id, label, run: async () => screen }
}

const leaf: ActionResult = {
  kind: 'list',
  title: LEAF_TITLE,
  items: [
    nextItem('stay', 'Stay here', { kind: 'message', title: 'Done', lines: ['Done'], tone: 'info' }),
  ],
}
const middle: ActionResult = {
  kind: 'list',
  title: MIDDLE_TITLE,
  items: [nextItem('leaf', 'Open final destination', leaf)],
}
const root: ActionResult = {
  kind: 'list',
  title: ROOT_TITLE,
  items: [nextItem('middle', 'Open second destination', middle)],
}

const agent: Agent = {
  id: 'header-path',
  name: 'Header path',
  detect: async () => true,
  getActions: () => [
    {
      id: 'open',
      labelKey: 'action.global',
      run: async () => root,
    },
  ],
}

async function openLeaf(session: UiSession): Promise<string> {
  await session.waitFor(t('action.globalDetail'))
  await session.send('1')
  await session.waitFor(ROOT_TITLE)
  await session.send('1')
  await session.waitFor(MIDDLE_TITLE)
  await session.send('1')
  return session.waitFor(LEAF_TITLE)
}

async function verify(
  terminal: Terminal,
  viewport: Viewport,
  expected: string,
  forbidden: string,
): Promise<void> {
  const session = new UiSession(HOME, terminal, { agents: [agent], viewport })
  try {
    const top = await session.waitFor(t('action.globalDetail'))
    const topHeader = top.split('\n').find((line) => line.includes('Agent: Header path')) ?? ''
    assert.equal(
      topHeader.includes(terminal.glyphs.pathSeparator),
      false,
      'Top-level header shows a Frame path',
    )
    const paint = await openLeaf(session)
    assert.ok(paint.includes(expected), `Header path is missing:\n${paint}`)
    assert.equal(paint.includes(forbidden), false, `Header path did not truncate:\n${paint}`)
  } finally {
    session.stop()
  }
}

await verify(
  UNICODE_TERMINAL,
  WIDE,
  `${ROOT_TITLE} › ${MIDDLE_TITLE} › ${LEAF_TITLE}`,
  '… ›',
)
await verify(
  UNICODE_TERMINAL,
  NARROW,
  `… › ${MIDDLE_TITLE} › ${LEAF_TITLE}`,
  ROOT_TITLE,
)
await verify(
  ASCII_TERMINAL,
  NARROW,
  `... > ${MIDDLE_TITLE} > ${LEAF_TITLE}`,
  ROOT_TITLE,
)

process.stdout.write('Header path verification passed.\n')
