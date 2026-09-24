import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../i18n/index.js'
import { MarkdownView } from './MarkdownView.js'

const DOC = [
  '# Title',
  '',
  'See the [guide](user-guide.md#cli) and the [site](https://example.com).',
  '',
  '## Section one',
  '',
  'Jump to [section two](#section-two).',
  '',
  '```bash',
  'npx @droite/ccset',
  '```',
  '',
  '## Section two',
  '',
  'Body.',
  '',
  '| Menu | Touches |',
  '| --- | --- |',
  '| Status | Nothing |',
  '',
].join('\n')

function renderDoc(): void {
  render(
    <MemoryRouter initialEntries={['/docs/x']}>
      <LanguageProvider>
        <MarkdownView markdown={DOC} sourceDir="docs" />
      </LanguageProvider>
    </MemoryRouter>,
  )
}

function renderMarkdownRouter(): void {
  const router = createMemoryRouter(
    [
      {
        path: '/docs/:slug?',
        element: (
          <LanguageProvider>
            <MarkdownView markdown={DOC} sourceDir="docs" />
          </LanguageProvider>
        ),
      },
      { path: '/docs/user-guide', element: <div>user guide route</div> },
    ],
    { initialEntries: ['/docs/x'] },
  )
  render(<RouterProvider router={router} />)
}

function RoutePath() {
  const { pathname } = useLocation()
  return <output data-testid="route">{pathname}</output>
}

describe('MarkdownView rendering', () => {
  it('renders sanitized HTML with heading ids and copy buttons', () => {
    renderDoc()
    expect(screen.getByRole('heading', { name: 'Section one' })).toHaveAttribute('id', 'section-one')
    const copy = document.querySelector('pre button.code-copy')
    expect(copy?.textContent).toBe('Copy')
  })

  it('labels fences with their language and wraps tables for scrolling', () => {
    renderDoc()
    expect(document.querySelector('pre')?.dataset.lang).toBe('bash')
    const table = screen.getByRole('table')
    expect(table.parentElement).toHaveClass('table-scroll')
    expect(table.parentElement?.parentElement).toHaveClass('markdown')
  })
})

describe('MarkdownView copy interaction', () => {
  it('copies a code block without the button label via the delegated click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderDoc()
    fireEvent.click(document.querySelector('pre button.code-copy') as HTMLElement)
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('npx @droite/ccset')
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Copied')
    delete (navigator as { clipboard?: unknown }).clipboard
  })
})

describe('MarkdownView routing', () => {
  it('routes internal links through the router instead of a reload', async () => {
    renderMarkdownRouter()
    const user = userEvent.setup()
    await user.click(screen.getByText('guide'))
    expect(await screen.findByText('user guide route')).toBeInTheDocument()
  })

  it('keeps unregistered repository links out of React Router navigation', () => {
    const markdown = '[guide](user-guide.md) [external](//attacker.example/path)'
    const router = createMemoryRouter(
      [
        {
          path: '/docs/:slug?',
          element: (
            <>
              <RoutePath />
              <LanguageProvider>
                <MarkdownView markdown={markdown} sourceDir="docs" />
              </LanguageProvider>
            </>
          ),
        },
      ],
      { initialEntries: ['/docs/x'] },
    )
    render(<RouterProvider router={router} />)
    expect(screen.getByText('guide').closest('a')).toHaveAttribute('href', '/docs/user-guide')
    const external = screen.getByText('external').closest('a') as HTMLAnchorElement
    expect(external).toHaveAttribute(
      'href',
      'https://github.com/Right202209/ccset/blob/master/attacker.example/path',
    )
    external.addEventListener('click', (event) => event.preventDefault(), { once: true })
    fireEvent.click(external)
    expect(screen.getByTestId('route')).toHaveTextContent('/docs/x')
  })
})

describe('MarkdownView browser interactions', () => {
  it('leaves ctrl/cmd/shift-clicks to the browser so new-tab works', async () => {
    renderDoc()
    const link = screen.getByText('guide').closest('a') as HTMLAnchorElement
    const fired = fireEvent.click(link, { button: 0, ctrlKey: true })
    expect(fired).toBe(true)
    expect(link.getAttribute('href')).toContain('user-guide')
  })

  it('scrolls same-page fragment links and external links keep rel', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderDoc()
    await userEvent.setup().click(screen.getByText('section two').closest('a') as Element)
    expect(scrollIntoView).toHaveBeenCalled()
    expect(screen.getByText('site')).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

describe('MarkdownView fragment navigation', () => {
  it('tolerates a digit-leading fragment that a raw id selector would reject', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(
      <MemoryRouter initialEntries={['/docs/x#1-intro']}>
        <LanguageProvider>
          <MarkdownView markdown={'## 1. Intro\n\nBody.\n'} sourceDir="" />
        </LanguageProvider>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled()
    })
  })
})
