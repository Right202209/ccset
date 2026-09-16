import { useEffect, useMemo, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/index.js'
import { useCopy } from '../hooks/useCopy.js'
import { renderMarkdown } from './render.js'
import { Toast } from '../components/Toast.js'

interface Props {
  markdown: string
  sourceDir: string
}

/**
 * The sanitized HTML container. Copy buttons are injected into code blocks and
 * clicks are delegated here: internal links go through the router so the SPA
 * never reloads, and fragment links scroll in place.
 */
export function MarkdownView({ markdown, sourceDir }: Props) {
  const { t } = useLanguage()
  const { copied, copy } = useCopy()
  const navigate = useNavigate()
  const { hash } = useLocation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const html = useMemo(() => renderMarkdown(markdown, sourceDir), [markdown, sourceDir])

  useEffect(() => {
    const node = containerRef.current
    if (node === null) return
    node.innerHTML = html
    injectCopyButtons(node, t('copy.copy'))
  }, [html, t])

  useEffect(() => {
    if (hash === '') return
    scrollToId(containerRef.current, hash.slice(1))
  }, [hash, html])

  const onClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    delegateClick(event, containerRef.current, { navigate, copy })
  }

  return (
    <>
      <div ref={containerRef} className="markdown" onClick={onClick} />
      <Toast message={copied ? t('copy.copied') : null} />
    </>
  )
}

function injectCopyButtons(root: HTMLElement, label: string): void {
  for (const pre of root.querySelectorAll('pre')) {
    if (pre.querySelector('.code-copy') !== null) continue
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'code-copy'
    button.textContent = label
    button.setAttribute('aria-label', label)
    pre.appendChild(button)
  }
}

function scrollToId(root: HTMLElement | null, id: string): void {
  const target = findHeading(root, id)
  target?.scrollIntoView({ block: 'start' })
}

function findHeading(root: HTMLElement | null, id: string): Element | null {
  if (root === null || id === '') return null
  // CSS.escape over manual escaping: heading ids can start with a digit
  // ("1. Intro" slugs to "1-intro"), which a plain "#id" selector rejects.
  return root.querySelector(`#${CSS.escape(id)}`)
}

interface ClickContext {
  navigate: (href: string) => void
  copy: (text: string) => Promise<boolean>
}

function isPlainLeftClick(event: ReactMouseEvent<HTMLDivElement>): boolean {
  return (
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
  )
}

function delegateClick(
  event: ReactMouseEvent<HTMLDivElement>,
  root: HTMLElement | null,
  context: ClickContext,
): void {
  // Left click with no modifiers only: ctrl/cmd/shift/alt-click and middle
  // click keep the browser's open-in-new-tab (or scroll) behavior.
  if (!isPlainLeftClick(event)) return
  const target = event.target as HTMLElement
  const copyButton = target.closest('button.code-copy')
  if (copyButton !== null) {
    copyPreText(copyButton, context)
    return
  }
  const anchor = target.closest('a')
  if (anchor === null || event.defaultPrevented) return
  const href = anchor.getAttribute('href') ?? ''
  if (href.startsWith('/')) {
    event.preventDefault()
    context.navigate(href)
    return
  }
  if (href.startsWith('#')) {
    event.preventDefault()
    scrollToId(root, href.slice(1))
  }
}

function copyPreText(copyButton: Element, context: ClickContext): void {
  const pre = copyButton.closest('pre')
  if (pre === null) return
  const clone = pre.cloneNode(true) as HTMLElement
  clone.querySelector('button.code-copy')?.remove()
  void context.copy((clone.textContent ?? '').trimEnd())
}
