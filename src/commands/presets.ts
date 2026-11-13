import { CcsetError, EXIT_USAGE } from '../core/errors.js'
import type { Agent } from '../types.js'
import type { CommandFieldSpec } from '../operations/types.js'
import { t } from '../i18n/index.js'
import { escapeJsonControlCharacters, sanitizeForTerminal } from '../core/terminal-text.js'
import { scanGlobals } from './globals.js'
import { PRESETS, type PresetTarget } from './preset-catalog.js'

function fail(key: string): never { throw new CcsetError(key, EXIT_USAGE) }

export function listPresets(argv: string[]): boolean {
  const scan = scanGlobals(argv)
  if (scan.rest[0] !== 'presets') return false
  if (scan.missingValueFor !== null) fail('cli.preset.listUsage')
  const [, verb, query, ...extra] = scan.rest
  if (verb !== 'list' || extra.length > 0 || query?.startsWith('-')) fail('cli.preset.listUsage')
  const search = query?.toLowerCase() ?? ''
  const presets = PRESETS.filter((preset) =>
    `${preset.id} ${preset.name}`.toLowerCase().includes(search) &&
    (scan.agentId === null || Object.hasOwn(preset.agents, scan.agentId)))
  const result = scan.json
    ? escapeJsonControlCharacters(JSON.stringify({ schemaVersion: 1, agent: scan.agentId, operation: 'presets.list', ok: true, exitCode: 0, data: { presets } }))
    : presets.map((preset) => sanitizeForTerminal(`${preset.id} — ${preset.name} (${Object.keys(preset.agents).join(', ')})`)).join('\n') || t('cli.preset.noMatches')
  process.stdout.write(`${result}\n`)
  return true
}

/** Every default becomes an ordinary option and goes through the Agent's parser. */
function optionArgs(options: Record<string, string | string[]>, supplied: string[]): string[] {
  return Object.entries(options).flatMap(([option, value]) => {
    if (supplied.some((token) => token === option || token.startsWith(`${option}=`))) return []
    const values = Array.isArray(value) ? value : [value]
    return values.map((item) => `${option}=${item}`)
  })
}

function unsetOptions(tokens: string[], fields: CommandFieldSpec[]): string[] {
  return tokens.flatMap((token, index) => {
    let id: string | undefined
    if (token === '--unset') id = tokens[index + 1]
    else if (token.startsWith('--unset=')) id = token.slice('--unset='.length)
    const option = fields.find((field) => field.id === id)?.option
    return option === undefined ? [] : [option]
  })
}

function takePreset(tokens: string[]): { id: string; rest: string[] } {
  const indexes = tokens.flatMap((token, index) => token === '--preset' || token.startsWith('--preset=') ? [index] : [])
  if (indexes.length !== 1) return fail('cli.preset.addUsage')
  const index = indexes[0] ?? 0
  const token = tokens[index] ?? ''
  const inline = token.startsWith('--preset=')
  const id = inline ? token.slice('--preset='.length) : tokens[index + 1]
  if (!id || id.startsWith('-')) return fail('cli.preset.addUsage')
  const rest = tokens.slice()
  rest.splice(index, inline ? 1 : 2)
  return { id, rest }
}

export interface PresetExpansion {
  argv: string[]
  target?: PresetTarget
  providerId?: string
}

export function expandPreset(argv: string[], agents: Agent[]): PresetExpansion {
  const scan = scanGlobals(argv)
  if (scan.rest[0] !== 'add') return { argv }
  const { id, rest } = takePreset(scan.rest.slice(1))
  const preset = PRESETS.find((candidate) => candidate.id === id)
  if (preset === undefined) return fail('cli.preset.unknown')
  const agent = agents.find((candidate) => candidate.id === scan.agentId)
  if (agent === undefined) return { argv }
  const target = preset.agents[agent.id]
  if (target === undefined) return fail('cli.preset.unsupported')
  const declaration = agent.commands?.operations.find((command) => command.id === 'provider.set')
  const first = rest[0]
  const explicitId = first !== undefined && !first.startsWith('-')
  const defaultId = declaration?.validateArgument?.(id) ? `${id}-ccset` : id
  const providerId = explicitId ? rest.shift() ?? defaultId : defaultId
  const supplied = [...rest, ...unsetOptions(rest, declaration?.fields ?? [])]
  return {
    argv: ['--agent', agent.id, ...(scan.json ? ['--json'] : []), 'provider', 'set', providerId, ...optionArgs(target.options, supplied), ...rest],
    target, providerId,
  }
}

export function presetNextCommand(agentId: string, expansion: PresetExpansion): string | undefined {
  if (expansion.target === undefined) return undefined
  const args = optionArgs(expansion.target.useOptions ?? {}, [])
  const quoted = args.map((arg) => `'${arg.replaceAll("'", "'\\''")}'`)
  return ['ccset', agentId, 'use', expansion.providerId, ...quoted].join(' ')
}
