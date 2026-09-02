import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionResult } from '../types.js'
import { toCcsetError, type CcsetError } from '../core/errors.js'
import { t } from '../i18n/index.js'

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

/**
 * A task that throws still leaves the screens it was opened from on the stack,
 * so its failure is a screen of its own rather than a fatal: going back from it
 * returns to the form that produced the attempt, still holding what was typed.
 * A transient failure -- a full disk, a read-only directory -- must not be able
 * to discard the only copy of a token the user just entered.
 */
function errorScreen(error: CcsetError): ActionResult {
  return {
    kind: 'message',
    title: t('error.screenTitle'),
    lines: [t(error.messageKey, error.params), '', t('error.screenHint')],
    tone: 'error',
  }
}

/** An error supersedes nothing: it stacks, so the screen that caused it stays
 *  one Esc away beneath it. */
function isError(screen: ActionResult): boolean {
  return screen.kind === 'message' && screen.tone === 'error'
}

export function useScreens(): Screens {
  const [frames, setFrames] = useState<Frame[]>([])
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState<string>()
  // Input handlers close over the render that created them, so the stack is
  // mirrored into a ref rather than read from that stale closure.
  const framesRef = useRef<Frame[]>(frames)
  useEffect(() => {
    framesRef.current = frames
  }, [frames])

  const run = useCallback(async (task: Task, label?: string): Promise<ActionResult> => {
    setBusyLabel(label)
    setBusy(true)
    try {
      return await task()
    } catch (err) {
      return errorScreen(toCcsetError(err))
    } finally {
      setBusy(false)
      setBusyLabel(undefined)
    }
  }, [])

  const open = useCallback(
    (task: Task, label?: string): void => {
      void run(task, label).then((screen) => setFrames((prev) => [...prev, toFrame(screen, task)]))
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
        setFrames((prev) =>
          screen.kind === 'confirm' || isError(screen)
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
      // A failed re-read supersedes the frame rather than stacking: what failed
      // is the read the frame was showing, and stacking would make every esc
      // re-trigger the failure instead of letting navigation continue. Only
      // list/status carry a reload, so what is replaced here is a read.
      setFrames([...next.slice(0, -1), toFrame(screen, task)])
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
