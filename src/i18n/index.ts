import { en } from './en.js'
import { zhHans } from './zh-Hans.js'

export type Catalog = Record<string, string>
export type Params = Record<string, string | number>
/** An agent's strings, keyed by locale, so a second catalog stays additive. */
export type Messages = Record<string, Catalog>

/**
 * PRD 5.5 kept English only in v1 and planned a purely additive second
 * catalog; zh-Hans is that catalog. Selection is an explicit CCSET_LOCALE
 * opt-in resolved at the cli.tsx boundary, not detection -- a user who wants
 * Chinese says so, everyone else gets English.
 */

/** One locale ccset carries: its catalog, plus the name it calls itself by on
 *  the first-run prompt -- the one screen whose copy bypasses the catalogs, so
 *  the label cannot live in the catalog it names. */
interface LocaleDef {
  label: string
  catalog: Catalog
}

/**
 * The one table a new catalog is added to: a new file plus one entry here --
 * the type, the prompt options and t() all derive from it.
 */
const LOCALES = {
  en: { label: 'English', catalog: { ...en } },
  'zh-Hans': { label: '简体中文', catalog: { ...zhHans } },
} satisfies Record<string, LocaleDef>

/** The locale tags ccset carries; anything else reads as unchosen. */
export type Locale = keyof typeof LOCALES

const LOCALE_IDS = Object.keys(LOCALES) as Locale[]

const BASE_LOCALE: Locale = 'en'
/** The override variable is owned here, beside the locales it selects. */
export const LOCALE_ENV = 'CCSET_LOCALE'

let active: Locale = BASE_LOCALE

/** Resolves the override variable; an unset or unknown value falls back to English. */
export function resolveLocale(env: NodeJS.ProcessEnv = process.env): Locale {
  const requested = normalizeLocale(env[LOCALE_ENV])
  if (requested === undefined) return BASE_LOCALE
  return requested
}

/**
 * A user who reaches for an env var spells it the way their shell spells
 * LANG: ZH_hans.UTF-8 and zh-Hans are the same request, so case, '_' for '-',
 * and a trailing codeset or modifier are normalized away. The tag itself must
 * still name the script exactly -- zh-TW and zh-CN select nothing -- because
 * guessing a region tag into a script catalog is how the wrong language
 * ships.
 */
function normalizeLocale(requested: string | undefined): Locale | undefined {
  if (requested === undefined) return undefined
  const tag = requested.trim().replace(/_/g, '-').split(/[.@]/)[0] ?? ''
  return LOCALE_IDS.find((locale) => locale.toLowerCase() === tag.toLowerCase())
}

/**
 * True when the tag names a catalog ccset carries. The saved preference is
 * validated with this before it reaches setLocale, so a hand-edited settings
 * file degrades to unchosen instead of throwing at startup.
 */
export function isLocale(locale: string): locale is Locale {
  return Object.prototype.hasOwnProperty.call(LOCALES, locale)
}

/** Switches the catalog t() resolves through. An unknown locale is refused. */
export function setLocale(locale: string): void {
  if (!isLocale(locale)) {
    throw new Error(`i18n: unknown locale "${locale}"`)
  }
  active = locale
}

/** The locales ccset carries, in prompt order, each named as it names itself. */
export function localeOptions(): Array<{ id: Locale; label: string }> {
  return LOCALE_IDS.map((id) => ({ id, label: LOCALES[id].label }))
}

/**
 * An agent ships the strings its own screens reference (PRD 2.2 criterion 5):
 * without this, adding an agent would always touch src/i18n/en.ts as well as
 * its module and the registry, and "exactly two files" could never be true.
 *
 * Entries land in the catalog of the locale that declares them, so a locale
 * that has not translated an agent yet simply falls back to English. Keys are
 * namespaced by agent id, so two agents cannot collide; a collision with an
 * existing key is a programming error and is refused rather than silently
 * changing text the shell already uses. So is a locale the shell does not
 * carry: its entries would otherwise be dropped without a trace.
 */
export function registerMessages(messages: Messages | undefined): void {
  if (messages === undefined) return
  for (const [locale, entries] of Object.entries(messages)) {
    if (!isLocale(locale)) {
      throw new Error(`i18n: unknown locale "${locale}"`)
    }
    const catalog = LOCALES[locale].catalog
    for (const [key, value] of Object.entries(entries)) {
      if (Object.prototype.hasOwnProperty.call(catalog, key)) {
        throw new Error(`i18n: duplicate key "${key}"`)
      }
      catalog[key] = value
    }
  }
}

/**
 * Missing keys degrade rather than throw -- a UI that crashes on a typo in a
 * label is worse than one showing `field.model`. A key the active locale has
 * not translated yet shows the English text; only a key no catalog defines
 * shows the key itself.
 */
export function t(key: string, params?: Params): string {
  const template = LOCALES[active].catalog[key] ?? LOCALES[BASE_LOCALE].catalog[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export function hasKey(key: string): boolean {
  return defines(active, key) || defines(BASE_LOCALE, key)
}

function defines(locale: Locale, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(LOCALES[locale].catalog, key)
}
