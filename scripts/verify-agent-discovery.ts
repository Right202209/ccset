import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { claudeCode } from '../src/agents/claude-code/index.js'
import { claudeDir } from '../src/agents/claude-code/paths.js'
import { opencode } from '../src/agents/opencode/index.js'
import { opencodeDir } from '../src/agents/opencode/paths.js'
import { t } from '../src/i18n/index.js'
import { AGENTS } from '../src/registry.js'
import type { Agent, Viewport } from '../src/types.js'
import { handleEscape, MouseDecoder, registerActiveMouseDecoder, registerMouseMode } from '../src/ui/mouse.js'
import type { Terminal } from '../src/ui/terminal.js'
import { DOWN, ENTER, ESC, UiSession } from './ui-session.js'

/**
 * Local detection decides what the TUI selector offers (ADR 0016). Each case
 * runs against real files in a scratch home, because detection reads the disk
 * and nothing else.
 */

/** Registered, but its check fails: it has to read as absent, not present. */
const THROWING_AGENT: Agent = {
  ...opencode,
  id: 'throwing-detect',
  name: 'Throwing Detect Agent',
  detect: async () => {
    throw new Error('detect failed')
  },
}

const UNDETECTED_AGENT: Agent = {
  ...opencode,
  id: 'uninstalled-agent',
  name: 'Uninstalled Agent',
  detect: async () => false,
}

async function withScratchHome(run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ccset-ui-discovery-'))
  try {
    await run(home)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}

async function withSession(
  session: UiSession,
  run: (session: UiSession) => Promise<void>,
): Promise<void> {
  try {
    await run(session)
  } finally {
    session.stop()
  }
}

function assertNeverPainted(paints: string[], text: string, message: string): void {
  for (const paint of paints) {
    assert.equal(paint.includes(text), false, `${message}:\n${paint}`)
  }
}

/** No Agent in the home: no options, a title that says so, and the way out. */
async function verifyEmptyHome(terminal: Terminal, viewport: Viewport): Promise<void> {
  await withScratchHome(async (home) => {
    const session = new UiSession(home, terminal, { viewport })
    await withSession(session, async () => {
      const paint = await session.waitFor(terminal.fold(t('menu.noDetectedAgentsHint')))
      assert.ok(paint.includes(terminal.fold(t('menu.noDetectedAgents'))), paint)
      assert.ok(paint.includes(terminal.fold(t('menu.noAgentsTitle'))), paint)
      assert.equal(paint.includes(t('menu.agentTitle')), false, `Empty state titled as a selector:\n${paint}`)
      for (const agent of AGENTS) {
        assertNeverPainted(session.paints(), agent.name, `Empty home exposed ${agent.id}`)
      }
    })
  })
}

/** One detected Agent is entered directly: the main menu paints with no key sent. */
async function verifySingleDetectedOpensDirectly(terminal: Terminal, viewport: Viewport): Promise<void> {
  await withScratchHome(async (home) => {
    await fs.mkdir(claudeDir(home), { recursive: true })
    const session = new UiSession(home, terminal, { viewport })
    await withSession(session, async () => {
      await session.waitFor(terminal.fold(t('app.agent', { name: claudeCode.name })))
      await session.waitFor(terminal.fold(t('action.testDetail')))
      for (const agent of AGENTS.filter((candidate) => candidate.id !== claudeCode.id)) {
        assertNeverPainted(session.paints(), agent.name, `The undetected ${agent.id} was offered`)
      }
    })
  })
}

/** A detect() that throws hides its Agent; the detected ones are still listed. */
async function verifyFailedDetectionIsHidden(
  home: string,
  terminal: Terminal,
  viewport: Viewport,
): Promise<void> {
  const agents = [claudeCode, opencode, THROWING_AGENT]
  const session = new UiSession(home, terminal, { agents, viewport })
  await withSession(session, async () => {
    await session.waitFor(opencode.name)
    assert.ok(session.paint().includes(claudeCode.name), session.paint())
    assertNeverPainted(session.paints(), THROWING_AGENT.name, 'An Agent whose detect() threw was offered')
  })
}

async function verifyCanChangeAgent(
  home: string,
  terminal: Terminal,
  viewport: Viewport,
): Promise<void> {
  const agents = [claudeCode, opencode]
  const session = new UiSession(home, terminal, { agents, viewport })
  await withSession(session, async () => {
    await session.waitFor(`${session.focusedRow('1.')} ${claudeCode.name}`)
    await session.send(ENTER)
    await session.waitFor(t('menu.changeAgent'))
    await session.sendEach(DOWN, claudeCode.getActions().length)
    await session.send(ENTER)
    const selector = await session.waitFor(t('menu.agentTitle'))
    assert.ok(selector.includes(claudeCode.name), selector)
    assert.ok(selector.includes(opencode.name), selector)
    await session.send(DOWN)
    await session.send(ENTER)
    await session.waitFor(t('app.agent', { name: opencode.name }))
    await session.send(ESC)
    await session.waitFor(t('menu.agentTitle'))
  })
}

async function verifyExplicitAgentChangeFilters(
  terminal: Terminal,
  viewport: Viewport,
): Promise<void> {
  await withScratchHome(async (home) => {
    await Promise.all([
      fs.mkdir(claudeDir(home), { recursive: true }),
      fs.mkdir(opencodeDir(home), { recursive: true }),
    ])
    const agents = [claudeCode, opencode, UNDETECTED_AGENT]
    const session = new UiSession(home, terminal, { agents, agentId: opencode.id, viewport })
    await withSession(session, async () => {
      await session.waitFor(t('app.agent', { name: opencode.name }))
      await session.sendEach(DOWN, opencode.getActions().length)
      await session.send(ENTER)
      const selector = await session.waitFor(t('menu.agentTitle'))
      assert.ok(selector.includes(claudeCode.name), selector)
      assert.ok(selector.includes(opencode.name), selector)
      assert.equal(selector.includes(UNDETECTED_AGENT.name), false, selector)
    })
  })
}

async function verifyPartialMouseDigitIsIgnored(terminal: Terminal, viewport: Viewport): Promise<void> {
  await withScratchHome(async (home) => {
    await fs.mkdir(claudeDir(home), { recursive: true })
    const session = new UiSession(home, terminal, { agents: [claudeCode], agentId: claudeCode.id, viewport })
    await withSession(session, async () => {
      await session.waitFor(t('menu.changeAgent'))
      await session.send('\x1b[<0;1;')
      await session.send('4')
      assert.ok(session.paint().includes(t('menu.changeAgent')), 'A digit inside a partial mouse code selected a row')
    })
  })
}

async function verifyMouseRegistrations(): Promise<void> {
  const exitWrites: string[] = []
  const exitOutput = { write: (sequence: string): number => exitWrites.push(sequence) }
  const listenersBefore = process.listeners('exit')
  const releaseExitMode = registerMouseMode(exitOutput)
  const exitRestore = process.listeners('exit').find((listener) => !listenersBefore.includes(listener))
  assert.ok(exitRestore, 'Mouse mode did not register process-exit cleanup')
  Reflect.apply(exitRestore, process, [0])
  assert.deepEqual(exitWrites, ['\x1b[?1000h\x1b[?1006h', '\x1b[?1006l\x1b[?1000l'])
  releaseExitMode()

  const writes: string[] = []
  const output = { write: (sequence: string): number => writes.push(sequence) }
  const releaseMode = registerMouseMode(output)
  const releaseSecondMode = registerMouseMode(output)
  releaseMode()
  assert.deepEqual(writes, ['\x1b[?1000h\x1b[?1006h'])
  releaseSecondMode()
  assert.deepEqual(writes, ['\x1b[?1000h\x1b[?1006h', '\x1b[?1006l\x1b[?1000l'])

  const oldDecoder = new MouseDecoder(() => undefined)
  const currentDecoder = new MouseDecoder(() => undefined)
  const unregisterOld = registerActiveMouseDecoder(oldDecoder)
  const unregisterCurrent = registerActiveMouseDecoder(currentDecoder)
  currentDecoder.push('\x1b[<0;1;')
  unregisterOld()
  let escaped = false
  handleEscape(() => (escaped = true))
  assert.equal(escaped, false, 'Cleaning up an older list removed the active mouse decoder')
  await new Promise((resolve) => setTimeout(resolve, 150))
  assert.equal(escaped, true, 'Escape was not released after the partial mouse code timed out')
  unregisterCurrent()
  oldDecoder.dispose()
  currentDecoder.dispose()
}

/** `home` must already hold Claude Code and opencode files. */
export async function verifyAgentDiscovery(
  home: string,
  terminal: Terminal,
  viewport: Viewport,
): Promise<void> {
  await verifyEmptyHome(terminal, viewport)
  await verifySingleDetectedOpensDirectly(terminal, viewport)
  await verifyCanChangeAgent(home, terminal, viewport)
  await verifyExplicitAgentChangeFilters(terminal, viewport)
  await verifyPartialMouseDigitIsIgnored(terminal, viewport)
  await verifyFailedDetectionIsHidden(home, terminal, viewport)
  await verifyMouseRegistrations()
}
