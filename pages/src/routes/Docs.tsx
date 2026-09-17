import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLanguage } from '../i18n/index.js'
import { useResponsive } from '../hooks/useResponsive.js'
import { useActiveHeading } from '../hooks/useActiveHeading.js'
import { docTitle, getDoc, homeSlug, neighbors } from '../content/docs.js'
import type { DocContent } from '../content/docs.js'
import { extractHeadings } from '../markdown/headings.js'
import { MarkdownView } from '../markdown/MarkdownView.js'
import { DocHeader } from '../components/docs/DocHeader.js'
import { PrevNext } from '../components/docs/PrevNext.js'
import { SearchBox } from '../components/docs/SearchBox.js'
import { Sidebar } from '../components/docs/Sidebar.js'
import { Toc } from '../components/docs/Toc.js'

/** Route shell: /docs/<slug> renders the doc; an unknown slug gets a note. */
export default function Docs() {
  const { slug } = useParams()
  const { locale } = useLanguage()
  const doc = getDoc(slug ?? homeSlug(), locale)
  if (doc === undefined) return <UnknownDoc />
  return <DocPage key={doc.entry.slug} doc={doc} />
}

/** One document: sidebar, article with meta header, and the outline. */
function DocPage({ doc }: { doc: DocContent }) {
  const { t } = useLanguage()
  const narrow = useResponsive()
  const [menuOpen, setMenuOpen] = useState(false)
  const articleRef = useRef<HTMLElement | null>(null)
  const headings = useMemo(() => extractHeadings(doc.markdown), [doc.markdown])
  const title = useMemo(() => docTitle(doc.markdown), [doc.markdown])
  const activeId = useActiveHeading(headings, articleRef)
  const pager = neighbors(doc.entry.slug)

  useEffect(() => {
    document.title = `${title} — ccset`
  }, [title])

  return (
    <div className="docs container">
      <aside className={`docs-sidebar${menuOpen ? ' is-open' : ''}`}>
        <SearchBox />
        <Sidebar />
      </aside>
      {narrow && (
        <button type="button" className="docs-menu-toggle" onClick={() => setMenuOpen((open) => !open)}>
          {t('docs.menu')}
        </button>
      )}
      <article className="docs-article" ref={articleRef}>
        <DocHeader entry={doc.entry} />
        <MarkdownView markdown={doc.markdown} sourceDir={doc.sourceDir} />
        <PrevNext prev={pager.prev} next={pager.next} />
      </article>
      <Toc headings={headings} activeId={activeId} />
    </div>
  )
}

function UnknownDoc() {
  const { t } = useLanguage()
  useEffect(() => {
    document.title = `${t('notFound.title')} — ccset`
  }, [t])
  return (
    <div className="docs container">
      <div className="notfound docs-unknown">
        <h1 className="notfound-title">{t('docs.unknownDoc')}</h1>
        <Link to="/docs" className="button button-secondary">
          {t('docs.allDocs')}
        </Link>
      </div>
    </div>
  )
}
