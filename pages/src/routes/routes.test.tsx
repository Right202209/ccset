import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageProvider, useLanguage } from '../i18n/index.js'
import { Navbar } from '../components/Navbar.js'
import NotFound from './NotFound.js'

const originalLanguages = Object.getOwnPropertyDescriptor(Navigator.prototype, 'languages')

function Probe(): React.ReactElement {
  const { locale } = useLanguage()
  return <span data-testid="probe">{locale}</span>
}

function setBrowserLanguages(tags: string[]): void {
  Object.defineProperty(navigator, 'languages', { configurable: true, value: tags })
}

afterEach(() => {
  if (originalLanguages !== undefined) {
    Object.defineProperty(Navigator.prototype, 'languages', originalLanguages)
  }
})

function renderWith(ui: React.ReactNode = <Probe />): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <LanguageProvider>{ui}</LanguageProvider>
    </MemoryRouter>,
  )
}

describe('language selection', () => {
  it('follows the browser hint on first visit (zh* reads as zh-Hans)', () => {
    setBrowserLanguages(['zh-CN', 'en'])
    renderWith()
    expect(screen.getByTestId('probe').textContent).toBe('zh-Hans')
    expect(document.documentElement.lang).toBe('zh-Hans')
  })

  it('falls back to English without a zh hint', () => {
    setBrowserLanguages(['fr'])
    renderWith()
    expect(screen.getByTestId('probe').textContent).toBe('en')
  })

  it('prefers a saved explicit choice over the browser hint', () => {
    setBrowserLanguages(['zh-CN'])
    localStorage.setItem('ccset-lang', 'en')
    renderWith()
    expect(screen.getByTestId('probe').textContent).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('an explicit switch is saved and applied', async () => {
    const user = userEvent.setup()
    setBrowserLanguages(['en'])
    renderWith(<><Probe /><Navbar /></>)
    await user.click(screen.getByRole('button', { name: 'Language' }))
    await user.click(screen.getByRole('option', { name: '简体中文' }))
    expect(screen.getByTestId('probe').textContent).toBe('zh-Hans')
    expect(localStorage.getItem('ccset-lang')).toBe('zh-Hans')
    expect(document.documentElement.lang).toBe('zh-Hans')
  })
})

describe('NotFound', () => {
  it('shows the message and the home button', () => {
    renderWith(<NotFound />)
    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the homepage' })).toBeInTheDocument()
  })
})
