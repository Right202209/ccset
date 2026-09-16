import { NavLink } from 'react-router-dom'
import { useLanguage } from '../../i18n/index.js'
import { DOC_ENTRIES, type DocEntry, type DocGroup } from '../../content/registry.js'

const GROUP_ORDER: readonly DocGroup[] = ['getting-started', 'reference', 'project']

/** The docs sidebar: the three groups in registry order, registry labels. */
export function Sidebar() {
  const { t } = useLanguage()
  return (
    <nav className="docs-nav" aria-label={t('docs.menu')}>
      {GROUP_ORDER.map((group) => (
        <SidebarGroup
          key={group}
          group={group}
          label={t(`group.${group}`)}
          entries={DOC_ENTRIES.filter((entry) => entry.group === group)}
        />
      ))}
    </nav>
  )
}

function SidebarGroup({
  group,
  label,
  entries,
}: {
  group: DocGroup
  label: string
  entries: readonly DocEntry[]
}) {
  const { t } = useLanguage()
  if (entries.length === 0) return null
  return (
    <div className="docs-group" data-group={group}>
      <p className="docs-group-label">{label}</p>
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
