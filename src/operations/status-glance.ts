import type { KeyedLine } from './types.js'

export interface StatusGlanceFacts {
  path: string
  mode?: string
  unmanagedKeys: number
  providers: string[]
  warningCount: number
  errorCount: number
}

export function statusGlanceActions(facts: StatusGlanceFacts): Record<string, KeyedLine[]> {
  const names = facts.providers.slice(0, 3)
  return {
    global: [
      { labelKey: 'status.path', value: facts.path },
      { labelKey: 'status.mode', value: facts.mode, valueKey: facts.mode === undefined ? 'status.unset' : undefined },
      { labelKey: 'glance.unmanaged', value: String(facts.unmanagedKeys) },
    ],
    providers: [
      { labelKey: 'glance.providers', value: String(facts.providers.length) },
      {
        labelKey: 'glance.providerNames',
        value: names.join(', '),
        valueKey: names.length === 0 ? 'status.unset' : undefined,
      },
    ],
    status: [
      { labelKey: 'glance.issues', value: String(facts.warningCount + facts.errorCount) },
      { labelKey: 'glance.warnings', value: String(facts.warningCount) },
      { labelKey: 'glance.errors', value: String(facts.errorCount) },
    ],
  }
}
