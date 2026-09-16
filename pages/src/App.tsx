import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary.js'
import { Footer } from './components/Footer.js'
import { Navbar } from './components/Navbar.js'
import { Landing } from './routes/Landing.js'

// The docs viewer pulls in the Markdown sources; keep it out of the landing chunk.
const Docs = lazy(() => import('./routes/Docs.js'))
const NotFound = lazy(() => import('./routes/NotFound.js'))

/** Scrolls to the top on ordinary navigation; fragment scrolling is MarkdownView's job. */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash === '') window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export function App() {
  return (
    <div className="site-shell">
      <ScrollToTop />
      <ErrorBoundary>
        <Navbar />
        <main className="site-main">
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/docs/:slug" element={<Docs />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </ErrorBoundary>
    </div>
  )
}
