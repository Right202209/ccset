import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCopy } from './useCopy.js'

const originalClipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard')
const originalExecCommand = document.execCommand

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value })
}

afterEach(() => {
  vi.useRealTimers()
  delete (navigator as { clipboard?: unknown }).clipboard
  if (originalClipboard !== undefined) {
    Object.defineProperty(Navigator.prototype, 'clipboard', originalClipboard)
  }
  document.execCommand = originalExecCommand
})

describe('useCopy', () => {
  it('writes through the async clipboard API and resets the flag', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    const { result } = renderHook(() => useCopy())
    await act(async () => {
      expect(await result.current.copy('x')).toBe(true)
    })
    expect(result.current.copied).toBe(true)
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    expect(result.current.copied).toBe(false)
  })

  it('falls back to execCommand when the clipboard API is missing', async () => {
    const { result } = renderHook(() => useCopy())
    setClipboard(undefined)
    document.execCommand = vi.fn().mockReturnValue(true)
    await act(async () => {
      expect(await result.current.copy('y')).toBe(true)
    })
    expect(result.current.copied).toBe(true)
  })

  it('reports failure without setting the flag', async () => {
    const { result } = renderHook(() => useCopy())
    setClipboard(undefined)
    document.execCommand = vi.fn().mockReturnValue(false)
    await act(async () => {
      expect(await result.current.copy('z')).toBe(false)
    })
    expect(result.current.copied).toBe(false)
  })
})
