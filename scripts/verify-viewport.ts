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
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `status-action-${index + 1}`,
    label: `Status action ${index + 1}`,
    run: async () => ({ kind: 'message' as const, title: 'Done', lines: ['done'], tone: 'info' as const }),
  }))
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
          lines: [{ label: 'Value', value: `status-value-${index + 1}` }],
        })),
        items,
      }),
    }],
  }
  const session = new UiSession(home, UNICODE_TERMINAL, { agents: [agent], viewport })
  try {
    await session.waitFor('Long status screen')
    await session.send('1')
    const paint = await session.waitFor('Status action 1')
    assertPainted(paint, 'Showing 1-2 of 12', 'The Status actions have no bounded window')
    assertPaintsFit(session.paints(), viewport)
  } finally {
    session.stop()
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
  await verifyNarrowList(home)
  await verifyLongForm(home)
}
