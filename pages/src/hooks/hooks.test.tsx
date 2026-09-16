import { render, screen } from '@testing-library/react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App.js'
import { LanguageProvider } from '../i18n/index.js'
import { useResponsive } from './useResponsive.js'

const originalMatchMedia = window.matchMedia

function stubMatchMedia(matches: boolean): { set: (value: boolean) => void } {
  const listeners = new Set<() => void>()
  const media = {
    matches,
    addEventListener: (_: string, listener: () => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_: string, listener: () => void) => {
      listeners.delete(listener)
    },
  }
  window.matchMedia = vi.fn().mockReturnValue(media) as unknown as typeof window.matchMedia
  return {
    set: (value: boolean) => {
      media.matches = value
      act(() => {
        for (const listener of listeners) listener()
      })
    },
  }
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('useResponsive', () => {
  it('reads matchMedia and follows changes', () => {
    const control = stubMatchMedia(false)
    const { result } = renderHook(() => useResponsive())
    expect(result.current).toBe(false)
    control.set(true)
    expect(result.current).toBe(true)
  })

  it('reports the default (wide) without a matchMedia implementation', () => {
    delete (window as { matchMedia?: unknown }).matchMedia
    const { result } = renderHook(() => useResponsive())
    expect(result.current).toBe(false)
  })
})

describe('docs route', () => {
  it('renders the unknown-document note for an unregistered slug', async () => {
    render(
      <MemoryRouter initialEntries={['/docs/not-a-doc']}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('heading', { name: 'There is no document at this route.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All documents' })).toBeInTheDocument()
  })

  it('keeps the docs toggle hidden on desktop widths', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as typeof window.matchMedia
    render(
      <MemoryRouter initialEntries={['/docs']}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { level: 1, name: 'ccset' })
    expect(screen.queryByRole('button', { name: 'Documents' })).not.toBeInTheDocument()
  })
})
