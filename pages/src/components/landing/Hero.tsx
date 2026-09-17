import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CopyButton } from '../CopyButton.js'
import { useLanguage } from '../../i18n/index.js'
import { TerminalDemo } from './TerminalDemo.js'

const AGENT_BADGES = ['claude-code', 'opencode', 'codex', 'pi', 'grok-build'] as const

const INSTALL_COMMAND = 'npx @droite/ccset'

/** Requirements line under the actions; every item is a README claim. */
const META_KEYS = ['hero.meta.node', 'hero.meta.platforms', 'hero.meta.languages'] as const

/** Above the fold: name, headline, tagline, install command, actions, terminal replay. */
export function Hero() {
  const { t } = useLanguage()
  useEffect(() => {
    document.title = 'ccset'
  }, [])
  return (
    <section className="hero">
      <div className="container hero-inner">
        <div className="hero-copy">
          <span className="hero-eyebrow">{t('hero.eyebrow')}</span>
          <h1 className="hero-title">ccset</h1>
          <p className="hero-headline">
            {t('hero.headline')}
            <em>{t('hero.headlineAccent')}</em>
          </p>
          <p className="hero-tagline">{t('hero.tagline')}</p>
          <ul className="hero-badges" aria-label="Agents">
            {AGENT_BADGES.map((agent) => (
              <li key={agent} className="hero-badge">
                {agent}
              </li>
            ))}
          </ul>
          <InstallCommand />
          <div className="hero-actions">
            <a className="button button-primary" href="#quick-start">
              {t('hero.quickStart')}
              <span className="button-arrow" aria-hidden="true">
                →
              </span>
            </a>
            <Link className="button button-secondary" to="/docs">
              {t('hero.docs')}
            </Link>
          </div>
          <ul className="hero-meta">
            {META_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
        <div className="hero-visual">
          <TerminalDemo />
        </div>
      </div>
    </section>
  )
}

function InstallCommand() {
  return (
    <div className="hero-install">
      <span className="hero-install-prompt" aria-hidden="true">
        $
      </span>
      <code>{INSTALL_COMMAND}</code>
      <CopyButton text={INSTALL_COMMAND} />
    </div>
  )
}
