import { useLanguage } from '../../i18n/index.js'

const RULES = ['preserve', 'atomic', 'confirm', 'mask', 'backups'] as const

/** The README's "File safety" promises, one card per rule. */
export function FileSafety() {
  const { t } = useLanguage()
  return (
    <section className="landing-section" id="file-safety">
      <div className="container">
        <h2 className="landing-heading">{t('fileSafety.title')}</h2>
        <ul className="safety-list">
          {RULES.map((key) => (
            <li key={key} className="safety-item">
              <ShieldIcon />
              <div>
                <h3>{t(`fileSafety.${key}.title`)}</h3>
                <p>{t(`fileSafety.${key}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2.5 16.5 5v4.5c0 4-2.8 6.9-6.5 8-3.7-1.1-6.5-4-6.5-8V5L10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="m7 10 2 2 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
