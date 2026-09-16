import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CopyButton } from '../CopyButton.js'
import { useLanguage } from '../../i18n/index.js'
import { TerminalDemo } from './TerminalDemo.js'

const AGENT_BADGES = ['claude-code', 'opencode', 'codex', 'pi', 'grok-build'] as const

const INSTALL_COMMAND = 'npx @droite/ccset'

/** Above the fold: name, tagline, install command, actions, terminal replay. */
export function Hero() {
  const { t } = useLanguage()
  useEffect(() => {
    document.title = 'ccset'
  }, [])
  return (
    <section className="hero">
      <div className="container hero-inner">
        <div className="hero-copy">
          <h1 className="hero-title">ccset</h1>
          <p className="hero-tagline">{t('hero.tagline')}</p>
          <ul className="hero-badges" aria-label="Agents">
            {AGENT_BADGES.map((agent) => (
              <li key={agent} className="hero-badge">
                {agent}
              </li>
            ))}
          </ul>
          <div className="hero-install">
            <code>{INSTALL_COMMAND}</code>
            <CopyButton text={INSTALL_COMMAND} />
          </div>
          <div className="hero-actions">
            <a className="button button-primary" href="#quick-start">
              {t('hero.quickStart')}
            </a>
            <Link className="button button-secondary" to="/docs">
              {t('hero.docs')}
            </Link>
          </div>
        </div>
        <TerminalDemo />
      </div>
    </section>
  )
}
