import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index.js'

/** Full-page fallback for routes the site does not have. */
export default function NotFound() {
  const { t } = useLanguage()
  return (
    <div className="notfound">
      <span className="notfound-code" aria-hidden="true">
        404
      </span>
      <h1 className="notfound-title">{t('notFound.title')}</h1>
      <p className="notfound-body">{t('notFound.body')}</p>
      <Link to="/" className="button button-primary">
        {t('notFound.home')}
      </Link>
    </div>
  )
}
