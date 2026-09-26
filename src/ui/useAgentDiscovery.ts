import { useEffect, useState } from 'react'
import type { Agent, Ctx } from '../types.js'

/**
 * An explicit target bypasses discovery; without one, the App discovers first
 * even when a single Agent is registered, so an undetected one is never entered.
 */
function initialAgent(agents: Agent[], agentId?: string): Agent | null {
  if (agentId === undefined) return null
  return agents.find((agent) => agent.id === agentId) ?? null
}

/** Filesystem-only checks, run in parallel; one that throws counts as absent. */
async function discoverAgents(agents: Agent[], ctx: Ctx): Promise<Agent[]> {
  const results = await Promise.all(
    agents.map(async (candidate) => {
      try {
        return (await candidate.detect(ctx)) ? candidate : null
      } catch {
        return null
      }
    }),
  )
  return results.filter((candidate): candidate is Agent => candidate !== null)
}

export interface Discovery {
  agent: Agent | null
  choose: (agent: Agent) => void
  /** The Agents on offer; null while discovery runs. */
  available: Agent[] | null
  /** agent.detect() for the chosen Agent; null while it runs. */
  detected: boolean | null
}

/** ADR 0016: the TUI offers only the Agents detected in this home. */
export function useAgentDiscovery(agents: Agent[], ctx: Ctx, agentId?: string): Discovery {
  const [agent, setAgent] = useState<Agent | null>(() => initialAgent(agents, agentId))
  const [available, setAvailable] = useState<Agent[] | null>(() =>
    agentId === undefined ? null : agents,
  )
  const [detected, setDetected] = useState<boolean | null>(null)

  useEffect(() => {
    if (agentId !== undefined) return
    let active = true
    void discoverAgents(agents, ctx).then((found) => {
      if (!active) return
      setAvailable(found)
      if (found.length === 1) setAgent(found[0] ?? null)
    })
    return () => {
      active = false
    }
  }, [agentId, agents, ctx])

  useEffect(() => {
    let active = true
    if (agent !== null) {
      agent
        .detect(ctx)
        .then((found) => (active ? setDetected(found) : undefined))
        .catch(() => (active ? setDetected(null) : undefined))
    }
    return () => {
      active = false
    }
  }, [agent, ctx])

  return { agent, choose: setAgent, available, detected }
}
