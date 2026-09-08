import assert from 'node:assert/strict'
import React from 'react'
import { render } from 'ink-testing-library'
import stringWidth from 'string-width'
import type { FieldSpec, FormScreen, FormValues } from '../src/types.js'
import { t } from '../src/i18n/index.js'
import { ReviewForm } from '../src/ui/ReviewForm.js'
import { ViewportProvider } from '../src/ui/Viewport.js'
import { stripAnsi } from './ui-assertions.js'
import { ASCII_TERMINAL, TerminalContext, UNICODE_TERMINAL, type Terminal } from '../src/ui/terminal.js'

const CTRL_S = '\x13'
const ENTER = '\r'
const DOWN = '\x1b[B'
const RIGHT = '\x1b[C'
const POLL_MS = 10
const WAIT_TIMEOUT_MS = 5_000

const fields: FieldSpec[] = [
  { id: 'name', labelKey: 'field.providerName', type: 'text' },
  { id: 'advanced', labelKey: 'field.baseUrl', type: 'text', advanced: true, required: true },
]

function screen(overrides: Partial<FormScreen> = {}): FormScreen {
  return {
    kind: 'form',
    title: 'Review form verification',
    fields,
    values: { name: 'acme', advanced: 'https://example.com' },
    baseline: { name: 'acme', advanced: 'https://example.com' },
    submit: async () => ({ kind: 'message', title: 'saved', lines: [], tone: 'success' }),
    ...overrides,
  }
}

interface MountOptions {
  rows?: number
  columns?: number
  terminal?: Terminal
}

function mount(form: FormScreen, options: MountOptions = {}): {
  instance: ReturnType<typeof render>
  submissions: FormValues[]
} {
  const { rows = 24, columns = 80, terminal = UNICODE_TERMINAL } = options
  const submissions: FormValues[] = []
  const instance = render(
    <TerminalContext.Provider value={terminal}>
      <ViewportProvider viewport={{ rows, columns }}>
        <ReviewForm
          screen={form}
          onSubmit={(values) => submissions.push(values)}
          onCancel={() => undefined}
          onDirtyChange={() => undefined}
        />
      </ViewportProvider>
    </TerminalContext.Provider>,
  )
  return { instance, submissions }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function send(instance: ReturnType<typeof render>, input: string): Promise<void> {
  const deadline = Date.now() + WAIT_TIMEOUT_MS
  do {
    instance.stdin.write(input)
    await sleep(POLL_MS)
  } while (instance.stdin.data !== null && Date.now() < deadline)
  assert.equal(instance.stdin.data, null, `Ink never read ${JSON.stringify(input)}`)
}

async function verifyCtrlSSavesFromAField(): Promise<void> {
  const { instance, submissions } = mount(screen())
  await send(instance, CTRL_S)
  assert.deepEqual(submissions, [{ name: 'acme', advanced: 'https://example.com' }])
  assert.match(instance.lastFrame() ?? '', /ctrl\+s save/)
  instance.unmount()
}

async function verifyEnterStillMoves(): Promise<void> {
  const { instance, submissions } = mount(screen())
  await send(instance, ENTER)
  assert.equal(submissions.length, 0)
  assert.match(instance.lastFrame() ?? '', new RegExp(`❯ ${t('form.showAdvanced')}`))
  instance.unmount()
}

async function verifyCtrlSRevealsInvalidAdvancedField(): Promise<void> {
  const { instance, submissions } = mount(screen({
    values: { name: 'acme', advanced: '' },
    baseline: { name: 'acme', advanced: '' },
  }))
  await send(instance, CTRL_S)
  const paint = instance.lastFrame() ?? ''
  assert.equal(submissions.length, 0)
  assert.match(paint, new RegExp(`❯ ${t('field.baseUrl')}`))
  assert.ok(paint.includes(t('validate.required')))
  instance.unmount()
}

// Ctrl+S belongs to the form: a blocked save must not leave the editor's own
// `s` behind in the focused field, where a later save would persist it.
async function verifyCtrlSLeavesTheTextAlone(): Promise<void> {
  const { instance, submissions } = mount(screen({
    values: { name: 'acme', advanced: '' },
    baseline: { name: 'acme', advanced: '' },
  }))
  await send(instance, CTRL_S)
  const paint = stripAnsi(instance.lastFrame() ?? '')
  assert.equal(paint.includes('acme'), true, 'the focused value vanished')
  assert.equal(paint.includes('acmes'), false, 'ctrl+s inserted its s into the focused field')

  await send(instance, 'https://example.com')
  await send(instance, CTRL_S)
  assert.equal(submissions.length, 1, 'the follow-up save never ran')
  assert.equal(submissions[0]?.name, 'acme', 'a keystroke mutation survived into the save')
  instance.unmount()
}

// A value longer than the row scrolls: the cursor and its edits stay visible.
async function verifyLongValueKeepsCursorVisible(): Promise<void> {
  const longUrl = 'https://provider.example/very/long/path/that/overflows/eighty/columns'
  const values = { name: longUrl, advanced: '' }
  const { instance } = mount(screen({ values, baseline: values }), { columns: 80 })
  await send(instance, 'X')
  const tail = `${longUrl}X`.slice(-14)
  assert.ok(
    stripAnsi(instance.lastFrame() ?? '').includes(tail),
    `the cursor and the tail of a long value left the visible row`,
  )
  instance.unmount()
}

async function verifyAdvancedToggleKeepsFocus(): Promise<void> {
  const manyFields: FieldSpec[] = [
    { id: 'one', labelKey: 'Basic one', type: 'text' },
    { id: 'two', labelKey: 'Basic two', type: 'text' },
    ...Array.from({ length: 6 }, (_, index) => ({ id: `advanced-${index + 1}`, labelKey: `Advanced ${index + 1}`, type: 'text' as const, advanced: true })),
  ]
  const { instance } = mount(screen({ fields: manyFields }), { rows: 10 })
  await send(instance, DOWN)
  await send(instance, DOWN)
  await send(instance, ENTER)
  let paint = instance.lastFrame() ?? ''
  assert.match(paint, new RegExp(`❯ ${t('form.hideAdvanced')}`))
  assert.ok(paint.includes('Showing 6-9 of 11'), `Expanded form did not re-window:\n${paint}`)
  await send(instance, ENTER)
  paint = instance.lastFrame() ?? ''
  assert.match(paint, new RegExp(`❯ ${t('form.showAdvanced')}`))
  instance.unmount()
}

async function verifyHintsAndErrorConsumeRows(): Promise<void> {
  const detailedFields: FieldSpec[] = [
    { id: 'required', labelKey: 'Required value', helpKey: 'Required help', suggestions: ['first', 'second'], type: 'text', required: true },
    ...Array.from({ length: 5 }, (_, index) => ({ id: `field-${index + 1}`, labelKey: `Field ${index + 1}`, type: 'text' as const })),
  ]
  const { instance } = mount(screen({
    fields: detailedFields,
    values: { required: '' },
    baseline: { required: '' },
  }), { rows: 10 })
  for (let index = 0; index < detailedFields.length; index += 1) await send(instance, DOWN)
  await send(instance, ENTER)
  const paint = instance.lastFrame() ?? ''
  assert.ok(paint.includes('Required help'), `Focused help is missing:\n${paint}`)
  assert.ok(paint.includes('first, second'), `Focused suggestions are missing:\n${paint}`)
  assert.ok(paint.includes(t('validate.required')), `Focused error is missing:\n${paint}`)
  assert.ok(paint.includes('Showing 1-1 of 8'), `Hint rows did not reduce the form window:\n${paint}`)
  instance.unmount()

  const tiny = mount(screen({
    fields: detailedFields,
    values: { required: '' },
    baseline: { required: '' },
  }), { rows: 8 }).instance
  for (let index = 0; index < detailedFields.length; index += 1) await send(tiny, DOWN)
  await send(tiny, ENTER)
  const tinyPaint = tiny.lastFrame() ?? ''
  assert.ok(tinyPaint.includes(t('validate.required')), `Tiny form hid the error:\n${tinyPaint}`)
  assert.ok(tinyPaint.split('\n').length <= 3, `Tiny form exceeded its row allocation:\n${tinyPaint}`)
  tiny.unmount()
}

async function verifyControlsStayReachable(): Promise<void> {
  const manyFields: FieldSpec[] = [
    { id: 'basic', labelKey: 'Basic', type: 'text' },
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `advanced-${index + 1}`,
      labelKey: `Advanced ${index + 1}`,
      type: 'text' as const,
      advanced: true,
    })),
  ]
  const { instance } = mount(screen({ fields: manyFields }), { rows: 6 })
  await send(instance, DOWN)
  await send(instance, ENTER)
  await send(instance, DOWN)
  let paint = instance.lastFrame() ?? ''
  assert.match(paint, new RegExp(`❯ ${t('form.save')}`))
  await send(instance, DOWN)
  paint = instance.lastFrame() ?? ''
  assert.match(paint, new RegExp(`❯ ${t('form.cancel')}`))
  instance.unmount()
}

function verifyWinningLayout(): void {
  const layoutFields: FieldSpec[] = [
    { id: 'short', labelKey: 'Short', helpKey: 'A focused hint', type: 'text' },
    { id: 'long', labelKey: 'Hidden advanced label', type: 'text', advanced: true },
  ]
  const layoutScreen = screen({
    fields: layoutFields,
    values: { short: 'value', long: 'hidden' },
    baseline: { short: 'value', long: 'hidden' },
  })

  for (const columns of [80, 60]) {
    for (const terminal of [UNICODE_TERMINAL, ASCII_TERMINAL]) {
      const { instance } = mount(layoutScreen, { columns, terminal })
      const paint = instance.lastFrame() ?? ''
      const lines = paint.split('\n')
      const fieldLine = lines.find((line) => line.includes('Short')) ?? ''
      const hintLine = lines.find((line) => line.includes('A focused hint')) ?? ''
      assert.match(fieldLine, /Short {19}value/, 'The hidden advanced label must size the stable column')
      assert.ok(hintLine.startsWith('    A focused hint'), `The hint did not use the tightened indent:\n${paint}`)
      assert.ok(
        [fieldLine, hintLine].every((line) => stringWidth(line) <= columns),
        `The winning layout exceeded ${columns} columns:\n${paint}`,
      )
      if (terminal === ASCII_TERMINAL) assert.match(paint, /^[\x20-\x7e\n\r\t]*$/)
      instance.unmount()
    }
  }
}

// Choices wrap under a one-line row's clip, so the row now renders a window
// anchored on the selected choice: the option being cycled onto stays visible.
async function verifyChoicesStayVisibleWhileCycling(): Promise<void> {
  const choiceFields: FieldSpec[] = [
    { id: 'name', labelKey: 'Name', type: 'text' },
    {
      id: 'pick',
      labelKey: 'Pick one',
      type: 'choice',
      choices: [
        { value: 'a', labelKey: 'Read-only sandbox mode' },
        { value: 'b', labelKey: 'Workspace-write sandbox mode' },
        { value: 'c', labelKey: 'Danger-full-access no sandbox' },
        { value: '', labelKey: 'Unmanaged by ccset entirely' },
      ],
    },
  ]
  const form = screen({
    fields: choiceFields,
    values: { name: 'acme', pick: 'a' },
    baseline: { name: 'acme', pick: 'a' },
  })
  const { instance } = mount(form, { columns: 80 })
  await send(instance, DOWN)
  for (let index = 0; index < 3; index += 1) await send(instance, RIGHT)
  const paint = stripAnsi(instance.lastFrame() ?? '')
  assert.ok(
    paint.includes('Unmanaged by ccset entirely'),
    `the selected choice left the visible row:\n${paint}`,
  )
  instance.unmount()
}

// The help line wraps at narrow widths; the footer must reserve what it renders.
async function verifyWrappedFooterStaysInBudget(): Promise<void> {
  const many = Array.from({ length: 14 }, (_, index) => ({
    id: `field-${index + 1}`,
    labelKey: `Field ${index + 1}`,
    type: 'text' as const,
  }))
  const { instance } = mount(screen({ fields: many }), { rows: 21, columns: 60 })
  const lines = (instance.lastFrame() ?? '').split('\n').length
  assert.ok(lines <= 16, `the form painted ${lines} rows against a 16-row budget`)
  instance.unmount()
}

await verifyCtrlSSavesFromAField()
await verifyEnterStillMoves()
await verifyCtrlSRevealsInvalidAdvancedField()
await verifyCtrlSLeavesTheTextAlone()
await verifyLongValueKeepsCursorVisible()
await verifyChoicesStayVisibleWhileCycling()
await verifyWrappedFooterStaysInBudget()
await verifyAdvancedToggleKeepsFocus()
await verifyHintsAndErrorConsumeRows()
await verifyControlsStayReachable()
verifyWinningLayout()
process.stdout.write('Review form verification passed.\n')
