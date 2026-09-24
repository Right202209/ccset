import { CcsetError, EXIT_USAGE } from '../core/errors.js'
import type { CommandDeclaration, CommandFieldSpec, PatchMap } from '../operations/types.js'

export const REDACTED_VALUE = '[redacted]'

export interface ParseState {
  patch: PatchMap
  unsets: string[]
  providerId?: string
  replaceInvalid: boolean
  dryRun: boolean
  tokenStdin: boolean
}

export interface ReaderContext {
  tokens: string[]
  index: number
  declaration: CommandDeclaration
  state: ParseState
}

export function usage(messageKey: string, params: Record<string, string> = {}): CcsetError {
  return new CcsetError(messageKey, EXIT_USAGE, params)
}

function optionValue(
  ctx: ReaderContext,
  option: string,
  inline: string | undefined,
): { value: string; next: number } {
  if (inline !== undefined) return { value: inline, next: ctx.index + 1 }
  const value = ctx.tokens[ctx.index + 1]
  if (value === undefined || value.startsWith('--')) throw usage('cli.usage.missingValue', { option })
  return { value, next: ctx.index + 2 }
}

function normalizedValue(field: CommandFieldSpec, option: string, raw: string): string | number {
  if (raw.length === 0) throw usage('cli.usage.emptyValue', { option })
  if (field.type === 'choice') {
    if (!(field.choices ?? []).includes(raw)) {
      throw usage('cli.usage.invalidChoice', { option, choices: (field.choices ?? []).join(', ') })
    }
    return raw
  }
  const problem = field.validate?.(raw)
  if (problem !== null && problem !== undefined) throw usage(problem, { option })
  if (field.type === 'int' && Number.isNaN(Number(raw))) throw usage('cli.usage.notInteger', { option })
  return field.type === 'int' ? Number(raw) : raw
}

function readFlag(field: CommandFieldSpec, ctx: ReaderContext): void {
  if (ctx.tokens[ctx.index] !== field.option) throw usage('cli.usage.flagValue', { option: field.option })
  if (ctx.state.patch[field.id] === true) throw usage('cli.usage.duplicateOption', { option: field.option })
  ctx.state.patch[field.id] = true
  ctx.index += 1
}

function readList(field: CommandFieldSpec, ctx: ReaderContext, value: string, next: number): void {
  const trimmed = value.trim()
  if (trimmed.length === 0) throw usage('cli.usage.emptyValue', { option: field.option })
  const problem = field.validate?.(trimmed)
  if (problem !== null && problem !== undefined) throw usage(problem, { option: field.option })
  const current = ctx.state.patch[field.id]
  ctx.state.patch[field.id] = [...(Array.isArray(current) ? current : []), trimmed]
  ctx.index = next
}

function readFieldOption(field: CommandFieldSpec, ctx: ReaderContext): void {
  if (field.type === 'flag') return readFlag(field, ctx)
  if (field.type !== 'list' && Object.prototype.hasOwnProperty.call(ctx.state.patch, field.id)) {
    throw usage('cli.usage.duplicateOption', { option: field.option })
  }
  const token = ctx.tokens[ctx.index]
  const inline = token?.startsWith(`${field.option}=`) ? token.slice(field.option.length + 1) : undefined
  const { value, next } = optionValue(ctx, field.option, inline)
  if (field.type === 'list') return readList(field, ctx, value, next)
  ctx.state.patch[field.id] = normalizedValue(field, field.option, value)
  ctx.index = next
}

function readUnset(ctx: ReaderContext): void {
  const token = ctx.tokens[ctx.index] ?? ''
  const inline = token.startsWith('--unset=') ? token.slice('--unset='.length) : undefined
  const { value, next } = optionValue(ctx, '--unset', inline)
  const field = ctx.declaration.fields.find((candidate) => candidate.id === value)
  if (field === undefined) throw usage('cli.usage.unknownField', { field: REDACTED_VALUE })
  if (field.unsettable !== true) throw usage('cli.usage.notUnsettable', { field: REDACTED_VALUE })
  if (!ctx.state.unsets.includes(value)) ctx.state.unsets.push(value)
  ctx.index = next
}

export function readOption(ctx: ReaderContext): void {
  const token = ctx.tokens[ctx.index] ?? ''
  const option = token.split('=')[0] ?? token
  const bare = token === option
  if (option === '--unset') return readUnset(ctx)
  if (option === '--dry-run') return readBooleanOption(ctx, option, bare)
  if (option === '--replace-invalid') return readBooleanOption(ctx, option, bare)
  if (option === '--token-stdin') return readTokenStdin(ctx, option, bare)
  const field = ctx.declaration.fields.find((candidate) => candidate.option === option)
  if (field === undefined) throw usage('cli.usage.unknownOption', { option: REDACTED_VALUE })
  readFieldOption(field, ctx)
}

function readBooleanOption(ctx: ReaderContext, option: string, bare: boolean): void {
  if (!bare) throw usage('cli.usage.flagValue', { option })
  if (option === '--dry-run') {
    if (ctx.declaration.dryRunnable !== true) throw usage('cli.usage.dryRunUnsupported')
    if (ctx.state.dryRun) throw usage('cli.usage.duplicateOption', { option })
    ctx.state.dryRun = true
  } else {
    if (ctx.declaration.replaceable !== true) throw usage('cli.usage.replaceInvalidUnsupported')
    if (ctx.state.replaceInvalid) throw usage('cli.usage.duplicateOption', { option })
    ctx.state.replaceInvalid = true
  }
  ctx.index += 1
}

function readTokenStdin(ctx: ReaderContext, option: string, bare: boolean): void {
  if (!bare) throw usage('cli.usage.flagValue', { option })
  if (ctx.declaration.takesSecret !== true) throw usage('cli.usage.noSecretAccepted')
  if (ctx.state.tokenStdin) throw usage('cli.usage.duplicateOption', { option })
  ctx.state.tokenStdin = true
  ctx.index += 1
}
