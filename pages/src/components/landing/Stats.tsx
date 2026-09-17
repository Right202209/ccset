import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/index.js'

interface Stat {
  key: 'agents' | 'languages' | 'backups' | 'mode'
  value: string
  count: boolean
}

/* Every figure is grounded in the README: five agents, two interface
   languages, ten kept backups per file, and the POSIX write mode. 0600 is
   an octal mode, not a quantity, so it renders verbatim. */
const STATS: readonly Stat[] = [
  { key: 'agents', value: '5', count: true },
  { key: 'languages', value: '2', count: true },
  { key: 'backups', value: '10', count: true },
  { key: 'mode', value: '0600', count: false },
]

const COUNT_MS = 1200

/** Stat band above the highlight cards; integers count up once on screen. */
export function Stats() {
  const { t } = useLanguage()
  const ref = useRef<HTMLDivElement | null>(null)
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
      { threshold: 0.3 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="stats-grid">
      {STATS.map((stat) => (
        <div key={stat.key} className="stat">
          <span className="stat-value">
            <StatValue value={stat.value} count={stat.count} active={visible} />
          </span>
          <span className="stat-label">{t(`stats.${stat.key}`)}</span>
        </div>
      ))}
    </div>
  )
}

/** Non-counting values (0600) render verbatim; integers ease to their target. */
function StatValue({ value, count, active }: { value: string; count: boolean; active: boolean }) {
  const counted = useCountUp(Number(value), active && count)
  if (!count) return <>{value}</>
  return <>{counted}</>
}

function useCountUp(target: number, active: boolean): number {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (!active || target === 0 || prefersReducedMotion()) {
      setCurrent(target)
      return undefined
    }
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now: number) {
      const progress = Math.min((now - start) / COUNT_MS, 1)
      setCurrent(Math.round(easeOutQuad(progress) * target))
      if (progress < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [active, target])
  return current
}

function easeOutQuad(progress: number): number {
  return 1 - (1 - progress) * (1 - progress)
}

/** Reduced-motion readers get the final figure at once instead of a count. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
