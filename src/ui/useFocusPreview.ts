import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { StatusLine } from '../types.js'

export interface FocusPreview {
  label: string
  lines: StatusLine[]
}

interface FocusPreviewValue {
  preview: FocusPreview | null
  setPreview: (preview: FocusPreview | null) => void
}

const FocusPreviewContext = createContext<FocusPreviewValue | null>(null)

export function FocusPreviewProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [preview, setPreview] = useState<FocusPreview | null>(null)
  const value = useMemo(() => ({ preview, setPreview }), [preview])
  return React.createElement(FocusPreviewContext.Provider, { value }, children)
}

export function useFocusPreview(): FocusPreview | null {
  return useContext(FocusPreviewContext)?.preview ?? null
}

export function usePublishFocusPreview(preview: FocusPreview | null): void {
  const setPreview = useContext(FocusPreviewContext)?.setPreview
  useEffect(() => {
    if (setPreview === undefined) return
    setPreview(preview)
    return () => setPreview(null)
  }, [setPreview, preview])
}
