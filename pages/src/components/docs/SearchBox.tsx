import { NavLink } from 'react-router-dom'
import { useDocSearch } from '../../hooks/useDocSearch.js'
import { useLanguage } from '../../i18n/index.js'

/** Sidebar search: typed query swaps the group lists for ranked hits. */
export function SearchBox() {
  const { t } = useLanguage()
  const { query, setQuery, hits } = useDocSearch()
  return (
    <div className="docs-search">
      <SearchIcon />
      <input
        type="search"
        className="docs-search-input"
        value={query}
        placeholder={t('docs.search')}
        aria-label={t('docs.search')}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query.trim() !== '' && (
        <ul className="docs-search-results">
          {hits.map((hit) => (
            <li key={hit.slug}>
              <NavLink to={`/docs/${hit.slug}`} className="docs-search-hit">
                <span className="docs-search-hit-title">{hit.title}</span>
                <span className="docs-search-hit-snippet">{hit.snippet}</span>
              </NavLink>
            </li>
          ))}
          {hits.length === 0 && <li className="docs-search-empty">{t('docs.noResults', { query: query.trim() })}</li>}
        </ul>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg className="docs-search-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
