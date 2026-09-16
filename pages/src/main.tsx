import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App.js'
import { LanguageProvider } from './i18n/index.js'
import './styles/tokens.css'
import './styles/index.css'
import './styles/landing.css'
import './styles/docs.css'
import './styles/markdown.css'

const container = document.getElementById('root')
if (container === null) throw new Error('main: #root is missing from index.html')

// BASE_URL is the site base, e.g. "/ccset/" on GitHub Pages or "/ccset/" in dev.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '')

createRoot(container).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
