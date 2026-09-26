import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { useStdin, useStdout, type DOMElement } from 'ink'
import type { SelectOption } from './SelectList.js'
import { MouseDecoder, mouseReport, rowAtPoint, setActiveMouseDecoder } from './mouse.js'

interface MouseInputOptions {
  rowNodes: React.MutableRefObject<Map<number, DOMElement>>
  options: SelectOption[]
  onSelect: (option: SelectOption, index: number) => void
  setIndex: Dispatch<SetStateAction<number>>
}

export function useMouseInput({ rowNodes, options, onSelect, setIndex }: MouseInputOptions): void {
  const latest = useRef({ options, onSelect })
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
    const onInput = (input: unknown): void => decoder.push(String(input))
    internal_eventEmitter.prependListener('input', onInput)
    setActiveMouseDecoder(decoder)
    const enabled = stdin.isTTY === true && isRawModeSupported && stdout.isTTY === true
    if (enabled) stdout.write(mouseReport.enable)
    return () => {
      internal_eventEmitter.removeListener('input', onInput)
      decoder.dispose()
      setActiveMouseDecoder(undefined)
      if (enabled) stdout.write(mouseReport.disable)
    }
  }, [internal_eventEmitter, isRawModeSupported, rowNodes, setIndex, stdin, stdout])
}
