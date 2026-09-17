/** A site string catalog. Keys are flat, as in the CLI's own catalogs. */
export type Catalog = Record<string, string>

/** Values t() substitutes into `{placeholder}` slots. */
export type Params = Record<string, string | number>

/** One locale the website carries; mirrors the CLI's two catalogs. */
export type Locale = 'en' | 'zh-Hans'

export const LOCALES: readonly Locale[] = ['en', 'zh-Hans']

/** localStorage key for an explicit language choice. */
export const LOCALE_STORAGE_KEY = 'ccset-lang'

export function isLocale(value: string): value is Locale {
  return value === 'en' || value === 'zh-Hans'
}
