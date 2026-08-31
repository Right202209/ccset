/**
 * Shared vocabulary. Everything here is agent-agnostic: an agent module speaks
 * only in these types, and the UI renders only these types.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonObject = { [key: string]: JsonValue }

/** Serialization is a seam, not an assumption (PRD 4.3). */
export type Codec = 'json'

export interface ConfigFile {
  path: string
  codec: Codec
}

/** Everything an action needs from the process it runs in. */
export interface Ctx {
  /** Home directory root; overridable via CCSET_HOME for isolated runs. */
  home: string
}

/* ------------------------------------------------------------------ forms */

export type FieldType = 'text' | 'secret' | 'choice' | 'boolean' | 'csv'

export interface FieldChoice {
  value: string
  labelKey: string
}

export interface FieldSpec {
  id: string
  labelKey: string
  type: FieldType
  /** JSON path this field writes to. Omitted for virtual fields (e.g. name). */
  path?: string[]
  /** Collapsed behind the Advanced toggle. */
  advanced?: boolean
  required?: boolean
  readOnly?: boolean
  helpKey?: string
  suggestions?: string[]
  choices?: FieldChoice[]
  /** Returns an i18n key describing the problem, or null when valid. */
  validate?: (value: string) => string | null
}

export type FieldValue = string | boolean
export type FormValues = Record<string, FieldValue>

/* ---------------------------------------------------------------- screens */

export type MessageTone = 'success' | 'error' | 'info' | 'warn'

export interface ListItem {
  id: string
  label: string
  detail?: string
  tone?: MessageTone
  run: () => Promise<ActionResult>
}

export interface StatusLine {
  label: string
  value: string
  tone?: MessageTone
}

export interface StatusSection {
  title: string
  lines: StatusLine[]
  note?: string
}

export interface FormScreen {
  kind: 'form'
  title: string
  fields: FieldSpec[]
  /** Proposed values: existing file value -> template default. */
  values: FormValues
  /** Values as they exist on disk, so the UI can mark additions and changes. */
  baseline: FormValues
  notes?: string[]
  /** Secret-free description shown while submit is running. */
  busyLabel?: (values: FormValues) => string
  submit: (values: FormValues) => Promise<ActionResult>
}

export interface ListScreen {
  kind: 'list'
  title: string
  empty?: string
  items: ListItem[]
}

export interface StatusScreen {
  kind: 'status'
  title: string
  sections: StatusSection[]
  items: ListItem[]
}

export interface ConfirmScreen {
  kind: 'confirm'
  title: string
  lines: string[]
  confirmLabel: string
  /** Secret-free description shown while confirm is running. */
  busyLabel?: string
  confirm: () => Promise<ActionResult>
}

export interface MessageScreen {
  kind: 'message'
  title: string
  lines: string[]
  tone: MessageTone
}

export type ActionResult =
  | FormScreen
  | ListScreen
  | StatusScreen
  | ConfirmScreen
  | MessageScreen

/* ------------------------------------------------------------- extensions */

export interface Action {
  id: string
  labelKey: string
  run: (ctx: Ctx) => Promise<ActionResult>
}

export interface Agent {
  id: string
  name: string
  detect: (ctx: Ctx) => Promise<boolean>
  getActions: () => Action[]
}

/** Result of a successful write, rendered as the success message. */
export interface WriteReport {
  path: string
  mode: string
  backupPath: string | null
  command: string
}
