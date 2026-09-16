import { Component, type ErrorInfo, type ReactNode } from 'react'
import { translate } from '../i18n/context.js'
import type { Locale } from '../i18n/types.js'

const RELOAD_FLAG = 'ccset-pages-chunk-reload'
const CHUNK_ERROR =
  /Loading chunk \d+ failed|Importing a module script failed|Failed to fetch dynamically imported module/

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last-resort boundary around the whole site. A failed lazy-chunk load (a
 * deploy between visits) reloads the page once; everything else shows a
 * reloadable message instead of a blank screen. It sits outside React's hook
 * rules, so the fallback reads the locale LanguageProvider set on <html>.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (CHUNK_ERROR.test(error.message) && sessionStorage.getItem(RELOAD_FLAG) === null) {
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children
    const locale: Locale = document.documentElement.lang === 'zh-Hans' ? 'zh-Hans' : 'en'
    return (
      <div className="notfound" role="alert">
        <h1 className="notfound-title">:(</h1>
        <p className="notfound-body">{translate(locale, 'error.boundary')}</p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => window.location.reload()}
        >
          {translate(locale, 'error.reload')}
        </button>
      </div>
    )
  }
}
