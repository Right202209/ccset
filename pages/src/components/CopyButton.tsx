import { useLanguage } from '../i18n/index.js'
import { useCopy } from '../hooks/useCopy.js'

interface Props {
  text: string
  className?: string
}

/** A standalone copy control (install commands, CLI lines). */
export function CopyButton({ text, className }: Props) {
  const { t } = useLanguage()
  const { copied, copy } = useCopy()
  return (
    <button
      type="button"
      className={className ?? 'copy-button'}
      title={copied ? t('copy.copied') : t('copy.copy')}
      aria-label={copied ? t('copy.copied') : t('copy.copy')}
      onClick={() => {
        void copy(text)
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H3.5A1.5 1.5 0 0 0 2 3v8.5A1.5 1.5 0 0 0 3.5 13H4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 8.5 6 12l7.5-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
