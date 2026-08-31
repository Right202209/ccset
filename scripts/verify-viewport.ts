import assert from 'node:assert/strict'
import type { Agent, Viewport } from '../src/types.js'
import { UNICODE_TERMINAL } from '../src/ui/terminal.js'
import { assertPaintsFit } from './ui-assertions.js'
import { DOWN, UiSession } from './ui-session.js'

function assertPainted(paint: string, text: string, missing: string): void {
  assert.ok(paint.includes(text), `${missing}:\n${paint}`)
}

async function verifyLongList(home: string, viewport: Viewport): Promise<void> {
  let selected = ''
  const actions = Array.from({ length: 12 }, (_, index) => ({
    id: `action-${index + 1}`,
    labelKey: `Long action ${index + 1}`,
    run: async () => {
      selected = `action-${index + 1}`
      return { kind: 'message' as const, title: 'Selected', lines: [selected], tone: 'info' as const }
    },
  }))
  const agent: Agent = {
    id: 'long-list',
    name: 'Long list',
    detect: async () => true,
    getActions: () => actions,
  }
  const session = new UiSession(home, UNICODE_TERMINAL, { agents: [agent], viewport })
  try {
    let paint = await session.waitFor('Long action 1')
    assertPainted(paint, 'Showing 1-4 of 13', 'The long menu has no count line')
    await session.sendEach(DOWN, 4)
    paint = await session.waitFor('Long action 5')
    assertPainted(paint, 'Showing 2-5 of 13', 'The window did not follow focus')
    await session.send('9')
    assert.equal(selected, '', 'A shortcut selected a hidden row')
    await session.send('1')
    await session.waitFor('action-2')
    assert.equal(selected, 'action-2', 'Shortcut 1 did not select the first visible row')
    assertPaintsFit(session.paints(), viewport)
  } finally {
    session.stop()
  }
}

async function verifyLongStatus(home: string, viewport: Viewport): Promise<void> {
  const longValue = 'status-value-start '.repeat(4) + 'status-value-end'
  const items = [{
    id: 'status-action',
    label: 'Status action',
    run: async () => ({ kind: 'message' as const, title: 'Done', lines: ['status-action-ran'], tone: 'info' as const }),
  }]
  const agent: Agent = {
    id: 'long-status',
    name: 'Long status',
    detect: async () => true,
    getActions: () => [{
      id: 'status',
      labelKey: 'Long status screen',
      run: async () => ({
        kind: 'status' as const,
        title: 'Long status screen',
        sections: Array.from({ length: 8 }, (_, index) => ({
          title: `Section ${index + 1}`,
          lines: [{ label: 'Value', value: index === 0 ? longValue : `status-value-${index + 1}` }],
        })),
        items,
      }),
    }],
  }
  const session = new UiSession(home, UNICODE_TERMINAL, { agents: [agent], viewport })
  try {
    await session.waitFor('Long status screen')
    await session.send('1')
    const paint = await session.waitFor('Status action')
    assertPainted(paint, 'Showing 1-4 of 17', 'The Status sections have no count line')
    assertPainted(paint, 'status-value-end', 'The long Status value was truncated instead of wrapped')
    await session.send('1')
    await session.waitFor('status-action-ran')
    assertPaintsFit(session.paints(), viewport)
  } finally {
    session.stop()
  }
}

async function verifyShortStatus(home: string): Promise<void> {
  const viewport: Viewport = { rows: 2, columns: 80 }
  const agent: Agent = {
    id: 'short-status',
    name: 'Short status',
    detect: async () => true,
    getActions: () => [{
      id: 'status',
      labelKey: 'Short status screen',
      run: async () => ({
        kind: 'status' as const,
        title: 'Short status screen',
        sections: [{
          title: 'Section',
          lines: [
            { label: 'Value', value: 'status value' },
            { label: 'Mode', value: 'status mode' },
          ],
        }],
        items: [{
          id: 'status-action',
          label: 'Status action',
          run: async () => ({ kind: 'message' as const, title: 'Done', lines: ['short-status-action-ran'], tone: 'info' as const }),
        }],
      }),
    }],
  }
  const session = new UiSession(home, UNICODE_TERMINAL, { agents: [agent], viewport })
  try {
    await session.waitFor('Short status screen')
    await session.send('1')
    let paint = await session.waitFor('Status action')
    assertPainted(paint, 'Showing 0-0 of 3', 'The shortest Status has no sections count line')
    assertPaintsFit([paint], viewport)
    await session.send('1')
    paint = await session.waitFor('short-status-action-ran')
  } finally {
    session.stop()
  }

  const oneRowViewport: Viewport = { rows: 1, columns: 80 }
  const oneRowSession = new UiSession(home, UNICODE_TERMINAL, {
    agents: [agent],
    viewport: oneRowViewport,
  })
  try {
    await oneRowSession.waitFor('Short status screen')
    await oneRowSession.send('1')
    const paint = await oneRowSession.waitFor('Status action')
    assertPaintsFit([paint], oneRowViewport)
    await oneRowSession.send('1')
    await oneRowSession.waitFor('short-status-action-ran')
  } finally {
    oneRowSession.stop()
  }
}

async function verifyNarrowList(home: string): Promise<void> {
  const viewport: Viewport = { rows: 12, columns: 40 }
  const agent: Agent = {
    id: 'narrow-list',
    name: 'Narrow list',
    detect: async () => true,
    getActions: () => [{
      id: 'open',
      labelKey: 'Open long list',
      run: async () => ({
        kind: 'list' as const,
        title: 'Long details',
        items: Array.from({ length: 12 }, (_, index) => ({
          id: `detail-${index + 1}`,
          label: `Detail ${index + 1}`,
          detail: 'A detail long enough to wrap in a narrow terminal',
          run: async () => ({ kind: 'message' as const, title: 'Done', lines: ['done'], tone: 'info' as const }),
        })),
      }),
    }],
  }
  const session = new UiSession(home, UNICODE_TERMINAL, { agents: [agent], viewport })
  try {
    await session.waitFor('Open long list')
    await session.send('1')
    await session.waitFor('Showing 1-1 of 12')
    assertPaintsFit(session.paints(), viewport)
  } finally {
    session.stop()
  }
}

async function verifyLongForm(home: string): Promise<void> {
  const viewport: Viewport = { rows: 18, columns: 60 }
  const longText = 'long-form-content-'.repeat(12)
  const agent: Agent = {
    id: 'long-form',
    name: 'Long form',
    detect: async () => true,
    getActions: () => [{
      id: 'form',
      labelKey: 'Open long form',
      run: async () => ({
        kind: 'form' as const,
        title: 'Long form',
        fields: [{ id: 'value', labelKey: 'Long value', type: 'text' as const, helpKey: 'Long help' }],
        values: { value: longText },
        baseline: { value: longText },
        notes: [longText, longText, longText],
        submit: async () => ({ kind: 'message' as const, title: 'Done', lines: ['done'], tone: 'info' as const }),
      }),
    }],
  }
  const session = new UiSession(home, UNICODE_TERMINAL, { agents: [agent], viewport })
  try {
    await session.waitFor('Open long form')
    await session.send('1')
    await session.waitFor('Long value')
    assertPaintsFit(session.paints(), viewport)
  } finally {
    session.stop()
  }
}

export async function verifyViewportScenarios(home: string, viewport: Viewport): Promise<void> {
  await verifyLongList(home, viewport)
  await verifyLongStatus(home, viewport)
  await verifyShortStatus(home)
  await verifyNarrowList(home)
  await verifyLongForm(home)
}
