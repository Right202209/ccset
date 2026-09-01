import type { FieldChoice, FieldSpec, FormValues } from '../../types.js'
import {
  makeKeyNameValidator,
  validateBaseUrl,
  validateOptionalPositiveInt,
  validateRequiredText,
} from '../../core/validate.js'
import {
  AUTOUPDATE_NOTIFY,
  AUTOUPDATE_OFF,
  AUTOUPDATE_ON,
  DEFAULT_PROVIDER_NPM,
  PROVIDER_NPM_SUGGESTIONS,
  RESERVED_PROVIDER_IDS,
  SHARE_AUTO,
  SHARE_DISABLED,
  SHARE_MANUAL,
  UNMANAGED,
} from './constants.js'

/**
 * Data only, mirroring https://opencode.ai/config.json. Every managed key of
 * opencode's config is declared here once, and both the review screen and the
 * writer are driven from it. If opencode moves its config shape, this file is
 * the blast radius.
 */

/**
 * A provider id is a JSON key here, not a filename, so it is validated as one:
 * separators are irrelevant, but colliding with a built-in provider would
 * silently override it instead of adding one.
 */
export const validateProviderId = makeKeyNameValidator(RESERVED_PROVIDER_IDS)

export const SHARE_CHOICES: FieldChoice[] = [
  { value: SHARE_MANUAL, labelKey: 'opencode.choice.shareManual' },
  { value: SHARE_AUTO, labelKey: 'opencode.choice.shareAuto' },
  { value: SHARE_DISABLED, labelKey: 'opencode.choice.shareDisabled' },
  { value: UNMANAGED, labelKey: 'choice.unmanaged' },
]

export const AUTOUPDATE_CHOICES: FieldChoice[] = [
  { value: AUTOUPDATE_ON, labelKey: 'choice.on' },
  { value: AUTOUPDATE_OFF, labelKey: 'choice.off' },
  { value: AUTOUPDATE_NOTIFY, labelKey: 'opencode.choice.notify' },
  { value: UNMANAGED, labelKey: 'choice.unmanaged' },
]

/* --------------------------------------------------------------- global */

export const GLOBAL_MODEL_PATH = ['model']
export const GLOBAL_SMALL_MODEL_PATH = ['small_model']

export const GLOBAL_FIELDS: FieldSpec[] = [
  {
    id: 'model',
    labelKey: 'field.globalModel',
    helpKey: 'opencode.help.globalModel',
    type: 'text',
    path: GLOBAL_MODEL_PATH,
  },
  {
    id: 'smallModel',
    labelKey: 'opencode.field.smallModel',
    helpKey: 'opencode.help.smallModel',
    type: 'text',
    path: GLOBAL_SMALL_MODEL_PATH,
  },
  {
    id: 'share',
    labelKey: 'opencode.field.share',
    helpKey: 'opencode.help.share',
    type: 'choice',
    choices: SHARE_CHOICES,
    path: ['share'],
  },
  {
    id: 'autoupdate',
    labelKey: 'opencode.field.autoupdate',
    type: 'choice',
    choices: AUTOUPDATE_CHOICES,
    path: ['autoupdate'],
  },
  {
    id: 'username',
    labelKey: 'opencode.field.username',
    helpKey: 'opencode.help.username',
    type: 'text',
    advanced: true,
    path: ['username'],
  },
  {
    id: 'disabledProviders',
    labelKey: 'opencode.field.disabledProviders',
    helpKey: 'opencode.help.disabledProviders',
    type: 'csv',
    advanced: true,
    path: ['disabled_providers'],
  },
]

/**
 * opencode ships no template defaults worth proposing: `model` names a
 * provider that may not exist yet, and every other key already has a sane
 * built-in. Seeding is disk-only, so opening the screen proposes nothing.
 */
export const GLOBAL_DEFAULTS: FormValues = {}

/** Every path ccset owns at the top level; everything else is preserved. */
export const MANAGED_GLOBAL_PATHS: string[][] = GLOBAL_FIELDS.map(
  (field) => field.path,
).filter((candidate): candidate is string[] => candidate !== undefined)

/* ------------------------------------------------------------- provider */

/** Providers are keys inside the one document, so every path needs the id. */
export const PROVIDER_ROOT = 'provider'

export function providerPath(id: string): string[] {
  return [PROVIDER_ROOT, id]
}

export function providerNamePath(id: string): string[] {
  return [PROVIDER_ROOT, id, 'name']
}

export function providerNpmPath(id: string): string[] {
  return [PROVIDER_ROOT, id, 'npm']
}

export function providerBaseUrlPath(id: string): string[] {
  return [PROVIDER_ROOT, id, 'options', 'baseURL']
}

export function providerApiKeyPath(id: string): string[] {
  return [PROVIDER_ROOT, id, 'options', 'apiKey']
}

export function providerTimeoutPath(id: string): string[] {
  return [PROVIDER_ROOT, id, 'options', 'timeout']
}

export function providerModelsPath(id: string): string[] {
  return [PROVIDER_ROOT, id, 'models']
}

export function providerModelPath(id: string, modelId: string): string[] {
  return [PROVIDER_ROOT, id, 'models', modelId]
}

/**
 * Field ids map to paths through the builders above rather than a static
 * `path`, because the path is not knowable until the user has named the
 * provider. `path` is therefore absent on every field here, and providers.ts
 * emits the writes; the review form still renders from this list.
 */
export const PROVIDER_FIELDS: FieldSpec[] = [
  {
    id: 'id',
    labelKey: 'opencode.field.providerId',
    helpKey: 'opencode.help.providerId',
    type: 'text',
    required: true,
    validate: validateProviderId,
  },
  {
    id: 'displayName',
    labelKey: 'opencode.field.displayName',
    helpKey: 'opencode.help.displayName',
    type: 'text',
  },
  {
    id: 'baseUrl',
    labelKey: 'field.baseUrl',
    helpKey: 'opencode.help.baseUrl',
    type: 'text',
    required: true,
    validate: validateBaseUrl,
  },
  {
    id: 'apiKey',
    labelKey: 'opencode.field.apiKey',
    helpKey: 'opencode.help.apiKey',
    type: 'secret',
    required: true,
    validate: validateRequiredText,
  },
  {
    id: 'npm',
    labelKey: 'opencode.field.npm',
    helpKey: 'opencode.help.npm',
    type: 'text',
    suggestions: PROVIDER_NPM_SUGGESTIONS,
  },
  {
    id: 'models',
    labelKey: 'opencode.field.models',
    helpKey: 'opencode.help.models',
    type: 'csv',
  },
  {
    id: 'timeout',
    labelKey: 'opencode.field.timeout',
    helpKey: 'opencode.help.timeout',
    type: 'text',
    advanced: true,
    validate: validateOptionalPositiveInt,
  },
]

/** Template defaults for a new provider: only the wire protocol is guessable. */
export const PROVIDER_DEFAULTS: FormValues = {
  npm: DEFAULT_PROVIDER_NPM,
}

/** Fields whose value must never be printed unmasked. */
export const SECRET_FIELD_IDS = new Set(
  [...GLOBAL_FIELDS, ...PROVIDER_FIELDS]
    .filter((field) => field.type === 'secret')
    .map((field) => field.id),
)
