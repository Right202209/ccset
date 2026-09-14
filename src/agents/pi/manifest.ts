import type { FieldChoice, FieldSpec, FormValues } from '../../types.js'
import { makeKeyNameValidator, validateBaseUrl, validateRequiredText } from '../../core/validate.js'
import {
  API_ANTHROPIC_MESSAGES,
  API_GOOGLE_GENERATIVE_AI,
  API_OPENAI_COMPLETIONS,
  API_OPENAI_RESPONSES,
  DEFAULT_PROVIDER_API,
  THINKING_LEVELS,
  UNMANAGED,
} from './constants.js'

/**
 * Data only, mirroring pi's documented configuration: settings.json's startup
 * defaults (settings.md) and models.json's provider blocks (models.md,
 * verified against pi-mono main `71dca87` on 2026-09-11 — sources pinned in
 * constants.ts). Every managed key of pi is declared here once, and both the
 * review screen and the writer are driven from it. If pi moves its config
 * shape, this file is the blast radius.
 *
 * The managed-field mapping this module is written from, one row per field:
 *
 * | Field id | File and leaf | Disk type / check | Blank semantics | CLI option / omitted / --unset | Secret |
 * | --- | --- | --- | --- | --- | --- |
 * | defaultProvider | settings.json `defaultProvider` | string | blank deletes | `--provider` / preserved / deletes | no |
 * | defaultModel | settings.json `defaultModel` | string | blank deletes | `--model` / preserved / deletes | no |
 * | defaultThinkingLevel | settings.json `defaultThinkingLevel` | enum off…max | Unmanaged deletes | `--thinking-level` / preserved / deletes | no |
 * | baseUrl | models.json `providers.<id>.baseUrl` | http(s) URL, required for a new block | blank deletes | `--base-url` / preserved / not unsettable | no |
 * | api | models.json `providers.<id>.api` | enum, required once the block has models | Unmanaged deletes | `--api` / preserved / deletes | no |
 * | apiKey | models.json `providers.<id>.apiKey` | string; pi value forms ($ENV, !command) | blank deletes | secret only (CCSET_TOKEN / --token-stdin) | yes |
 * | models | models.json `providers.<id>.models[].id` | array merged per member id; member extras unmanaged | blank leaves disk untouched | `--model` list / preserved / deletes the array | no |
 */

/**
 * A provider id is a JSON key inside models.json, so it is validated as one.
 * Nothing is reserved: reusing a built-in provider id such as "anthropic" is
 * pi's documented way to route a built-in through a proxy, so ccset allows it
 * rather than silently forbidding a supported shape.
 */
export const validateProviderId = makeKeyNameValidator([])

/* ------------------------------------------------------------- settings */

export const DEFAULT_PROVIDER_PATH = ['defaultProvider']
export const DEFAULT_MODEL_PATH = ['defaultModel']
export const DEFAULT_THINKING_LEVEL_PATH = ['defaultThinkingLevel']

export const THINKING_CHOICES: FieldChoice[] = [
  ...THINKING_LEVELS.map((level) => ({
    value: level,
    labelKey: `pi.choice.level${level.charAt(0).toUpperCase()}${level.slice(1)}` as string,
  })),
  { value: UNMANAGED, labelKey: 'choice.unmanaged' },
]

export const GLOBAL_FIELDS: FieldSpec[] = [
  {
    id: 'defaultProvider',
    labelKey: 'pi.field.defaultProvider',
    helpKey: 'pi.help.defaultProvider',
    type: 'text',
    path: DEFAULT_PROVIDER_PATH,
  },
  {
    id: 'defaultModel',
    labelKey: 'pi.field.defaultModel',
    helpKey: 'pi.help.defaultModel',
    type: 'text',
    path: DEFAULT_MODEL_PATH,
  },
  {
    id: 'defaultThinkingLevel',
    labelKey: 'pi.field.defaultThinkingLevel',
    helpKey: 'pi.help.defaultThinkingLevel',
    type: 'choice',
    choices: THINKING_CHOICES,
    path: DEFAULT_THINKING_LEVEL_PATH,
  },
]

/**
 * pi ships sane built-ins for every startup default, so the form proposes
 * nothing: seeding is disk-only, and a blank field removes the key.
 */
export const GLOBAL_DEFAULTS: FormValues = {}

/** Every settings.json path ccset owns; everything else is preserved. */
export const MANAGED_SETTINGS_PATHS: string[][] = GLOBAL_FIELDS.map(
  (field) => field.path,
).filter((candidate): candidate is string[] => candidate !== undefined)

/* ------------------------------------------------------------- provider */

/** Providers are keys inside the models.json document. */
export const PROVIDER_ROOT = 'providers'

export function providerPath(id: string): string[] {
  return [PROVIDER_ROOT, id]
}

export function providerBaseUrlPath(id: string): string[] {
  return [...providerPath(id), 'baseUrl']
}

export function providerApiPath(id: string): string[] {
  return [...providerPath(id), 'api']
}

export function providerApiKeyPath(id: string): string[] {
  return [...providerPath(id), 'apiKey']
}

export function providerModelsPath(id: string): string[] {
  return [...providerPath(id), 'models']
}

export const API_CHOICES: FieldChoice[] = [
  { value: API_OPENAI_COMPLETIONS, labelKey: 'pi.choice.apiOpenaiCompletions' },
  { value: API_OPENAI_RESPONSES, labelKey: 'pi.choice.apiOpenaiResponses' },
  { value: API_ANTHROPIC_MESSAGES, labelKey: 'pi.choice.apiAnthropicMessages' },
  { value: API_GOOGLE_GENERATIVE_AI, labelKey: 'pi.choice.apiGoogleGenerativeAi' },
  { value: UNMANAGED, labelKey: 'choice.unmanaged' },
]

/**
 * Field ids map to paths through the builders above rather than a static
 * `path`, because the path is not knowable until the user has named the
 * provider. `path` is therefore absent on every field here, and providers.ts
 * emits the writes; the review form still renders from this list.
 *
 * `models` is optional in both surfaces because a block without it has a
 * documented meaning in pi: overriding a built-in provider's endpoint. A new
 * custom provider that serves its own models still needs `api` -- enforced as
 * a proposal check (pi.validate.apiRequired) rather than a field rule, since
 * the requirement depends on the other fields and the disk state.
 */
export const PROVIDER_FIELDS: FieldSpec[] = [
  {
    id: 'id',
    labelKey: 'pi.field.providerId',
    helpKey: 'pi.help.providerId',
    type: 'text',
    required: true,
    validate: validateProviderId,
  },
  {
    id: 'baseUrl',
    labelKey: 'field.baseUrl',
    helpKey: 'pi.help.baseUrl',
    type: 'text',
    required: true,
    validate: validateBaseUrl,
  },
  {
    id: 'api',
    labelKey: 'pi.field.api',
    helpKey: 'pi.help.api',
    type: 'choice',
    choices: API_CHOICES,
  },
  {
    id: 'apiKey',
    labelKey: 'pi.field.apiKey',
    helpKey: 'pi.help.apiKey',
    type: 'secret',
    required: true,
    validate: validateRequiredText,
  },
  {
    id: 'models',
    labelKey: 'pi.field.models',
    helpKey: 'pi.help.models',
    type: 'csv',
  },
]

/** Template defaults for a new provider: only the wire protocol is guessable. */
export const PROVIDER_DEFAULTS: FormValues = {
  api: DEFAULT_PROVIDER_API,
}

/** Fields whose value must never be printed unmasked. */
export const SECRET_FIELD_IDS = new Set(
  [...GLOBAL_FIELDS, ...PROVIDER_FIELDS]
    .filter((field) => field.type === 'secret')
    .map((field) => field.id),
)
