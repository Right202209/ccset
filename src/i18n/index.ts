import { en } from './en.js'

export type Catalog = Record<string, string>
export type Params = Record<string, string | number>

// English only in v1 (PRD 5.5). A second catalog is additive: add the file,
// add it here. No locale detection.
const catalog: Catalog = en

/**
 * Missing keys render as the key itself rather than throwing -- a UI that
 * crashes on a typo in a label is worse than one showing `field.model`.
 */
export function t(key: string, params?: Params): string {
  const template = catalog[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export function hasKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(catalog, key)
}
