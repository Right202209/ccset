import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionResult } from '../types.js'
import { toCcsetError, type CcsetError } from '../core/errors.js'

/**
 * One screen on the navigation stack. `reload` is kept only for screens whose
 * producer is a read: going back to a provider list after a save must show the
 * file that was just written, not the listing from before it.
 */
export interface Frame {
  screen: ActionResult
  reload?: Task
}

export type Task = () => Promise<ActionResult>

export interface Screens {
  frames: Frame[]
  current: ActionResult | undefined
  busy: boolean
  /** Push the result of a navigation. */
  open: (task: Task) => void
  /** Replace the top frame, for results that supersede what produced them. */
  replace: (task: Task) => void
  back: () => void
}

/** Re-running these is a read; re-running anything else could repeat a write. */
function isReloadable(screen: ActionResult): boolean {
  return screen.kind === 'list' || screen.kind === 'status'
}

export function useScreens(onFatal: (error: CcsetError) => void): Screens {
  const [frames, setFrames] = useState<Frame[]>([])
  const [busy, setBusy] = useState(false)
  // Input handlers close over the render that created them, so the stack is
  // mirrored into a ref rather than read from that stale closure.
  const framesRef = useRef<Frame[]>(frames)
  useEffect(() => {
    framesRef.current = frames
  }, [frames])

  const settle = useCallback(
    async (task: Task, apply: (frame: Frame) => void): Promise<void> => {
      setBusy(true)
      try {
        const screen = await task()
        apply({ screen, reload: isReloadable(screen) ? task : undefined })
      } catch (err) {
        onFatal(toCcsetError(err))
      } finally {
        setBusy(false)
      }
    },
    [onFatal],
  )

  const open = useCallback(
    (task: Task): void => {
      void settle(task, (frame) => setFrames((prev) => [...prev, frame]))
    },
    [settle],
  )

  // A replacement never carries a reload: the task behind it may have written.
  const replace = useCallback(
    (task: Task): void => {
      void settle(task, (frame) =>
        setFrames((prev) => [...prev.slice(0, -1), { screen: frame.screen }]),
      )
    },
    [settle],
  )

  const back = useCallback((): void => {
    const next = framesRef.current.slice(0, -1)
    setFrames(next)
    const revealed = next[next.length - 1]
    if (revealed?.reload === undefined) return
    const task = revealed.reload
    void settle(task, (frame) => setFrames([...next.slice(0, -1), frame]))
  }, [settle])

  return { frames, current: frames[frames.length - 1], busy, open, replace, back }
}
