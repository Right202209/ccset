import assert from 'node:assert/strict'
import {
  pathTitle,
  planLayout,
  SIDEBAR_WIDE_WIDTH,
  SIDEBAR_WIDTH,
  STRIP_ROWS,
} from '../src/ui/Layout.js'
import { planSide } from '../src/ui/side-plan.js'
import { padEnd, truncateEnd, truncateStart, wrappedRows } from '../src/ui/text-fit.js'

/**
 * The layout's pure rules, asserted without rendering: what the chrome costs
 * at each size, how the navigation path fits a border, and how text is cut.
 * Called by verify-layout; kept apart so neither file outgrows the limit.
 */

const SHORT_HELP = 'x'.repeat(60)
const LONG_HELP = 'word '.repeat(30).trim()

function verifyPlan(): void {
  assert.equal(planLayout({ rows: 6, columns: 80 }, SHORT_HELP, true).framed, false, 'a frame at six rows')
  assert.equal(planLayout({ rows: 24, columns: 29 }, SHORT_HELP, true).framed, false, 'a frame at 29 columns')
  const unframed = planLayout({ rows: 6, columns: 80 }, SHORT_HELP, true)
  assert.deepEqual(unframed.body, { rows: 6, columns: 80 }, 'an unframed View lost part of the terminal')

  // Four border rows; the frame's sides, the Panel's sides, and its padding.
  const plain = planLayout({ rows: 24, columns: 80 }, SHORT_HELP, true)
  assert.deepEqual(plain.body, { rows: 19 - STRIP_ROWS, columns: 74 })
  assert.equal(plain.helpInBorder, true)
  assert.equal(plain.mode, 'strip', 'the detail strip at 80 columns')

  const wide = planLayout({ rows: 24, columns: 100 }, SHORT_HELP, true)
  assert.equal(wide.mode, 'side')
  assert.equal(wide.sidebarWidth, SIDEBAR_WIDTH)
  assert.equal(wide.body.columns, 100 - 2 - 26 - 1 - 4, 'the side column was not paid for')
  assert.equal(planLayout({ rows: 24, columns: 130 }, SHORT_HELP, true).sidebarWidth, SIDEBAR_WIDE_WIDTH)
  assert.equal(planLayout({ rows: 24, columns: 129 }, SHORT_HELP, true).sidebarWidth, SIDEBAR_WIDTH)
  assert.equal(planLayout({ rows: 24, columns: 80 }, SHORT_HELP, true).mode, 'strip')
  assert.equal(planLayout({ rows: 24, columns: 99 }, SHORT_HELP, true).mode, 'strip')
  assert.equal(planLayout({ rows: 24, columns: 79 }, SHORT_HELP, true).mode, 'none')
  assert.equal(planLayout({ rows: 19, columns: 90 }, SHORT_HELP, true).mode, 'none')
  assert.equal(planLayout({ rows: 20, columns: 90 }, SHORT_HELP, true).mode, 'strip')
  assert.equal(planLayout({ rows: 24, columns: 90 }, SHORT_HELP, true).body.rows, 24 - 4 - STRIP_ROWS - 1)
  assert.notEqual(planLayout({ rows: 15, columns: 100 }, SHORT_HELP, true).mode, 'side', 'side Panels at 15 rows')
  assert.equal(planLayout({ rows: 24, columns: 100 }, SHORT_HELP, false).mode, 'none', 'room kept for no Panels')

  // Help too wide for the border wraps inside the frame, and only where rows can be spared.
  const tall = planLayout({ rows: 24, columns: 80 }, LONG_HELP, false)
  assert.equal(tall.helpInBorder, false)
  assert.equal(tall.helpLines.length, wrappedRows(LONG_HELP, 76))
  assert.equal(tall.body.rows, 23 - 4 - tall.helpLines.length, 'wrapped help rows and a spare terminal row were not reserved')
  const short = planLayout({ rows: 12, columns: 80 }, LONG_HELP, false)
  assert.deepEqual(short.helpLines, [])
  assert.equal(short.body.rows, 7)
}

function verifyPathTitle(): void {
  const trail = ['first', 'second', 'third']
  const unicode = { separator: ' › ', ellipsis: '…' }
  assert.equal(pathTitle(trail, 40, unicode), 'first › second › third')
  // Too long whole: the last two Frames behind an ellipsis.
  assert.equal(pathTitle(trail, 18, unicode), '… › second › third')
  assert.equal(pathTitle(trail, 20, { separator: ' > ', ellipsis: '...' }), '... > second > third')
  // Still too long: characters go from the front, never the current Screen's.
  assert.equal(pathTitle(trail, 10, unicode), '…d › third')
  assert.equal(pathTitle(['one screen title'], 8, unicode), '…n title')
}

function verifyTextFit(): void {
  assert.equal(truncateEnd('abcdef', 6, '…'), 'abcdef')
  assert.equal(truncateEnd('abcdef', 4, '…'), 'abc…')
  assert.equal(truncateEnd('abcdef', 4, '...'), 'a...', 'the ASCII ellipsis was not budgeted')
  assert.equal(truncateEnd('abcdef', 2, '...'), 'ab', 'an ellipsis wider than the room was forced in')
  // Display width, not code units: a CJK character takes two columns and never straddles the edge.
  assert.equal(truncateEnd('中文字符', 6, '…'), '中文…')
  assert.equal(truncateStart('/home/user/project', 10, '…'), '…r/project')
  assert.equal(padEnd('中', 4), '中  ')
  assert.equal(padEnd('abcdef', 4), 'abcdef')
}

export function verifyLayoutRules(): void {
  verifyPlan()
  verifySidePlan()
  verifyPathTitle()
  verifyTextFit()
}

function verifySidePlan(): void {
  const planned = planSide(4, [
    { id: 'result', lines: 2 },
    { id: 'agent', lines: 3 },
    { id: 'config', lines: 4 },
    { id: 'preview', lines: 3 },
    { id: 'warnings', lines: 5 },
  ])
  assert.deepEqual(planned.map((panel) => panel.id), ['warnings'])
  assert.equal(planned[0]?.lines, 2)
  assert.equal(planned[0]?.more, 4)

  const priority = planSide(12, [
    { id: 'result', lines: 1 },
    { id: 'agent', lines: 1 },
    { id: 'config', lines: 1 },
    { id: 'preview', lines: 1 },
    { id: 'warnings', lines: 1 },
  ])
  assert.deepEqual(priority.map((panel) => panel.id), ['agent', 'config', 'preview', 'warnings'])

  const oneLine = planSide(3, [{ id: 'warnings', lines: 5 }])
  assert.equal(oneLine[0]?.lines, 1)
  assert.equal(oneLine[0]?.more, 5, 'a one-line warning panel must reserve its only row for +N more')
}
