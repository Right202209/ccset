import { useLanguage } from '../../i18n/index.js'
import { DOC_ENTRIES, type DocGroup } from '../../content/registry.js'
import { SidebarGroup } from './SidebarGroup.js'

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
          entries={DOC_ENTRIES.filter((entry) => entry.group === group)}
        />
      ))}
    </nav>
  )
}
