import { NavLink } from 'react-router-dom'
import { useLanguage } from '../../i18n/index.js'
import type { DocEntry } from '../../content/registry.js'

/** Bottom pager between neighbouring docs in registry order. */
export function PrevNext({ prev, next }: { prev?: DocEntry; next?: DocEntry }) {
  const { t } = useLanguage()
  if (prev === undefined && next === undefined) return null
  return (
    <div className="docs-pager">
      {prev !== undefined ? (
        <NavLink to={`/docs/${prev.slug}`} className="docs-pager-link is-prev">
          <span className="docs-pager-dir">← {t('docs.previous')}</span>
          <span className="docs-pager-title">{t(prev.labelKey)}</span>
        </NavLink>
      ) : (
        <span />
      )}
      {next !== undefined && (
        <NavLink to={`/docs/${next.slug}`} className="docs-pager-link is-next">
          <span className="docs-pager-dir">{t('docs.next')} →</span>
          <span className="docs-pager-title">{t(next.labelKey)}</span>
        </NavLink>
      )}
    </div>
  )
}
