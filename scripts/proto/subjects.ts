import type { FieldSpec, FormValues } from '../../src/types.js'
import {
  GLOBAL_DEFAULTS,
  GLOBAL_FIELDS,
  PROVIDER_FIELDS,
} from '../../src/agents/claude-code/manifest.js'
import { SWITCH_OFF, SWITCH_UNMANAGED } from '../../src/core/constants.js'
import { t } from '../../src/i18n/index.js'

/**
 * The two review forms ccset actually has, posed so that one paint carries every
 * element type at once: label column, changed marker, choice radios, a boolean,
 * a masked secret, hints, an error line and control rows.
 *
 * Real `FieldSpec`s from the manifest, not invented ones -- a treatment judged
 * against a synthetic form would be judged against a form nobody uses.
 *
 * Prototype code for issue #9.
 */

/** Obviously fake. These renders are checked in, so a plausible token is not. */
export const PROTO_TOKEN = 'sk-proto-EXAMPLE-not-a-real-token'

const PROVIDER_NAME = 'acme'
const GLOBAL_PATH = '/home/you/.claude/settings.json'

export interface SubjectState {
  values: FormValues
  /** Values as they sit on disk, so a row can earn the changed marker. */
  baseline: FormValues
  /**
   * Field id -> validation key. The real form fills this in after a failed save;
   * these renders are static, and the error line is one of the elements on trial.
   */
  errors: Record<string, string>
  focusId: string
}

export interface Subject {
  id: string
  label: string
  /** The line `App.tsx` paints above the Screen. */
  title: string
  notes: string[]
  fields: FieldSpec[]
  state: SubjectState
  /** Set when the form has a secret row, so masking can be asserted per render. */
  secret?: string
}

/**
 * Focused on Base URL, which is the one row that carries a hint and an error at
 * the same time. The token row is left unfocused so it paints `maskSecret`'s
 * form rather than the editor's.
 */
const PROVIDER_STATE: SubjectState = {
  values: {
    name: PROVIDER_NAME,
    baseUrl: 'ftp://api.acme.example',
    token: PROTO_TOKEN,
    model: 'acme/opus-1m',
    fallbackModel: 'acme/sonnet-4, acme/haiku-3',
    defaultOpusModel: 'acme/opus-1m',
    defaultSonnetModel: '',
    defaultHaikuModel: '',
  },
  baseline: {
    name: PROVIDER_NAME,
    baseUrl: 'https://api.acme.example',
    token: '',
    model: '',
    fallbackModel: '',
    defaultOpusModel: '',
    defaultSonnetModel: '',
    defaultHaikuModel: '',
  },
  errors: { baseUrl: 'validate.urlProtocol' },
  focusId: 'baseUrl',
}

/**
 * Focused on Model, whose suggestion list is the longest hint either form has --
 * 76 columns of it. That is the line the fixed hint indent mangles, so it is the
 * line worth looking at.
 */
const GLOBAL_STATE: SubjectState = {
  values: { ...GLOBAL_DEFAULTS, proxyEnabled: true, cleanupPeriodDays: '720 days' },
  baseline: {
    proxyEnabled: false,
    proxyUrl: '',
    disableNonessentialTraffic: SWITCH_UNMANAGED,
    attributionHeader: SWITCH_OFF,
    disableInstallationChecks: SWITCH_UNMANAGED,
    enableToolSearch: SWITCH_UNMANAGED,
    cleanupPeriodDays: '30',
    model: '',
  },
  errors: { cleanupPeriodDays: 'validate.notInteger' },
  focusId: 'model',
}

export const PROVIDER_SUBJECT: Subject = {
  id: 'provider',
  label: 'Provider form',
  title: t('action.providerEdit', { name: PROVIDER_NAME }),
  notes: [t('note.providerPath'), t('note.preserved')],
  fields: PROVIDER_FIELDS,
  state: PROVIDER_STATE,
  secret: PROTO_TOKEN,
}

export const GLOBAL_SUBJECT: Subject = {
  id: 'global',
  label: 'Global settings form',
  title: t('action.global'),
  notes: [t('note.globalPath', { path: GLOBAL_PATH }), t('note.preserved')],
  fields: GLOBAL_FIELDS,
  state: GLOBAL_STATE,
}

export const SUBJECTS: Subject[] = [PROVIDER_SUBJECT, GLOBAL_SUBJECT]

/** Whether the form has an Advanced toggle at all, as `ReviewForm` decides it. */
export function hasAdvanced(subject: Subject): boolean {
  return subject.fields.some((field) => field.advanced === true)
}
