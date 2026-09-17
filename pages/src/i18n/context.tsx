import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { en } from './en.js'
import { zhHans } from './zh-Hans.js'
import { isLocale, LOCALE_STORAGE_KEY, type Catalog, type Locale, type Params } from './types.js'

const CATALOGS: Readonly<Record<Locale, Catalog>> = { en, 'zh-Hans': zhHans }

/**
 * First visit follows the browser: zh* requests read as zh-Hans, everything
 * else as English. A browser may be asked its preference because the site is
 * static content; the CLI keeps its own explicit-choice rule (ADR 0005).
 */
function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved !== null && isLocale(saved)) return saved
  } catch {
    /* storage unavailable (private mode) — fall through to the browser hint */
  }
  for (const tag of navigator.languages ?? []) {
    if (tag.toLowerCase().startsWith('zh')) return 'zh-Hans'
  }
  return 'en'
}

export function translate(locale: Locale, key: string, params?: Params): string {
  const template = CATALOGS[locale][key] ?? CATALOGS.en[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

interface LanguageValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Params) => string
}

const LanguageContext = createContext<LanguageValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      /* a rejected write keeps the choice for this visit only */
    }
  }, [])

  const t = useCallback((key: string, params?: Params) => translate(locale, key, params), [locale])

  const value = useMemo<LanguageValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext)
  if (value === null) throw new Error('useLanguage must be used inside LanguageProvider')
  return value
}
