import { NavLink } from 'react-router-dom'
import { useLanguage } from '../i18n/index.js'
import { LanguageMenu } from './LanguageMenu.js'

/** Sticky site header: brand, docs link, GitHub link, language switcher. */
export function Navbar() {
  const { t } = useLanguage()
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <NavLink to="/" className="navbar-brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={26} height={26} />
          <span>ccset</span>
        </NavLink>
        <nav className="navbar-links" aria-label="Main">
          <NavLink to="/docs" className="navbar-link">
            {t('nav.docs')}
          </NavLink>
          <a
            className="navbar-link"
            href="https://github.com/Right202209/ccset"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('nav.github')}
          </a>
          <LanguageMenu />
        </nav>
      </div>
    </header>
  )
}
