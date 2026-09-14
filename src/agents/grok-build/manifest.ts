import type { FieldChoice, FieldSpec, FormValues } from '../../types.js'
import { makeKeyNameValidator, validateBaseUrl } from '../../core/validate.js'
import {
  API_BACKEND_CHAT_COMPLETIONS,
  API_BACKEND_MESSAGES,
  API_BACKEND_RESPONSES,
  UNMANAGED,
} from './constants.js'

/**
 * Data only, mirroring Grok Build's documented config.toml (11-custom-models.md
 * and 26-config-reference.md, verified against xai-org/grok-build main
 * `37949780c144e37df692e3d669051a21fec24f20` on 2026-09-14 — sources pinned in
 * constants.ts). Every managed key of Grok Build is declared here once, and
 * both the review screen and the writer are driven from it. If Grok moves its
 * config shape, this file is the blast radius.
 *
 * The managed-field mapping this module is written from, one row per field:
 *
 * | Field id | File and leaf | Disk type / check | Blank semantics | CLI option / omitted / --unset | Secret |
 * | --- | --- | --- | --- | --- | --- |
 * | defaultModel | config.toml `models.default` | string | blank deletes | `--model` / preserved / deletes | no |
 * | modelId | config.toml `model.<id>.model` | string | blank deletes | `--model` / preserved / deletes | no |
 * | baseUrl | config.toml `model.<id>.base_url` | http(s) URL | blank deletes | `--base-url` / preserved / deletes | no |
 * | displayName | config.toml `model.<id>.name` | string | blank deletes | `--name` / preserved / deletes | no |
 * | apiBackend | config.toml `model.<id>.api_backend` | enum chat_completions / responses / messages | Unmanaged deletes | `--api-backend` / preserved / deletes | no |
 * | apiKey | config.toml `model.<id>.api_key` | string | blank deletes | secret only (CCSET_TOKEN / --token-stdin) | yes |
 *
 * Deliberately unmanaged, so preserved on every save: `env_key` (Grok's
 * preferred credential source, and a string-or-array the form cannot express),
 * `extra_headers`, `query_params`, `env_http_headers`, the sampling and window
 * numbers, and every other documented `[model.<id>]` and `[models]` key.
 */

/**
 * A provider id is a TOML table key under `model`, so it is validated as one.
 * Nothing is reserved: Grok lets a [model.<id>] block override a built-in
 * model by naming it, so ccset does not keep a reserved list. The shared name
 * pattern still applies, which means a built-in id carrying a dot (grok-4.6)
 * is not an id ccset can write; the default points at one through the free
 * text `models.default` instead, and a hand-written quoted table survives
 * untouched like any other unmanaged block.
 */
export const validateProviderId = makeKeyNameValidator([])

/* --------------------------------------------------------------- global */

export const DEFAULT_MODEL_PATH = ['models', 'default']

export const GLOBAL_FIELDS: FieldSpec[] = [
  {
    id: 'defaultModel',
    labelKey: 'field.globalModel',
    helpKey: 'grokBuild.help.defaultModel',
    type: 'text',
    path: DEFAULT_MODEL_PATH,
  },
]

/**
 * Grok ships a working default model, so the form proposes nothing: seeding is
 * disk-only, and a blank field removes the key.
 */
export const GLOBAL_DEFAULTS: FormValues = {}

/** Every config.toml path ccset owns; everything else is preserved. */
export const MANAGED_GLOBAL_PATHS: string[][] = GLOBAL_FIELDS.map(
  (field) => field.path,
).filter((candidate): candidate is string[] => candidate !== undefined)

/* ------------------------------------------------------------- provider */

/** Providers are tables inside the one config document, so paths need the id. */
export const PROVIDER_ROOT = 'model'

export function providerPath(id: string): string[] {
  return [PROVIDER_ROOT, id]
}

export function providerKeyPath(id: string, key: string): string[] {
  return [PROVIDER_ROOT, id, key]
}

/** Every key ccset owns inside one provider table. */
export const PROVIDER_KEYS = {
  model: 'model',
  baseUrl: 'base_url',
  name: 'name',
  apiKey: 'api_key',
  apiBackend: 'api_backend',
} as const

export const API_BACKEND_CHOICES: FieldChoice[] = [
  { value: API_BACKEND_CHAT_COMPLETIONS, labelKey: 'grokBuild.choice.backendChatCompletions' },
  { value: API_BACKEND_RESPONSES, labelKey: 'grokBuild.choice.backendResponses' },
  { value: API_BACKEND_MESSAGES, labelKey: 'grokBuild.choice.backendMessages' },
  { value: UNMANAGED, labelKey: 'choice.unmanaged' },
]

/**
 * Only the id is required: a block that names a built-in model id may set only
 * the fields it overrides (the documented `[model.grok-4.6]` with just an
 * `api_key`), and a custom model's credential may come from `env_key`, the
 * session token, or `XAI_API_KEY` instead of an inline `api_key`. Whether the
 * result can reach an endpoint is Grok's call, not a field rule ccset invents.
 */
export const PROVIDER_FIELDS: FieldSpec[] = [
  {
    id: 'id',
    labelKey: 'grokBuild.field.providerId',
    helpKey: 'grokBuild.help.providerId',
    type: 'text',
    required: true,
    validate: validateProviderId,
  },
  {
    id: 'modelId',
    labelKey: 'grokBuild.field.modelId',
    helpKey: 'grokBuild.help.modelId',
    type: 'text',
  },
  {
    id: 'baseUrl',
    labelKey: 'field.baseUrl',
    helpKey: 'grokBuild.help.baseUrl',
    type: 'text',
    validate: validateBaseUrl,
  },
  {
    id: 'displayName',
    labelKey: 'grokBuild.field.displayName',
    helpKey: 'grokBuild.help.displayName',
    type: 'text',
  },
  {
    id: 'apiBackend',
    labelKey: 'grokBuild.field.apiBackend',
    helpKey: 'grokBuild.help.apiBackend',
    type: 'choice',
    choices: API_BACKEND_CHOICES,
  },
  {
    id: 'apiKey',
    labelKey: 'grokBuild.field.apiKey',
    helpKey: 'grokBuild.help.apiKey',
    type: 'secret',
  },
]

/** Nothing about a third-party endpoint is guessable, so nothing is proposed. */
export const PROVIDER_DEFAULTS: FormValues = {}

/** Fields whose value must never be printed unmasked. */
export const SECRET_FIELD_IDS = new Set(
  [...GLOBAL_FIELDS, ...PROVIDER_FIELDS]
    .filter((field) => field.type === 'secret')
    .map((field) => field.id),
)
