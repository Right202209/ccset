import { useLanguage } from '../../i18n/index.js'
import { Stats } from './Stats.js'

const HIGHLIGHTS = [
  'agents',
  'cli',
  'i18n',
  'safety',
  'preserve',
] as const

/** Five-point strip answering "why ccset", all claims taken from the README. */
export function Highlights() {
  const { t } = useLanguage()
  return (
    <section className="landing-section" id="highlights">
      <div className="container">
        <h2 className="landing-heading">{t('highlights.title')}</h2>
        <Stats />
        <div className="highlight-grid">
          {HIGHLIGHTS.map((key) => (
            <article key={key} className="highlight-card">
              <h3>{t(`highlight.${key}.title`)}</h3>
              <p>{t(`highlight.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
