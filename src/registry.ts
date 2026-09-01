import type { Agent } from './types.js'
import { registerMessages } from './i18n/index.js'
import { claudeCode } from './agents/claude-code/index.js'
import { opencode } from './agents/opencode/index.js'
import { codex } from './agents/codex/index.js'

/**
 * Hand-written and static. No filesystem scanning, no dynamic import(): the
 * published artifact is a bundle, a bundler cannot resolve a scanned path, and
 * an npx consumer cannot drop files into src/ anyway.
 *
 * Adding an agent is this line plus one module under src/agents/.
 */
export const AGENTS: Agent[] = [claudeCode, opencode, codex]

for (const agent of AGENTS) registerMessages(agent.messages)

export function findAgent(id: string): Agent | undefined {
  return AGENTS.find((agent) => agent.id === id)
}
