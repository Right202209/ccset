import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../i18n/index.js'
import type { Locale } from '../../i18n/types.js'
// The demo replays real ccset strings, imported from the CLI's catalogs so a
// copy here can never drift from what the tool actually prints (ADR 0015).
import { en as rootEn } from '../../../../src/i18n/en.js'
import { zhHans as rootZh } from '../../../../src/i18n/zh-Hans.js'

type LineKind = 'command' | 'text' | 'accent' | 'field'

interface Line {
  kind: LineKind
  text: string
  suffix?: string
}

const REPLAY_STEP_MS = 420

export function TerminalDemo({ stepMs = REPLAY_STEP_MS }: { stepMs?: number }) {
  const { locale, t } = useLanguage()
  const lines = useMemo(() => buildLines(locale), [locale])
  const [shown, setShown] = useState(1)

  useEffect(() => {
    setShown(1)
  }, [lines])

  useEffect(() => {
    if (shown >= lines.length) return undefined
    const timer = setTimeout(() => setShown(shown + 1), stepMs)
    return () => clearTimeout(timer)
  }, [shown, lines, stepMs])

  return (
    <div className="terminal">
      <div className="terminal-bar" aria-hidden="true">
        <span className="terminal-dot" />
        <span className="terminal-dot" />
        <span className="terminal-dot" />
        <span className="terminal-title">{t('hero.demoTitle')}</span>
      </div>
      <pre className="terminal-body">
        {lines.slice(0, shown).map((line, index) => (
          <div key={index} className={`terminal-line terminal-${line.kind}`}>
            <span className="terminal-num" aria-hidden="true">
              {index + 1}
            </span>
            {line.kind === 'command' && <span className="terminal-prompt">$ </span>}
            {line.kind === 'command' ? <span className="terminal-cmd">{line.text}</span> : null}
            {line.kind === 'field' ? <span className="terminal-label">{line.text}</span> : null}
            {line.kind === 'text' || line.kind === 'accent' ? line.text : null}
            {line.suffix !== undefined && <span className="terminal-suffix"> {line.suffix}</span>}
          </div>
        ))}
        {shown < lines.length && <span className="terminal-cursor" aria-hidden="true" />}
      </pre>
    </div>
  )
}

/** One catalog-backed step of the replay; keys come from the CLI's menus. */
function buildLines(locale: Locale): Line[] {
  const c = (key: string): string => rootCatalog(locale)[key] ?? rootEn[key] ?? key
  return [
    { kind: 'command', text: 'npx @droite/ccset' },
    { kind: 'accent', text: c('menu.agentTitle') },
    { kind: 'text', text: '❯ claude-code' },
    { kind: 'accent', text: c('action.providers') },
    { kind: 'text', text: `  ${c('action.providerAdd')}` },
    { kind: 'field', text: `${c('field.providerName')}  `, suffix: 'example-upstream' },
    { kind: 'field', text: `${c('field.baseUrl')}  `, suffix: 'https://api.example.com' },
    { kind: 'field', text: `${c('field.token')}  `, suffix: 'sk-••••••••••••' },
    { kind: 'field', text: `${c('field.providerModel')}  `, suffix: 'example/claude-sonnet' },
    { kind: 'accent', text: `[Ctrl+S] ${c('form.save')}` },
    { kind: 'text', text: c('write.providerSaved') },
    { kind: 'accent', text: c('write.activate') },
    { kind: 'command', text: 'claude --settings ~/.claude/settings.example.json' },
  ]
}

function rootCatalog(locale: Locale): Record<string, string> {
  return locale === 'zh-Hans' ? rootZh : rootEn
}
