import { useLanguage } from '../../i18n/index.js'
import { repoBlobUrl } from '../../content/links.js'
import type { DocEntry } from '../../content/registry.js'

/** Meta line above a document: group badge and the GitHub source link. */
export function DocHeader({ entry }: { entry: DocEntry }) {
  const { t } = useLanguage()
  return (
    <div className="docs-header">
      <span className="docs-group-badge">{t(`group.${entry.group}`)}</span>
      <a
        className="docs-source-link"
        href={repoBlobUrl(entry.repoPath)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('docs.viewSource')}
      </a>
    </div>
  )
}
