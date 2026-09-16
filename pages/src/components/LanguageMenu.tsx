import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLanguage } from '../i18n/index.js'
import { LOCALES } from '../i18n/types.js'
import type { Locale } from '../i18n/types.js'

/**
 * The language switcher. Options are named as each language names itself, so
 * the list does not need translating; the button shows the active one.
 */
export function LanguageMenu() {
  const { locale, setLocale, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useOutsideClose(rootRef, open, () => setOpen(false))

  return (
    <div className="lang-menu" ref={rootRef}>
      <button
        type="button"
        className="lang-menu-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('nav.language')}
        onClick={() => setOpen((value) => !value)}
      >
        <GlobeIcon />
        <span>{languageName(locale)}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="lang-menu-list" role="listbox">
          {LOCALES.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === locale}
                className={`lang-menu-item${option === locale ? ' is-active' : ''}`}
                onClick={() => {
                  setLocale(option)
                  setOpen(false)
                }}
              >
                {languageName(option)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function languageName(locale: Locale): string {
  return locale === 'zh-Hans' ? '简体中文' : 'English'
}

function useOutsideClose(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!active) return undefined
    const onPointerDown = (event: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, active, onClose])
}

function GlobeIcon(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="8" cy="8" rx="3" ry="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 8h13" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
