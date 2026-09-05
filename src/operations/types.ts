import type { Ctx } from '../types.js'
import type { TargetRecord } from '../core/target.js'

export type { TargetRecord }

/**
 * The Non-interactive vocabulary. Everything here crosses the operation seam:
 * a normalized request in, a presentation-neutral result or a typed error out.
 * A Screen, translated text, TUI field values, and ManagedWrite[] never do --
 * the agent module owns the mapping from a request's fields to its own keys.
 */

/** The fixed Milestone 3 command tree. An agent declares which it serves. */
export type OperationId =
  | 'status'
  | 'global.set'
  | 'provider.set'
  | 'provider.use'
  | 'state.init'

/**
 * A parser value after normalization: text, numbers, booleans, choices, or
 * string lists. Never a TUI string coercion -- those stay in the TUI Adapter.
 */
export type CommandValue = string | number | boolean | string[]

/** Field id -> supplied value. Omitted fields retain their disk values. */
export type PatchMap = Record<string, CommandValue>

declare const secretMarker: unique symbol

/**
 * A secret that has already passed the source rules. Opaque on purpose: no
 * code path places it in process arguments or copies it into result or error
 * data, and ccset writes no logs a value could leak into. Construction is
 * only through `asSecret`.
 */
export type Secret = string & { readonly [secretMarker]: 'ccset-secret' }

export function asSecret(value: string): Secret {
  return value as Secret
}

export interface OperationRequest {
  operation: OperationId
  /** Required by provider.* operations; rejected by every other. */
  providerId?: string
  /** The fields the invocation supplied, normalized. */
  patch: PatchMap
  /** Field ids the user explicitly removed. Removal is never inferred. */
  unsets: string[]
  /** Already validated; undefined means no secret was supplied. */
  secret?: Secret
  /** Confirmed replacement of an unparseable target the agent can reconstruct. */
  replaceInvalid: boolean
  /** Reads, validation, and planning without backups or writes. */
  dryRun: boolean
}

/** A warning or error keyed by a stable code. Parameters are non-sensitive. */
export interface Finding {
  code: string
  params?: Record<string, string>
}

export interface OperationResult {
  agent: string
  operation: OperationId
  providerId?: string
  changed: boolean
  dryRun: boolean
  targets: TargetRecord[]
  warnings: Finding[]
  /**
   * status only: the agent's raw status payload. Machine-readable, JSON-safe,
   * and secret-free -- presence flags stand in for every credential.
   */
  data?: Record<string, unknown>
  /** status only: failures that hold the result to the invalid-config exit code. */
  errors?: Finding[]
  /** Paths already committed when an unexpected failure stopped a multi-target commit. */
  partial?: string[]
  /**
   * How the agent is pointed at what this operation wrote, exactly as the
   * TUI's write report carries it. Absent when the agent has nothing to
   * activate beyond reading its own config on start.
   */
  launchCommand?: string
  /** The catalog key that introduces the launch command in the human report. */
  launchKey?: string
}

/* ------------------------------------------------------- declarations */

export type CommandFieldType = 'text' | 'int' | 'choice' | 'list' | 'flag'

export interface CommandFieldSpec {
  /** Stable id: the request's patch key, the --unset spelling, and the JSON name. */
  id: string
  /** Long option, dashes included. */
  option: string
  type: CommandFieldType
  /** Legal values for a choice field. */
  choices?: string[]
  /** Supports explicit --unset. Required fields and secrets never do. */
  unsettable?: boolean
  /**
   * An existing validator, referenced -- never duplicated in the parser. It
   * returns an i18n key describing the problem, or null.
   */
  validate?: (value: string) => string | null
}

/** Presentation hooks the CLI Adapter resolves through the catalog. */
export interface CommandPresentation {
  /** i18n key announcing a committed mutation, chosen from the result. */
  successTitleKey: (result: OperationResult) => string
  /** Renders the raw status DTO as keyed sections for the human report. */
  presentStatus?: (data: Record<string, unknown>) => KeyedStatusSection[]
}

export interface CommandDeclaration {
  id: OperationId
  /** The positional argument the command requires, if any. */
  argument?: 'providerId'
  fields: CommandFieldSpec[]
  /** The command consumes a Secret from CCSET_TOKEN or --token-stdin. */
  takesSecret?: boolean
  /** The command accepts --replace-invalid for a target it can reconstruct. */
  replaceable?: boolean
  /** The command changes state, so --dry-run can plan the same change without writing. */
  dryRunnable?: boolean
  /** The command changes state, so an invocation supplying nothing is a usage error. */
  patchRequired?: boolean
  /** Validates the positional argument with the agent's own name rules. */
  validateArgument?: (value: string) => string | null
  /** How the CLI Adapter titles a success and renders a status DTO. */
  presentation?: CommandPresentation
  run: (ctx: Ctx, request: OperationRequest) => Promise<OperationResult>
}

/** An agent's whole Non-interactive surface. Absent: the agent has none. */
export interface AgentCommands {
  operations: CommandDeclaration[]
}

/* ---------------------------------------------- status presentation */

export interface KeyedLine {
  labelKey: string
  /** A literal display value: a path, a mode, a raw string. Never a secret. */
  value?: string
  /** An i18n key to resolve for the value (yes/no/unset and their kin). */
  valueKey?: string
  tone?: 'success' | 'error' | 'info' | 'warn'
}

export interface KeyedStatusSection {
  titleKey: string
  titleParams?: Record<string, string>
  lines: KeyedLine[]
  noteKey?: string
  noteParams?: Record<string, string>
}
