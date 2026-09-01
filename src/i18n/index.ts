import { en } from './en.js'

export type Catalog = Record<string, string>
export type Params = Record<string, string | number>
/** An agent's strings, keyed by locale, so a second catalog stays additive. */
export type Messages = Record<string, Catalog>

// English only in v1 (PRD 5.5). A second catalog is additive: add the file,
// add it here. No locale detection.
const LOCALE = 'en'
const catalog: Catalog = { ...en }

/**
 * An agent ships the strings its own screens reference (PRD 2.2 criterion 5):
 * without this, adding an agent would always touch src/i18n/en.ts as well as
 * its module and the registry, and "exactly two files" could never be true.
 *
 * Keys are namespaced by agent id, so two agents cannot collide; a collision
 * with an existing key is a programming error and is refused rather than
 * silently changing text the shell already uses.
 */
export function registerMessages(messages: Messages | undefined): void {
  const entries = messages?.[LOCALE]
  if (entries === undefined) return
  for (const [key, value] of Object.entries(entries)) {
    if (Object.prototype.hasOwnProperty.call(catalog, key)) {
      throw new Error(`i18n: duplicate key "${key}"`)
    }
    catalog[key] = value
  }
}

/**
 * Missing keys render as the key itself rather than throwing -- a UI that
 * crashes on a typo in a label is worse than one showing `field.model`.
 */
export function t(key: string, params?: Params): string {
  const template = catalog[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export function hasKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(catalog, key)
}
