import type { FieldChoice, FieldSpec, FormValues } from '../../types.js'
import {
  makeKeyNameValidator,
  validateBaseUrl,
  validateOptionalPositiveInt,
  validateRequiredText,
} from '../../core/validate.js'
import {
  APPROVAL_NEVER,
  APPROVAL_ON_REQUEST,
  REASONING_EFFORT_SUGGESTIONS,
  RESERVED_PROVIDER_IDS,
  SANDBOX_DANGER_FULL_ACCESS,
  SANDBOX_READ_ONLY,
  SANDBOX_WORKSPACE_WRITE,
  UNMANAGED,
  VERBOSITY_HIGH,
  VERBOSITY_LOW,
  VERBOSITY_MEDIUM,
} from './constants.js'

/**
 * Data only. Every managed key of Codex CLI's config.toml is declared here
 * once, and both the review screen and the writer are driven from it. If Codex
 * moves its config shape, this file is the blast radius.
 */

/** A provider id is a TOML table key, not a filename, so separators are moot. */
export const validateProviderId = makeKeyNameValidator(RESERVED_PROVIDER_IDS)

export const APPROVAL_CHOICES: FieldChoice[] = [
  { value: APPROVAL_ON_REQUEST, labelKey: 'codex.choice.approvalOnRequest' },
  { value: APPROVAL_NEVER, labelKey: 'codex.choice.approvalNever' },
  { value: UNMANAGED, labelKey: 'choice.unmanaged' },
]

export const SANDBOX_CHOICES: FieldChoice[] = [
  { value: SANDBOX_READ_ONLY, labelKey: 'codex.choice.sandboxReadOnly' },
  { value: SANDBOX_WORKSPACE_WRITE, labelKey: 'codex.choice.sandboxWorkspaceWrite' },
  { value: SANDBOX_DANGER_FULL_ACCESS, labelKey: 'codex.choice.sandboxFullAccess' },
  { value: UNMANAGED, labelKey: 'choice.unmanaged' },
]

export const VERBOSITY_CHOICES: FieldChoice[] = [
  { value: VERBOSITY_LOW, labelKey: 'codex.choice.verbosityLow' },
  { value: VERBOSITY_MEDIUM, labelKey: 'codex.choice.verbosityMedium' },
  { value: VERBOSITY_HIGH, labelKey: 'codex.choice.verbosityHigh' },
  { value: UNMANAGED, labelKey: 'choice.unmanaged' },
]

/* --------------------------------------------------------------- global */

export const MODEL_PROVIDER_PATH = ['model_provider']

export const GLOBAL_FIELDS: FieldSpec[] = [
  {
    id: 'model',
    labelKey: 'field.globalModel',
    helpKey: 'codex.help.globalModel',
    type: 'text',
    path: ['model'],
  },
  {
    id: 'modelProvider',
    labelKey: 'codex.field.modelProvider',
    helpKey: 'codex.help.modelProvider',
    type: 'text',
    path: MODEL_PROVIDER_PATH,
  },
  {
    id: 'reasoningEffort',
    labelKey: 'codex.field.reasoningEffort',
    helpKey: 'codex.help.reasoningEffort',
    type: 'text',
    suggestions: REASONING_EFFORT_SUGGESTIONS,
    path: ['model_reasoning_effort'],
  },
  {
    id: 'approvalPolicy',
    labelKey: 'codex.field.approvalPolicy',
    helpKey: 'codex.help.approvalPolicy',
    type: 'choice',
    choices: APPROVAL_CHOICES,
    path: ['approval_policy'],
  },
  {
    id: 'sandboxMode',
    labelKey: 'codex.field.sandboxMode',
    helpKey: 'codex.help.sandboxMode',
    type: 'choice',
    choices: SANDBOX_CHOICES,
    path: ['sandbox_mode'],
  },
  {
    id: 'verbosity',
    labelKey: 'codex.field.verbosity',
    helpKey: 'codex.help.verbosity',
    type: 'choice',
    advanced: true,
    choices: VERBOSITY_CHOICES,
    path: ['model_verbosity'],
  },
  {
    id: 'contextWindow',
    labelKey: 'codex.field.contextWindow',
    helpKey: 'codex.help.contextWindow',
    type: 'text',
    advanced: true,
    validate: validateOptionalPositiveInt,
    path: ['model_context_window'],
  },
]

/** Fields whose value is an integer in TOML rather than a string. */
export const INTEGER_FIELD_IDS = new Set([
  'contextWindow',
  'requestMaxRetries',
  'streamMaxRetries',
  'streamIdleTimeoutMs',
])

/**
 * Codex ships no template default worth proposing: `model` names a model the
 * chosen provider may not serve, and every other key already has a built-in.
 */
export const GLOBAL_DEFAULTS: FormValues = {}

export const MANAGED_GLOBAL_PATHS: string[][] = GLOBAL_FIELDS.map((field) => field.path).filter(
  (candidate): candidate is string[] => candidate !== undefined,
)

/* ------------------------------------------------------------- provider */

/** Providers are tables inside one document, so every path needs the id. */
export const PROVIDER_ROOT = 'model_providers'

export function providerPath(id: string): string[] {
  return [PROVIDER_ROOT, id]
}

export function providerKeyPath(id: string, key: string): string[] {
  return [PROVIDER_ROOT, id, key]
}

/** Every key ccset owns inside one provider table. */
export const PROVIDER_KEYS = {
  name: 'name',
  baseUrl: 'base_url',
  wireApi: 'wire_api',
  requiresOpenaiAuth: 'requires_openai_auth',
  requestMaxRetries: 'request_max_retries',
  streamMaxRetries: 'stream_max_retries',
  streamIdleTimeoutMs: 'stream_idle_timeout_ms',
} as const

/**
 * `apiKey` has no `path`: Codex does not keep a credential in config.toml. It
 * is written to an `auth.<id>.json` sidecar and copied over `auth.json` when
 * the provider is activated, which is why the block carries
 * `requires_openai_auth` instead of a key.
 */
export const PROVIDER_FIELDS: FieldSpec[] = [
  {
    id: 'id',
    labelKey: 'codex.field.providerId',
    helpKey: 'codex.help.providerId',
    type: 'text',
    required: true,
    validate: validateProviderId,
  },
  {
    id: 'displayName',
    labelKey: 'codex.field.displayName',
    helpKey: 'codex.help.displayName',
    type: 'text',
  },
  {
    id: 'baseUrl',
    labelKey: 'field.baseUrl',
    helpKey: 'codex.help.baseUrl',
    type: 'text',
    required: true,
    validate: validateBaseUrl,
  },
  {
    id: 'apiKey',
    labelKey: 'codex.field.apiKey',
    helpKey: 'codex.help.apiKey',
    type: 'secret',
    required: true,
    validate: validateRequiredText,
  },
  {
    id: 'requestMaxRetries',
    labelKey: 'codex.field.requestMaxRetries',
    helpKey: 'codex.help.retries',
    type: 'text',
    advanced: true,
    validate: validateOptionalPositiveInt,
  },
  {
    id: 'streamMaxRetries',
    labelKey: 'codex.field.streamMaxRetries',
    helpKey: 'codex.help.retries',
    type: 'text',
    advanced: true,
    validate: validateOptionalPositiveInt,
  },
  {
    id: 'streamIdleTimeoutMs',
    labelKey: 'codex.field.streamIdleTimeoutMs',
    helpKey: 'codex.help.streamIdleTimeout',
    type: 'text',
    advanced: true,
    validate: validateOptionalPositiveInt,
  },
]

/** Nothing about a third-party endpoint is guessable, so nothing is proposed. */
export const PROVIDER_DEFAULTS: FormValues = {}

export const SECRET_FIELD_IDS = new Set(
  [...GLOBAL_FIELDS, ...PROVIDER_FIELDS]
    .filter((field) => field.type === 'secret')
    .map((field) => field.id),
)
