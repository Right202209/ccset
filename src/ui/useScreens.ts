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
  busyLabel: string | undefined
  /** Push the result of a navigation. */
  open: (task: Task, label?: string) => void
  /** Supersede the top frame with what the task returns. */
  replace: (task: Task, label?: string) => void
  /** Swap the top screen without running anything. */
  setTop: (screen: ActionResult) => void
  back: () => void
}

/** Re-running these is a read; re-running anything else could repeat a write. */
function isReloadable(screen: ActionResult): boolean {
  return screen.kind === 'list' || screen.kind === 'status'
}

function toFrame(screen: ActionResult, task: Task): Frame {
  return { screen, reload: isReloadable(screen) ? task : undefined }
}

export function useScreens(onFatal: (error: CcsetError) => void): Screens {
  const [frames, setFrames] = useState<Frame[]>([])
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState<string>()
  // Input handlers close over the render that created them, so the stack is
  // mirrored into a ref rather than read from that stale closure.
  const framesRef = useRef<Frame[]>(frames)
  useEffect(() => {
    framesRef.current = frames
  }, [frames])

  const run = useCallback(
    async (task: Task, label?: string): Promise<ActionResult | null> => {
      setBusyLabel(label)
      setBusy(true)
      try {
        return await task()
      } catch (err) {
        onFatal(toCcsetError(err))
        return null
      } finally {
        setBusy(false)
        setBusyLabel(undefined)
      }
    },
    [onFatal],
  )

  const open = useCallback(
    (task: Task, label?: string): void => {
      void run(task, label).then((screen) => {
        if (screen !== null) setFrames((prev) => [...prev, toFrame(screen, task)])
      })
    },
    [run],
  )

  /**
   * A confirm stacks instead of superseding: it is a question about the action,
   * not its outcome, so cancelling has to return to the screen that asked --
   * including a form holding values the user has not managed to save yet.
   * Nothing produced here carries a reload: the task behind it may have written.
   */
  const replace = useCallback(
    (task: Task, label?: string): void => {
      void run(task, label).then((screen) => {
        if (screen === null) return
        setFrames((prev) =>
          screen.kind === 'confirm'
            ? [...prev, { screen }]
            : [...prev.slice(0, -1), { screen }],
        )
      })
    },
    [run],
  )

  const setTop = useCallback((screen: ActionResult): void => {
    setFrames((prev) => {
      const top = prev[prev.length - 1]
      return top === undefined ? prev : [...prev.slice(0, -1), { ...top, screen }]
    })
  }, [])

  const back = useCallback((): void => {
    const next = framesRef.current.slice(0, -1)
    setFrames(next)
    const task = next[next.length - 1]?.reload
    if (task === undefined) return
    void run(task).then((screen) => {
      if (screen !== null) setFrames([...next.slice(0, -1), toFrame(screen, task)])
    })
  }, [run])

  return {
    frames,
    current: frames[frames.length - 1]?.screen,
    busy,
    busyLabel,
    open,
    replace,
    setTop,
    back,
  }
}
