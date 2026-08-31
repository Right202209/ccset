import assert from 'node:assert/strict'
import React from 'react'
import { render } from 'ink-testing-library'
import type { FieldSpec, FormScreen, FormValues } from '../src/types.js'
import { t } from '../src/i18n/index.js'
import { ReviewForm } from '../src/ui/ReviewForm.js'
import { ViewportProvider } from '../src/ui/Viewport.js'

const CTRL_S = '\x13'
const ENTER = '\r'
const DOWN = '\x1b[B'
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

function mount(form: FormScreen, rows = 24): {
  instance: ReturnType<typeof render>
  submissions: FormValues[]
} {
  const submissions: FormValues[] = []
  const instance = render(
    <ViewportProvider viewport={{ rows, columns: 80 }}>
      <ReviewForm
        screen={form}
        onSubmit={(values) => submissions.push(values)}
        onCancel={() => undefined}
        onDirtyChange={() => undefined}
      />
    </ViewportProvider>,
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
  const form = screen({
    values: { name: 'acme', advanced: '' },
    baseline: { name: 'acme', advanced: '' },
  })
  const { instance, submissions } = mount(form)
  await send(instance, CTRL_S)
  const paint = instance.lastFrame() ?? ''
  assert.equal(submissions.length, 0)
  assert.match(paint, new RegExp(`❯ ${t('field.baseUrl')}`))
  assert.ok(paint.includes(t('validate.required')))
  instance.unmount()
}

async function verifyAdvancedToggleKeepsFocus(): Promise<void> {
  const manyFields: FieldSpec[] = [
    { id: 'one', labelKey: 'Basic one', type: 'text' },
    { id: 'two', labelKey: 'Basic two', type: 'text' },
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `advanced-${index + 1}`,
      labelKey: `Advanced ${index + 1}`,
      type: 'text' as const,
      advanced: true,
    })),
  ]
  const { instance } = mount(screen({ fields: manyFields }), 10)
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
    {
      id: 'required',
      labelKey: 'Required value',
      helpKey: 'Required help',
      suggestions: ['first', 'second'],
      type: 'text',
      required: true,
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `field-${index + 1}`,
      labelKey: `Field ${index + 1}`,
      type: 'text' as const,
    })),
  ]
  const { instance } = mount(screen({
    fields: detailedFields,
    values: { required: '' },
    baseline: { required: '' },
  }), 10)
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
  }), 8).instance
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
  const { instance } = mount(screen({ fields: manyFields }), 6)
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

await verifyCtrlSSavesFromAField()
await verifyEnterStillMoves()
await verifyCtrlSRevealsInvalidAdvancedField()
await verifyAdvancedToggleKeepsFocus()
await verifyHintsAndErrorConsumeRows()
await verifyControlsStayReachable()
process.stdout.write('Review form verification passed.\n')
