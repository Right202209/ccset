import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { useStdin, useStdout, type DOMElement } from 'ink'
import type { SelectOption } from './SelectList.js'
import { MouseDecoder, registerActiveMouseDecoder, registerMouseMode, rowAtPoint } from './mouse.js'

interface MouseInputOptions {
  rowNodes: React.MutableRefObject<Map<number, DOMElement>>
  options: SelectOption[]
  onSelect: (option: SelectOption, index: number) => void
  setIndex: Dispatch<SetStateAction<number>>
}

export function useMouseInput({ rowNodes, options, onSelect, setIndex }: MouseInputOptions): () => boolean {
  const latest = useRef({ options, onSelect })
  const decoderRef = useRef<MouseDecoder | null>(null)
  latest.current = { options, onSelect }
  const { stdin, isRawModeSupported, internal_eventEmitter } = useStdin()
  const { stdout } = useStdout()

  useEffect(() => {
    const decoder = new MouseDecoder((event) => {
      if (event.button !== 0 || event.action !== 'press') return
      const target = rowAtPoint(rowNodes.current, event.x, event.y)
      const option = target === null ? undefined : latest.current.options[target]
      if (target === null || option === undefined) return
      setIndex(target)
      latest.current.onSelect(option, target)
    })
    decoderRef.current = decoder
    const onInput = (input: unknown): void => decoder.push(String(input))
    internal_eventEmitter.prependListener('input', onInput)
    const enabled = stdin.isTTY === true && isRawModeSupported && stdout.isTTY === true
    const unregisterDecoder = registerActiveMouseDecoder(decoder)
    const unregisterMouseMode = enabled ? registerMouseMode(stdout) : undefined
    return () => {
      internal_eventEmitter.removeListener('input', onInput)
      if (decoderRef.current === decoder) decoderRef.current = null
      unregisterDecoder()
      decoder.dispose()
      unregisterMouseMode?.()
    }
  }, [internal_eventEmitter, isRawModeSupported, rowNodes, setIndex, stdin, stdout])
  return () => decoderRef.current?.hasPendingMouseCode() ?? false
}
