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
  agentConflict: boolean
}

function recordAgent(scan: GlobalScan, value: string | undefined): boolean {
  if (!value || value.startsWith('-')) {
    scan.missingValueFor ??= '--agent'
    return false
  }
  if (scan.agentId !== null && scan.agentId !== value) scan.agentConflict = true
  scan.agentId = value
  return true
}

export function scanGlobals(tokens: string[]): GlobalScan {
  const scan: GlobalScan = { agentId: null, json: false, rest: [], missingValueFor: null, agentConflict: false }
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? ''
    if (token === '--') {
      scan.rest.push(...tokens.slice(index))
      break
    } else if (token === '--json') {
      scan.json = true
    } else if (token === '--agent') {
      if (recordAgent(scan, tokens[index + 1])) index += 1
    } else if (token.startsWith('--agent=')) {
      recordAgent(scan, token.slice('--agent='.length))
    } else {
      scan.rest.push(token)
    }
  }
  return scan
}
