import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Reveals its children with a fade-up when scrolled into view. Static HTML
 * (no JS or reduced motion) shows everything by default via CSS.
 */
export function FadeInSection({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (node === null || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className={`fade-section${visible ? ' is-visible' : ''}`}>
      {children}
    </section>
  )
}
