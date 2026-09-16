import { useLanguage } from '../i18n/index.js'
import { repoBlobUrl } from '../content/links.js'
import { LanguageMenu } from './LanguageMenu.js'

/** Site footer: repository links, npm package, license, language switcher. */
export function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <p className="footer-note">{t('footer.builtFrom')}</p>
        <div className="footer-links">
          <a
            href="https://github.com/Right202209/ccset"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('nav.github')}
          </a>
          <a
            href="https://www.npmjs.com/package/@droite/ccset"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('footer.npm')}
          </a>
          <a href={repoBlobUrl('LICENSE')} target="_blank" rel="noopener noreferrer">
            {t('footer.license')}
          </a>
          <LanguageMenu />
        </div>
      </div>
    </footer>
  )
}
