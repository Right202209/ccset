import type { Ctx, FieldSpec, JsonValue } from '../../types.js'
import type { CommandDeclaration, CommandField, ParsedInvocation } from '../../core/command.js'
import type { OperationDescriptor, OperationId } from '../../core/operation.js'
import type { ManagedWrite } from '../../core/merge.js'
import type { UsageProblem } from '../../core/errors.js'
import { CcsetError, EXIT_USAGE } from '../../core/errors.js'
import { jsonFile } from '../../core/json-file.js'
import { validateOptionalPositiveInt, validateOptionalUrl } from '../../core/validate.js'
import { ENV_HTTPS_PROXY, ENV_HTTP_PROXY, GLOBAL_FIELDS } from './manifest.js'
import { backupsDir, globalSettingsPath } from './paths.js'

/**
 * The non-interactive surface for Claude Code, derived from the same manifest
 * the TUI form is. What an option accepts, what it converts to, and how the
 * fields combine into a patch are Claude Code semantics and live here; the
 * core pipeline stays agent-independent and only applies the result.
 */

const PROXY_FIELD_IDS = new Set(['proxyEnabled', 'proxyUrl'])

/** Maps a shared validator's i18n key onto a structured usage problem. */
function validatorFor(long: string, spec: FieldSpec) {
  return (raw: string): UsageProblem | null => {
    const key = spec.validate?.(raw) ?? null
    return key === null ? null : { code: key, params: { option: `--${long}` } }
  }
}

function commandField(spec: FieldSpec): CommandField {
  const long = spec.id
  const base = {
    id: spec.id,
    long,
    required: spec.required,
    // The TUI's switch choices include '' for "unmanaged"; on the command line
    // that state is --unset, so '' is dropped and never an accepted value.
    choices: spec.choices?.map((choice) => choice.value).filter((value) => value.length > 0),
    validate: validatorFor(long, spec),
  }
  switch (spec.id) {
    case 'proxyEnabled':
      return {
        ...base,
        // Strict: 'yes'/'1' are not accepted, so a toggle is never silently off.
        validate: (raw: string) =>
          raw === 'true' || raw === 'false'
            ? null
            : { code: 'claudeCode.cmd.invalidBoolean', params: { option: `--${long}`, value: raw } },
        convert: (raw: string) => raw === 'true',
      }
    case 'cleanupPeriodDays':
      // validateOptionalPositiveInt has already bounded it to an integer.
      return { ...base, convert: (raw: string) => Number.parseInt(raw, 10) }
    default:
      return { ...base, convert: (raw: string) => raw }
  }
}

/**
 * The proxy is two env keys behind one toggle, so the fields are coupled: a
 * bare `--proxyUrl` implies enabled (documented), `--proxyEnabled true`
 * requires a URL to write, `--proxyEnabled false` deletes both keys, and
 * mixing any set with any --unset of the pair is a conflict — removal is
 * `--unset proxyEnabled` alone.
 */
function proxyCoupling(inv: ParsedInvocation): UsageProblem[] {
  const problems: UsageProblem[] = []
  const enabled = inv.values['proxyEnabled']
  if (enabled === true && inv.values['proxyUrl'] === undefined) {
    problems.push({ code: 'claudeCode.cmd.proxyUrlRequired', params: { option: '--proxyEnabled' } })
  }
  if (enabled === false && inv.values['proxyUrl'] !== undefined) {
    problems.push({ code: 'claudeCode.cmd.proxyConflicting' })
  }
  const touched = enabled !== undefined || inv.values['proxyUrl'] !== undefined
  const unsetProxy = inv.unset.has('proxyEnabled') || inv.unset.has('proxyUrl')
  if (touched && unsetProxy) {
    problems.push({ code: 'error.conflictSetUnset', params: { field: 'proxy' } })
  }
  return problems
}

export const claudeCodeCommands: CommandDeclaration[] = [
  {
    id: 'global.set',
    command: 'global',
    subcommand: 'set',
    fields: GLOBAL_FIELDS.map(commandField),
    crossField: proxyCoupling,
  },
]

function managedPath(fieldId: string): string[] | undefined {
  return GLOBAL_FIELDS.find((field) => field.id === fieldId)?.path
}

/**
 * Claude Code's patch semantics, owned here rather than in core: the proxy
 * toggle becomes both env keys (set with the URL, or deleted), the cleanup
 * period becomes an integer, every other value is written as the string the
 * agent reads back. Order matters only within the proxy pair, and the coupling
 * check has already refused the set-plus-unset mix that could interleave it.
 */
export function globalSetWrites(
  values: Record<string, JsonValue>,
  unset: Set<string>,
): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  const enabled = values['proxyEnabled']
  const url = values['proxyUrl']

  if (enabled !== undefined || url !== undefined) {
    if (enabled === false) {
      writes.push(
        { path: ENV_HTTPS_PROXY, value: undefined },
        { path: ENV_HTTP_PROXY, value: undefined },
      )
    } else {
      // The coupling check rejects an enabled proxy without a URL before the
      // seam; reaching this branch without one is a wiring mistake, not input.
      if (typeof url !== 'string') {
        throw new CcsetError('claudeCode.cmd.proxyUrlRequired', EXIT_USAGE, {
          option: '--proxyEnabled',
        })
      }
      writes.push({ path: ENV_HTTPS_PROXY, value: url }, { path: ENV_HTTP_PROXY, value: url })
    }
  }

  for (const id of unset) {
    if (PROXY_FIELD_IDS.has(id)) {
      writes.push(
        { path: ENV_HTTPS_PROXY, value: undefined },
        { path: ENV_HTTP_PROXY, value: undefined },
      )
      continue
    }
    const path = managedPath(id)
    if (path !== undefined) writes.push({ path, value: undefined })
  }

  for (const [id, value] of Object.entries(values)) {
    if (PROXY_FIELD_IDS.has(id)) continue
    const path = managedPath(id)
    if (path !== undefined) writes.push({ path, value })
  }

  return writes
}

/** The operation implementation the core pipeline drives for this agent. */
export function claudeCodeOperation(
  operation: OperationId,
  ctx: Ctx,
): OperationDescriptor | undefined {
  if (operation !== 'global.set') return undefined
  const target = globalSettingsPath(ctx.home)
  return { target: jsonFile(target), backupDir: backupsDir(ctx.home), toWrites: globalSetWrites }
}
