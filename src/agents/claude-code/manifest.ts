import type { FieldSpec, FieldChoice, FormValues } from '../../types.js'
import {
  DEFAULT_CLEANUP_DAYS,
  DEFAULT_GLOBAL_MODEL,
  DEFAULT_PROXY_URL,
  SWITCH_OFF,
  SWITCH_ON,
  SWITCH_UNMANAGED,
} from '../../core/constants.js'
import {
  validateBaseUrl,
  validateOptionalPositiveInt,
  validateOptionalUrl,
  validateProviderName,
  validateRequiredText,
} from '../../core/validate.js'

/**
 * Data only. Every managed key of Claude Code's settings files is declared
 * here once, and both the review screen and the writer are driven from it.
 * If Claude Code moves its settings shape, this file is the blast radius.
 */

/** Tri-state: an env switch can be on, off, or not managed by ccset at all. */
export const SWITCH_CHOICES: FieldChoice[] = [
  { value: SWITCH_ON, labelKey: 'choice.on' },
  { value: SWITCH_OFF, labelKey: 'choice.off' },
  { value: SWITCH_UNMANAGED, labelKey: 'choice.unmanaged' },
]

/** Suggestions, never a closed list: router model names are unguessable. */
export const GLOBAL_MODEL_SUGGESTIONS = [
  'opus[1m]',
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-haiku-4-5-20251001',
]

/* --------------------------------------------------------------- global */

export const ENV_HTTPS_PROXY = ['env', 'HTTPS_PROXY']
export const ENV_HTTP_PROXY = ['env', 'HTTP_PROXY']

export const GLOBAL_FIELDS: FieldSpec[] = [
  {
    id: 'proxyEnabled',
    labelKey: 'field.proxyEnabled',
    helpKey: 'help.proxyEnabled',
    type: 'boolean',
  },
  {
    id: 'proxyUrl',
    labelKey: 'field.proxyUrl',
    helpKey: 'help.proxyUrl',
    type: 'text',
    validate: validateOptionalUrl,
  },
  {
    id: 'disableNonessentialTraffic',
    labelKey: 'field.disableNonessentialTraffic',
    type: 'choice',
    choices: SWITCH_CHOICES,
    path: ['env', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'],
  },
  {
    id: 'attributionHeader',
    labelKey: 'field.attributionHeader',
    type: 'choice',
    choices: SWITCH_CHOICES,
    path: ['env', 'CLAUDE_CODE_ATTRIBUTION_HEADER'],
  },
  {
    id: 'disableInstallationChecks',
    labelKey: 'field.disableInstallationChecks',
    type: 'choice',
    choices: SWITCH_CHOICES,
    path: ['env', 'DISABLE_INSTALLATION_CHECKS'],
  },
  {
    id: 'enableToolSearch',
    labelKey: 'field.enableToolSearch',
    type: 'choice',
    choices: SWITCH_CHOICES,
    path: ['env', 'ENABLE_TOOL_SEARCH'],
  },
  {
    id: 'cleanupPeriodDays',
    labelKey: 'field.cleanupPeriodDays',
    helpKey: 'help.cleanupPeriodDays',
    type: 'text',
    path: ['cleanupPeriodDays'],
    validate: validateOptionalPositiveInt,
  },
  {
    id: 'model',
    labelKey: 'field.globalModel',
    helpKey: 'help.globalModel',
    type: 'text',
    path: ['model'],
    suggestions: GLOBAL_MODEL_SUGGESTIONS,
  },
]

/**
 * Template defaults, applied only where the existing file has no value
 * (PRD 4.1 seed order: existing file value -> template default -> render).
 * The review screen marks every field whose proposal differs from disk.
 */
export const GLOBAL_DEFAULTS: FormValues = {
  proxyEnabled: false,
  proxyUrl: DEFAULT_PROXY_URL,
  disableNonessentialTraffic: SWITCH_ON,
  attributionHeader: SWITCH_OFF,
  disableInstallationChecks: SWITCH_ON,
  enableToolSearch: SWITCH_ON,
  cleanupPeriodDays: String(DEFAULT_CLEANUP_DAYS),
  model: DEFAULT_GLOBAL_MODEL,
}

/** Every path ccset owns in settings.json; everything else is preserved. */
export const MANAGED_GLOBAL_PATHS: string[][] = [
  ENV_HTTPS_PROXY,
  ENV_HTTP_PROXY,
  ...GLOBAL_FIELDS.map((field) => field.path).filter(
    (candidate): candidate is string[] => candidate !== undefined,
  ),
]

/* ------------------------------------------------------------- provider */

export const PROVIDER_BASE_URL_PATH = ['env', 'ANTHROPIC_BASE_URL']
export const PROVIDER_TOKEN_PATH = ['env', 'ANTHROPIC_AUTH_TOKEN']
export const PROVIDER_MODEL_PATH = ['model']

export const PROVIDER_FIELDS: FieldSpec[] = [
  {
    id: 'name',
    labelKey: 'field.providerName',
    helpKey: 'help.providerName',
    type: 'text',
    required: true,
    validate: validateProviderName,
  },
  {
    id: 'baseUrl',
    labelKey: 'field.baseUrl',
    helpKey: 'help.baseUrl',
    type: 'text',
    required: true,
    path: PROVIDER_BASE_URL_PATH,
    validate: validateBaseUrl,
  },
  {
    id: 'token',
    labelKey: 'field.token',
    helpKey: 'help.token',
    type: 'secret',
    required: true,
    path: PROVIDER_TOKEN_PATH,
    validate: validateRequiredText,
  },
  {
    id: 'model',
    labelKey: 'field.providerModel',
    helpKey: 'help.providerModel',
    type: 'text',
    path: PROVIDER_MODEL_PATH,
  },
  {
    id: 'fallbackModel',
    labelKey: 'field.fallbackModel',
    helpKey: 'help.fallbackModel',
    type: 'csv',
    advanced: true,
    path: ['fallbackModel'],
  },
  {
    id: 'defaultOpusModel',
    labelKey: 'field.defaultOpusModel',
    type: 'text',
    advanced: true,
    path: ['env', 'ANTHROPIC_DEFAULT_OPUS_MODEL'],
  },
  {
    id: 'defaultSonnetModel',
    labelKey: 'field.defaultSonnetModel',
    type: 'text',
    advanced: true,
    path: ['env', 'ANTHROPIC_DEFAULT_SONNET_MODEL'],
  },
  {
    id: 'defaultHaikuModel',
    labelKey: 'field.defaultHaikuModel',
    type: 'text',
    advanced: true,
    path: ['env', 'ANTHROPIC_DEFAULT_HAIKU_MODEL'],
  },
]

export const MANAGED_PROVIDER_PATHS: string[][] = PROVIDER_FIELDS.map(
  (field) => field.path,
).filter((candidate): candidate is string[] => candidate !== undefined)

/** Fields whose value must never be printed unmasked. */
export const SECRET_FIELD_IDS = new Set(
  [...GLOBAL_FIELDS, ...PROVIDER_FIELDS]
    .filter((field) => field.type === 'secret')
    .map((field) => field.id),
)
