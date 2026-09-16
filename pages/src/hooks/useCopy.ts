import { useCallback, useEffect, useRef, useState } from 'react'

export interface CopyResult {
  copied: boolean
  copy: (text: string) => Promise<boolean>
}

/** Clipboard write with a textarea fallback and a resettable "copied" flag. */
export function useCopy(resetMs = 1600): CopyResult {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const ok = await writeClipboard(text)
      setCopied(ok)
      if (timer.current !== null) clearTimeout(timer.current)
      if (ok) {
        timer.current = setTimeout(() => setCopied(false), resetMs)
      }
      return ok
    },
    [resetMs],
  )

  return { copied, copy }
}

async function writeClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* fall through to the legacy path */
    }
  }
  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  return ok
}
