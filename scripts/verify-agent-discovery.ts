import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { claudeCode } from '../src/agents/claude-code/index.js'
import { claudeDir } from '../src/agents/claude-code/paths.js'
import { opencode } from '../src/agents/opencode/index.js'
import { t } from '../src/i18n/index.js'
import { AGENTS } from '../src/registry.js'
import type { Agent, Viewport } from '../src/types.js'
import type { Terminal } from '../src/ui/terminal.js'
import { UiSession } from './ui-session.js'

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

/** `home` must already hold Claude Code and opencode files. */
export async function verifyAgentDiscovery(
  home: string,
  terminal: Terminal,
  viewport: Viewport,
): Promise<void> {
  await verifyEmptyHome(terminal, viewport)
  await verifySingleDetectedOpensDirectly(terminal, viewport)
  await verifyFailedDetectionIsHidden(home, terminal, viewport)
}
