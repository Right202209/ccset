import { NavLink } from 'react-router-dom'
import { useLanguage } from '../../i18n/index.js'
import type { DocEntry, DocGroup } from '../../content/registry.js'

/** One sidebar section: its label and the registry entries under it. */
export function SidebarGroup({
  group,
  entries,
}: {
  group: DocGroup
  entries: readonly DocEntry[]
}) {
  const { t } = useLanguage()
  if (entries.length === 0) return null
  return (
    <div className="docs-group" data-group={group}>
      <p className="docs-group-label">{t(`group.${group}`)}</p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.slug}>
            <NavLink to={`/docs/${entry.slug}`} className="docs-link">
              {t(entry.labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
