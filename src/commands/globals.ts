/**
 * The --agent/--json prefix every command spelling shares. Both the strict
 * parser and the failure-envelope fallback walk it, and both must agree on
 * what a token means: --agent never takes a following flag as its value,
 * because an agent id cannot start with dashes.
 */

export interface GlobalScan {
  agentId: string | null
  json: boolean
  /** Everything left once the globals are stripped. */
  rest: string[]
  /** Set when --agent's value was absent or was another flag. */
  missingValueFor: string | null
}

export function scanGlobals(tokens: string[]): GlobalScan {
  const rest: string[] = []
  let agentId: string | null = null
  let json = false
  let missingValueFor: string | null = null
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? ''
    if (token === '--json') {
      json = true
    } else if (token === '--agent') {
      const value = tokens[index + 1]
      if (value === undefined || value.startsWith('--')) missingValueFor ??= token
      else {
        agentId = value
        index += 1
      }
    } else if (token.startsWith('--agent=')) {
      agentId = token.slice('--agent='.length)
    } else {
      rest.push(token)
    }
  }
  return { agentId: agentId !== null && agentId.length > 0 ? agentId : null, json, rest, missingValueFor }
}
