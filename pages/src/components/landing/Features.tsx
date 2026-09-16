import { useLanguage } from '../../i18n/index.js'

const FEATURES = ['tui', 'commands', 'patch', 'switch', 'secrets', 'activate'] as const

/** Capability cards; each bullet is grounded in the README or the user guide. */
export function Features() {
  const { t } = useLanguage()
  return (
    <section className="landing-section" id="features">
      <div className="container">
        <h2 className="landing-heading">{t('features.title')}</h2>
        <div className="feature-grid">
          {FEATURES.map((key) => (
            <article key={key} className="feature-card">
              <h3>{t(`feature.${key}.title`)}</h3>
              <p>{t(`feature.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
