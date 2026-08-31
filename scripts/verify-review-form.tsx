import assert from 'node:assert/strict'
import React from 'react'
import { render } from 'ink-testing-library'
import type { FieldSpec, FormScreen, FormValues } from '../src/types.js'
import { t } from '../src/i18n/index.js'
import { ReviewForm } from '../src/ui/ReviewForm.js'

const CTRL_S = '\x13'
const ENTER = '\r'
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

function mount(form: FormScreen): {
  instance: ReturnType<typeof render>
  submissions: FormValues[]
} {
  const submissions: FormValues[] = []
  const instance = render(
    <ReviewForm
      screen={form}
      onSubmit={(values) => submissions.push(values)}
      onCancel={() => undefined}
      onDirtyChange={() => undefined}
    />,
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

await verifyCtrlSSavesFromAField()
await verifyEnterStillMoves()
await verifyCtrlSRevealsInvalidAdvancedField()
process.stdout.write('Review form verification passed.\n')
