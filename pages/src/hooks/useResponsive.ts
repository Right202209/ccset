import { useEffect, useState } from 'react'

/** Re-renders on the viewport crossing the given max-width, SSR/jsdom safe. */
export function useResponsive(maxWidth = 768): boolean {
  const query = `(max-width: ${maxWidth}px)`
  const read = (): boolean =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  const [narrow, setNarrow] = useState<boolean>(read)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const onChange = (): void => setNarrow(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return narrow
}
