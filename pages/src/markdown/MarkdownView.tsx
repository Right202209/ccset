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
  const escaped = id.replace(/([^a-zA-Z0-9_\u00A0-\uFFFF-])/g, '\\$1')
  return root.querySelector(`#${escaped}`)
}

interface ClickContext {
  navigate: (href: string) => void
  copy: (text: string) => Promise<boolean>
}

function delegateClick(
  event: ReactMouseEvent<HTMLDivElement>,
  root: HTMLElement | null,
  context: ClickContext,
): void {
  const target = event.target as HTMLElement
  const copyButton = target.closest('button.code-copy')
  if (copyButton !== null) {
    copyPreText(copyButton, context)
    return
  }
  const anchor = target.closest('a')
  if (anchor === null) return
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
