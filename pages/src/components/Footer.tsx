import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index.js'
import { repoBlobUrl } from '../content/links.js'
import { findEntry } from '../content/registry.js'
import { GitHubIcon } from './GitHubIcon.js'
import { LanguageMenu } from './LanguageMenu.js'

const REPO_URL = 'https://github.com/Right202209/ccset'
const NPM_URL = 'https://www.npmjs.com/package/@droite/ccset'

/** Registry slugs listed under each footer column, in registry label order. */
const DOC_LINKS = ['overview', 'user-guide', 'commands', 'glossary', 'architecture'] as const
const PROJECT_DOC_LINKS = ['contributing', 'security', 'support'] as const

/** Site footer: brand, documentation and project columns, language switcher. */
export function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <FooterBrand />
          <FooterColumn heading={t('footer.docs')}>
            <DocLinks slugs={DOC_LINKS} />
          </FooterColumn>
          <FooterColumn heading={t('footer.project')}>
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <GitHubIcon size={14} />
                {t('nav.github')}
              </a>
            </li>
            <li>
              <a href={NPM_URL} target="_blank" rel="noopener noreferrer">
                {t('footer.npm')}
              </a>
            </li>
            <DocLinks slugs={PROJECT_DOC_LINKS} />
            <li>
              <a href={repoBlobUrl('LICENSE')} target="_blank" rel="noopener noreferrer">
                {t('footer.license')}
              </a>
            </li>
          </FooterColumn>
        </div>
        <div className="footer-bottom">
          <p className="footer-note">{t('footer.builtFrom')}</p>
          <LanguageMenu />
        </div>
      </div>
    </footer>
  )
}

function FooterBrand() {
  const { t } = useLanguage()
  return (
    <div>
      <Link to="/" className="footer-brand">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={24} height={24} />
        <span>ccset</span>
      </Link>
      <p className="footer-tagline">{t('footer.tagline')}</p>
    </div>
  )
}

function FooterColumn({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div>
      <p className="footer-heading">{heading}</p>
      <ul className="footer-list">{children}</ul>
    </div>
  )
}

/** Footer entries for registered docs; an unregistered slug renders nothing. */
function DocLinks({ slugs }: { slugs: readonly string[] }) {
  const { t } = useLanguage()
  return (
    <>
      {slugs.map((slug) => {
        const entry = findEntry(slug)
        if (entry === undefined) return null
        return (
          <li key={slug}>
            <Link to={`/docs/${slug}`}>{t(entry.labelKey)}</Link>
          </li>
        )
      })}
    </>
  )
}
