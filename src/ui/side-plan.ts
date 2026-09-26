export interface SidePanelInput {
  id: string
  lines: number
}

export interface PlannedSidePanel {
  id: string
  lines: number
  more: number
}

const DROP_ORDER = ['result', 'agent', 'config', 'preview', 'warnings']
const PANEL_CHROME = 2

export function planSide(budget: number, panels: SidePanelInput[]): PlannedSidePanel[] {
  const kept = new Map(panels.map((panel) => [panel.id, { ...panel }]))
  for (const id of DROP_ORDER) {
    if (heightOf(kept) <= budget) break
    const panel = kept.get(id)
    if (panel === undefined) continue
    if (id === 'warnings') trimWarnings(panel, budget, kept)
    else kept.delete(id)
  }
  return panels.flatMap((panel) => {
    const planned = kept.get(panel.id)
    if (planned === undefined || planned.lines <= 0) return []
    const more = panel.id === 'warnings' && planned.lines < panel.lines
      ? panel.lines - Math.max(0, planned.lines - 1)
      : 0
    return [{ id: panel.id, lines: planned.lines, more }]
  })
}

function heightOf(panels: Map<string, SidePanelInput>): number {
  let total = 0
  for (const panel of panels.values()) total += PANEL_CHROME + panel.lines
  return total
}

function trimWarnings(
  panel: SidePanelInput,
  budget: number,
  panels: Map<string, SidePanelInput>,
): void {
  const others = heightOf(panels) - PANEL_CHROME - panel.lines
  const room = budget - others - PANEL_CHROME
  if (room < 1) panels.delete(panel.id)
  else panel.lines = Math.min(panel.lines, room)
}
