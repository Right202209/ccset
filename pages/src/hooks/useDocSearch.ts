import { useMemo, useState } from 'react'
import type { SearchHit } from '../content/search.js'
import { searchDocs } from '../content/search.js'
import { useLanguage } from '../i18n/index.js'

/** Sidebar search state: the query plus the hits for the active language. */
export function useDocSearch(): {
  query: string
  setQuery: (value: string) => void
  hits: SearchHit[]
} {
  const { locale } = useLanguage()
  const [query, setQuery] = useState('')
  const hits = useMemo<SearchHit[]>(() => searchDocs(query, locale), [query, locale])
  return { query, setQuery, hits }
}
