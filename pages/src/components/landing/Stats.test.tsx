import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../../i18n/index.js'
import { Stats } from './Stats.js'

function renderStats(): void {
  render(
    <LanguageProvider>
      <Stats />
    </LanguageProvider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Stats', () => {
  it('counts the integer figures up to their final values', async () => {
    vi.useFakeTimers()
    renderStats()
    expect(screen.getByText('Supported agents')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(2000)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders the non-numeric write mode verbatim', () => {
    vi.useFakeTimers()
    renderStats()
    expect(screen.getByText('0600')).toBeInTheDocument()
    expect(screen.getByText('POSIX write mode')).toBeInTheDocument()
  })
})
