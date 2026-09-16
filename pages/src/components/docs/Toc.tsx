import { useLanguage } from '../../i18n/index.js'
import type { Heading } from '../../markdown/headings.js'

/** Right-hand "On this page" outline; the active id comes from the observer. */
export function Toc({ headings, activeId }: { headings: Heading[]; activeId: string }) {
  const { t } = useLanguage()
  const label = t('docs.onThisPage')
  if (headings.length === 0) return null
  return (
    <nav className="docs-toc" aria-label={label}>
      <p className="docs-toc-label">{label}</p>
      <ul>
        {headings.map((heading) => (
          <li
            key={heading.id}
            className={`docs-toc-item depth-${heading.depth}${heading.id === activeId ? ' is-active' : ''}`}
          >
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
