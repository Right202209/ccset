import { useEffect, useState } from 'react'
import type { Heading } from '../markdown/headings.js'

/**
 * Tracks the heading currently in view for the docs TOC. An
 * IntersectionObserver watches the rendered h2/h3 elements; the last one to
 * cross the upper third of the viewport wins, falling back to the first.
 */
export function useActiveHeading(
  headings: Heading[],
  container: { current: HTMLElement | null },
): string {
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    const root = container.current
    if (root === null || headings.length === 0 || typeof IntersectionObserver === 'undefined') {
      return undefined
    }
    const targets = headings
      .map((heading) => root.querySelector(`#${cssEscape(heading.id)}`))
      .filter((element): element is Element => element !== null)
    if (targets.length === 0) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        const last = visible.at(-1)
        if (last !== undefined) setActiveId(last.target.id)
      },
      { rootMargin: '-10% 0px -70% 0px' },
    )
    for (const target of targets) observer.observe(target)
    return () => observer.disconnect()
  }, [headings, container])

  return activeId
}

function cssEscape(value: string): string {
  return value.replace(/([^a-zA-Z0-9_\u00A0-\uFFFF-])/g, '\\$1')
}
