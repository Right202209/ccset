import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useActiveHeading } from './useActiveHeading.js'
import type { Heading } from '../markdown/headings.js'

const HEADINGS: Heading[] = [
  { depth: 2, text: 'One', id: 'one' },
  { depth: 3, text: 'Two', id: 'two' },
]

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observed: Element[] = []

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    FakeIntersectionObserver.instances.push(this)
  }

  observe(target: Element): void {
    this.observed.push(target)
  }

  unobserve(): void {}

  disconnect(): void {}

  see(ids: string[]): void {
    this.callback(
      ids.map((id) => ({ isIntersecting: true, target: { id } })) as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    )
  }
}

const original = globalThis.IntersectionObserver

afterEach(() => {
  globalThis.IntersectionObserver = original
})

describe('useActiveHeading', () => {
  it('stays idle without an IntersectionObserver implementation', () => {
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
    const container = { current: document.createElement('div') }
    const { result } = renderHook(() => useActiveHeading(HEADINGS, container))
    expect(result.current).toBe('')
  })

  it('tracks the last heading reported visible by the observer', () => {
    const root = document.createElement('div')
    root.innerHTML = '<h2 id="one">One</h2><h3 id="two">Two</h3>'
    document.body.appendChild(root)
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver
    const container = { current: root }
    const { result } = renderHook(() => useActiveHeading(HEADINGS, container))
    expect(FakeIntersectionObserver.instances.at(-1)?.observed).toHaveLength(2)
    act(() => {
      FakeIntersectionObserver.instances.at(-1)?.see(['one'])
    })
    expect(result.current).toBe('one')
    act(() => {
      FakeIntersectionObserver.instances.at(-1)?.see(['one', 'two'])
    })
    expect(result.current).toBe('two')
    root.remove()
  })

  it('ignores headings missing from the container', () => {
    const root = document.createElement('div')
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver
    const { result } = renderHook(() => useActiveHeading(HEADINGS, { current: root }))
    expect(result.current).toBe('')
  })

  it('is idle with no headings at all', () => {
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver
    const { result } = renderHook(() => useActiveHeading([], { current: document.createElement('div') }))
    expect(result.current).toBe('')
  })
})

vi.restoreAllMocks()
