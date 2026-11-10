import { CcsetError, EXIT_UNKNOWN_AGENT, EXIT_USAGE } from '../core/errors.js'
import type { Agent, Ctx } from '../types.js'
import { scanGlobals } from './globals.js'

/** CLI selectors take precedence over the environment; two CLI choices must agree. */
export function explicitSelection(argv: string[], agents: Agent[], envAgent?: string): string[] {
  const scan = scanGlobals(argv)
  const first = scan.rest[0]
  const positional = agents.find((agent) => agent.id === first)?.id
  if (scan.agentConflict || (positional !== undefined && scan.agentId !== null && positional !== scan.agentId)) {
    throw new CcsetError('cli.usage.agentConflict', EXIT_USAGE)
  }
  if (scan.missingValueFor !== null) return argv
  const selected = positional ?? scan.agentId ?? envAgent
  validateSelection(selected, agents)
  if (positional !== undefined) {
    return ['--agent', positional, ...(scan.json ? ['--json'] : []), ...scan.rest.slice(1)]
  }
  if (scan.agentId !== null || envAgent === undefined) return argv
  return ['--agent', envAgent, ...argv]
}

function validateSelection(selected: string | undefined, agents: Agent[]): void {
  if (selected === undefined) return
  if (selected === '') throw new CcsetError('cli.usage.missingValue', EXIT_USAGE, { option: 'CCSET_AGENT' })
  if (!agents.some((agent) => agent.id === selected)) {
    throw new CcsetError('error.unknownAgent', EXIT_UNKNOWN_AGENT, { id: '[redacted]' })
  }
}

export async function selectCommandAgent(
  argv: string[],
  agents: Agent[],
  context: { ctx: Ctx; interactive: boolean },
): Promise<string[]> {
  const scan = scanGlobals(argv)
  if (scan.agentId !== null || scan.missingValueFor !== null) return argv
  const detected = await Promise.all(agents.map(async (agent) => {
    const found = await agent.detect(context.ctx).catch(() => false)
    return found ? agent.id : null
  }))
  const candidates = detected.filter((id): id is string => id !== null)
  const sole = candidates[0]
  if (context.interactive && candidates.length === 1 && sole !== undefined) {
    return ['--agent', sole, ...argv]
  }
  throw new CcsetError('cli.usage.selectAgent', EXIT_USAGE, {
    candidates: candidates.join(', ') || agents.map((agent) => agent.id).join(', '),
  })
}
