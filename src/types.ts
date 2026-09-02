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

/**
 * Serialization is a seam, not an assumption (PRD 4.3). `toml` and `jsonc` are
 * edited in place rather than re-serialised, because those documents carry
 * comments and key order that a parse-and-re-emit round trip would discard
 * (ADR 0003, ADR 0004).
 */
export type Codec = 'json' | 'jsonc' | 'toml'

export interface ConfigFile {
  path: string
  codec: Codec
}

/** Everything an action needs from the process it runs in. */
export interface Ctx {
  /** Home directory root; overridable via CCSET_HOME for isolated runs. */
  home: string
}

/** Terminal budget used to cut long interface regions. */
export interface Viewport {
  rows: number
  columns: number
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
  /**
   * i18n key for the one-line detail under the menu label. Agents that share a
   * label ("Global settings") still describe different files, so the detail
   * cannot be derived from labelKey. Defaults to `${labelKey}Detail`.
   */
  detailKey?: string
  run: (ctx: Ctx) => Promise<ActionResult>
}

export interface Agent {
  id: string
  name: string
  /**
   * Strings only this agent's screens use, keyed by locale and namespaced by
   * agent id. Shipping them with the module is what keeps adding an agent to
   * two files (PRD 2.2 criterion 5) instead of three.
   */
  messages?: Record<string, Record<string, string>>
  detect: (ctx: Ctx) => Promise<boolean>
  getActions: () => Action[]
}

/** Result of a successful write, rendered as the success message. */
export interface WriteReport {
  path: string
  mode: string
  backupPath: string | null
  command: string
  /**
   * i18n key for the line introducing `command`. An agent that loads its config
   * from a fixed path has nothing to activate and must not borrow
   * "Activate it with:". Defaults to `write.activate`.
   */
  activateKey?: string
  /**
   * Extra lines, already translated. A save that touches more than one file --
   * a settings document and the credential beside it -- has to name both, and
   * `path` can only carry one.
   */
  notes?: string[]
}
