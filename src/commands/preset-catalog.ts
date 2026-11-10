import openrouter from '../../presets/openrouter.json'
import deepseek from '../../presets/deepseek.json'

export interface PresetTarget {
  protocol: string
  options: Record<string, string | string[]>
  useOptions?: Record<string, string | string[]>
}

export interface Preset {
  id: string
  name: string
  sources: string[]
  agents: Record<string, PresetTarget>
}

/** Static imports keep the offline catalog in the published CLI bundle. */
export const PRESETS: Preset[] = [openrouter, deepseek]
