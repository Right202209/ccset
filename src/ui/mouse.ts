import type { DOMElement } from 'ink'

export interface MouseEvent {
  button: number
  x: number
  y: number
  action: 'press' | 'release'
}

const SGR_MOUSE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g
const MAX_PENDING_LENGTH = 48
const ESCAPE_DELAY_MS = 120
const ENABLE_MOUSE = '\x1b[?1000h\x1b[?1006h'
const DISABLE_MOUSE = '\x1b[?1006l\x1b[?1000l'

function pendingSuffix(input: string): string {
  const start = input.lastIndexOf('\x1b')
  if (start < 0) return ''
  const suffix = input.slice(start)
  if (suffix === '\x1b' || suffix === '\x1b[') return suffix
  if (suffix.length <= MAX_PENDING_LENGTH && /^\x1b\[<[\d;]*$/.test(suffix)) return suffix
  return ''
}

export class SgrMouseParser {
  private pending = ''

  push(chunk: string): MouseEvent[] {
    const input = this.pending + chunk
    const matches = [...input.matchAll(SGR_MOUSE)]
    const events = matches.flatMap((match) => {
      const button = Number(match[1])
      const x = Number(match[2])
      const y = Number(match[3])
      if (!Number.isSafeInteger(button) || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return []
      if (button < 0 || x < 1 || y < 1) return []
      return [{ button, x, y, action: match[4] === 'M' ? 'press' as const : 'release' as const }]
    })
    this.pending = pendingSuffix(input.replace(SGR_MOUSE, ''))
    return events
  }

  hasPending(): boolean {
    return this.pending.length > 0
  }

  reset(): void {
    this.pending = ''
  }
}

export class MouseDecoder {
  private readonly parser = new SgrMouseParser()
  private readonly deferredEscapes: Array<() => void> = []
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly onMouse: (event: MouseEvent) => void) {}

  push(input: string): void {
    const hadPending = this.parser.hasPending()
    const events = this.parser.push(input)
    if (events.length > 0) this.clearEscapes()
    else if (this.parser.hasPending()) this.armTimer()
    else if (hadPending) this.runEscapes()
    for (const event of events) this.onMouse(event)
  }

  deferEscape(action: () => void): void {
    if (!this.parser.hasPending()) {
      action()
      return
    }
    this.deferredEscapes.push(action)
    this.armTimer()
  }

  dispose(): void {
    this.parser.reset()
    this.clearEscapes()
  }

  private armTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.parser.reset()
      this.runEscapes()
    }, ESCAPE_DELAY_MS)
  }

  private runEscapes(): void {
    const actions = this.deferredEscapes.splice(0)
    this.clearTimer()
    for (const action of actions) action()
  }

  private clearEscapes(): void {
    this.deferredEscapes.length = 0
    this.clearTimer()
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }
}

let activeDecoder: MouseDecoder | undefined

export function setActiveMouseDecoder(decoder: MouseDecoder | undefined): void {
  activeDecoder = decoder
}

export function handleEscape(action: () => void): void {
  if (activeDecoder === undefined) action()
  else activeDecoder.deferEscape(action)
}

export function rowAtPoint(rows: Map<number, DOMElement>, x: number, y: number): number | null {
  for (const [index, row] of rows) {
    const bounds = rowBounds(row)
    if (bounds === null) continue
    if (x - 1 >= bounds.left && x - 1 < bounds.left + bounds.width
      && y - 1 >= bounds.top && y - 1 < bounds.top + bounds.height) return index
  }
  return null
}

function rowBounds(element: DOMElement): { left: number; top: number; width: number; height: number } | null {
  const node = element.yogaNode
  if (node === undefined) return null
  let left = 0
  let top = 0
  let parent: DOMElement | undefined = element
  while (parent !== undefined) {
    const yogaNode = parent.yogaNode
    if (yogaNode !== undefined) {
      left += yogaNode.getComputedLeft()
      top += yogaNode.getComputedTop()
    }
    parent = parent.parentNode
  }
  return {
    left,
    top,
    width: node.getComputedWidth(),
    height: node.getComputedHeight(),
  }
}

export const mouseReport = { enable: ENABLE_MOUSE, disable: DISABLE_MOUSE }
