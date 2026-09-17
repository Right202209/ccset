import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from './App.js'
import { LanguageProvider } from './i18n/index.js'

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('shows the landing headings and the install command', async () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'ccset' })).toBeInTheDocument()
    expect(screen.getByText('Activation stays yours.')).toBeInTheDocument()
    expect(screen.getAllByText('npx @droite/ccset').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Quick start' })).toBeInTheDocument()
  })

  it('serves the overview at /docs', async () => {
    renderAt('/docs')
    expect(await screen.findByRole('heading', { level: 1, name: 'ccset' })).toBeInTheDocument()
    expect(screen.getAllByText('Getting started').length).toBeGreaterThan(0)
    const sidebar = within(screen.getByRole('navigation', { name: 'Documents' }))
    expect(sidebar.getByRole('link', { name: 'User guide' })).toBeInTheDocument()
  })

  it('serves the user guide by slug', async () => {
    renderAt('/docs/user-guide')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'ccset user guide' }),
    ).toBeInTheDocument()
  })

  it('navigates client-side from the landing docs button', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('link', { name: 'Documentation' }))
    expect((await screen.findAllByText('Getting started')).length).toBeGreaterThan(0)
  })

  it('shows Not found with a working home button for unknown routes', async () => {
    const user = userEvent.setup()
    renderAt('/no/such/route')
    expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Back to the homepage' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'ccset' })).toBeInTheDocument()
    })
  })
})

describe('landing chrome', () => {
  it('numbers the landing sections outside their headings', () => {
    renderAt('/')
    expect(document.querySelectorAll('.section-index[aria-hidden="true"]').length).toBe(5)
    expect(screen.getByRole('heading', { name: 'Supported agents' })).toBeInTheDocument()
    expect(document.querySelector('td[data-label="--agent ID"]')?.textContent).toBe('claude-code')
  })

  it('links the footer to registered docs and the project pages', () => {
    renderAt('/')
    const footer = within(screen.getByRole('contentinfo'))
    expect(footer.getByRole('link', { name: 'User guide' })).toHaveAttribute('href', '/docs/user-guide')
    expect(footer.getByRole('link', { name: 'Security' })).toHaveAttribute('href', '/docs/security')
    expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/Right202209/ccset')
    expect(footer.getByRole('link', { name: 'MIT License' })).toHaveAttribute(
      'href',
      'https://github.com/Right202209/ccset/blob/master/LICENSE',
    )
  })
})
