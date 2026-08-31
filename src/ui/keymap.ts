import { hasKey, t } from '../i18n/index.js'
export type ScreenKind = 'list' | 'form' | 'status' | 'message' | 'confirm'
export interface Binding { keys: readonly string[]; labelKey: string }
export const KEYMAPS: Record<ScreenKind, readonly Binding[]> = {
  list: [{keys:['up','k'],labelKey:'key.moveUp'},{keys:['down','j'],labelKey:'key.moveDown'},{keys:['1-9'],labelKey:'key.jump'},{keys:['enter'],labelKey:'key.select'},{keys:['esc'],labelKey:'key.back'}],
  form: [{keys:['up','k'],labelKey:'key.moveUp'},{keys:['down','j','tab'],labelKey:'key.moveDown'},{keys:['left','right','space'],labelKey:'key.change'},{keys:['enter'],labelKey:'key.next'},{keys:['esc'],labelKey:'key.cancel'}],
  status: [{keys:['up','k'],labelKey:'key.moveUp'},{keys:['down','j'],labelKey:'key.moveDown'},{keys:['enter'],labelKey:'key.select'},{keys:['esc'],labelKey:'key.back'}],
  message: [{keys:['enter'],labelKey:'key.continue'},{keys:['esc'],labelKey:'key.back'}],
  confirm: [{keys:['up','k','down','j'],labelKey:'key.choose'},{keys:['enter'],labelKey:'key.confirm'},{keys:['esc'],labelKey:'key.cancel'}],
}
for (const bindings of Object.values(KEYMAPS)) { const keys = bindings.flatMap((b) => b.keys); if (new Set(keys).size !== keys.length || bindings.some((b) => !hasKey(b.labelKey))) throw new Error('Invalid keymap') }
export function helpFor(kind: ScreenKind): string { return KEYMAPS[kind].map((b) => `${b.keys.join('/')} ${t(b.labelKey)}`).join(' · ') }

export function pressed(input: string, key: { upArrow?: boolean; downArrow?: boolean; leftArrow?: boolean; rightArrow?: boolean; return?: boolean; escape?: boolean }): string[] {
  const result = input ? [input] : []
  if (key.upArrow) result.push('up')
  if (key.downArrow) result.push('down')
  if (key.leftArrow) result.push('left')
  if (key.rightArrow) result.push('right')
  if (key.return) result.push('enter')
  if (key.escape) result.push('esc')
  return result
}
