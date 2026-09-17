import type { ReactElement } from 'react'
import { useLanguage } from '../../i18n/index.js'
import { SectionHeading } from './SectionHeading.js'

const FEATURES = ['tui', 'commands', 'patch', 'switch', 'secrets', 'activate'] as const

type FeatureKey = (typeof FEATURES)[number]

/** Capability cards; each bullet is grounded in the README or the user guide. */
export function Features() {
  const { t } = useLanguage()
  return (
    <section className="landing-section" id="features">
      <div className="container">
        <SectionHeading title={t('features.title')} />
        <div className="feature-grid stagger">
          {FEATURES.map((key) => (
            <article key={key} className="feature-card">
              <span className="feature-icon" aria-hidden="true">
                {FEATURE_ICONS[key]}
              </span>
              <h3>{t(`feature.${key}.title`)}</h3>
              <p>{t(`feature.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* Inline stroke icons (no external assets), one per capability card. */
const FEATURE_ICONS: Record<FeatureKey, ReactElement> = {
  tui: (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3" />
      <path d="M13 15h4" />
    </Icon>
  ),
  commands: (
    <Icon>
      <path d="M5 6h14" />
      <path d="M5 12h9" />
      <path d="M5 18h14" />
      <path d="m17 10 2 2-2 2" />
    </Icon>
  ),
  patch: (
    <Icon>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m13.5 6.5 3 3" />
    </Icon>
  ),
  switch: (
    <Icon>
      <path d="M4 7h12l-3-3" />
      <path d="M20 17H8l3 3" />
      <path d="M20 7v3" />
      <path d="M4 17v-3" />
    </Icon>
  ),
  secrets: (
    <Icon>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8" />
      <path d="m16 7 2.5 2.5" />
      <path d="m18.5 4.5 2 2" />
    </Icon>
  ),
  activate: (
    <Icon>
      <path d="M6 4.5v15l13-7.5-13-7.5Z" />
    </Icon>
  ),
}

function Icon({ children }: { children: ReactElement | ReactElement[] }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}
