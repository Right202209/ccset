import { useLanguage } from '../../i18n/index.js'
import { SectionHeading } from './SectionHeading.js'

const HIGHLIGHTS = [
  'agents',
  'cli',
  'i18n',
  'safety',
  'preserve',
] as const

/** Five reasons to use ccset, all claims taken from the README. */
export function Highlights() {
  const { t } = useLanguage()
  return (
    <section className="landing-section" id="highlights">
      <div className="container">
        <SectionHeading title={t('highlights.title')} />
        <div className="highlight-grid stagger">
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
