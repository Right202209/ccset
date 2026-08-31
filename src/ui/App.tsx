import React, { useCallback, useEffect, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import stringWidth from 'string-width'
import type { Action, Agent, ConfirmScreen, Ctx, FormValues, ListItem, Viewport } from '../types.js'
import type { CcsetError } from '../core/errors.js'
import { t } from '../i18n/index.js'
import { AgentSelect, MainMenu } from './Menu.js'
import { TerminalContext, useTerminal, type Terminal } from './terminal.js'
import { Busy, Prompt, ScreenView, type ScreenHandlers } from './Views.js'
import { useScreens } from './useScreens.js'
import { useTerminalViewport, useViewport, ViewportProvider } from './Viewport.js'

export interface AppProps {
  ctx: Ctx
  agents: Agent[]
  agentId?: string
  terminal: Terminal
  onFatal: (error: CcsetError) => void
  viewport?: Viewport
}

/** One registered agent means no question to ask (PRD 4.1). */
function initialAgent(agents: Agent[], agentId?: string): Agent | null {
  if (agentId !== undefined) return agents.find((agent) => agent.id === agentId) ?? null
  return agents.length === 1 ? agents[0] ?? null : null
}

type PromptKind = 'exit' | 'discard'

export function App({
  ctx,
  agents,
  agentId,
  terminal,
  onFatal,
  viewport: explicitViewport,
}: AppProps): React.ReactElement {
  const { exit } = useApp()
  const viewport = useTerminalViewport(explicitViewport)
  const [agent, setAgent] = useState<Agent | null>(() => initialAgent(agents, agentId))
  const [detected, setDetected] = useState<boolean | null>(null)
  const [prompt, setPrompt] = useState<PromptKind | null>(null)
  const [dirty, setDirty] = useState(false)
  const screens = useScreens(onFatal)

  useEffect(() => {
    let active = true
    if (agent !== null) {
      agent
        .detect(ctx)
        .then((found) => (active ? setDetected(found) : undefined))
        .catch(() => (active ? setDetected(null) : undefined))
    }
    return () => {
      active = false
    }
  }, [agent, ctx])

  /** Esc and Cancel share this: only unsaved edits stand in the way. */
  function leave(): void {
    if (screens.current?.kind === 'form' && dirty) {
      setPrompt('discard')
      return
    }
    setDirty(false)
    if (screens.frames.length > 0) screens.back()
    else exit()
  }

  function resolvePrompt(): void {
    const kind = prompt
    setPrompt(null)
    setDirty(false)
    if (kind === 'discard') screens.back()
    else exit()
  }

  useInput((_input, key) => {
    if (screens.busy || prompt !== null) return
    if (key.escape) leave()
  })

  function submit(values: FormValues): void {
    const screen = screens.current
    if (screen?.kind !== 'form') return
    setDirty(false)
    // Park what was typed on the frame first: if the save comes back with a
    // question rather than a result -- a target that no longer parses --
    // declining it has to return a form that still holds the user's input.
    screens.setTop({ ...screen, values })
    screens.replace(() => screen.submit(values), screen.busyLabel?.(values))
  }

  const onDirtyChange = useCallback((value: boolean) => setDirty(value), [])

  const handlers: ScreenHandlers = {
    onSubmit: submit,
    onSelect: (item: ListItem) => screens.open(item.run),
    onConfirm: (screen: ConfirmScreen) => screens.replace(screen.confirm, screen.busyLabel),
    onCancel: leave,
    onDone: leave,
    onDirtyChange,
  }

  function body(): React.ReactElement {
    if (screens.busy) return <Busy label={screens.busyLabel} />
    if (agent === null) return <AgentSelect agents={agents} onSelect={setAgent} onExit={exit} />
    const screen = screens.current
    if (screen === undefined) {
      return (
        <MainMenu
          agent={agent}
          detected={detected}
          onRun={(action: Action) => screens.open(() => action.run(ctx))}
          onExit={exit}
        />
      )
    }
    return (
      <>
        <Box display={prompt === null ? 'flex' : 'none'}>
          <ScreenView screen={screen} handlers={handlers} active={prompt === null} />
        </Box>
        {prompt !== null && (
          <Prompt
            lineKey={`prompt.${prompt}Line`}
            confirmKey={`prompt.${prompt}Confirm`}
            onConfirm={resolvePrompt}
            onCancel={() => setPrompt(null)}
          />
        )}
      </>
    )
  }

  return (
    <TerminalContext.Provider value={terminal}>
      <ViewportProvider viewport={viewport}>
        <Box flexDirection="column" padding={1}>
          <Header
            segments={headerSegments(
              screens.frames.map((frame) => frame.screen.title),
              agent,
              prompt,
            )}
          />
          {body()}
        </Box>
      </ViewportProvider>
    </TerminalContext.Provider>
  )
}

function headerSegments(
  frameTitles: string[],
  agent: Agent | null,
  prompt: PromptKind | null,
): string[] {
  if (prompt !== null) return [t(`prompt.${prompt}Title`)]
  if (frameTitles.length > 0) return frameTitles
  return [agent === null ? t('menu.agentTitle') : t('app.agent', { name: agent.name })]
}

function Header({ segments }: { segments: string[] }): React.ReactElement {
  const { colors, fold, glyphs } = useTerminal()
  const { columns } = useViewport()
  const separator = ` ${glyphs.pathSeparator} `
  const fullPath = segments.join(separator)
  const path =
    segments.length > 2 && stringWidth(fold(fullPath)) > Math.max(1, columns - 2)
      ? ['…', ...segments.slice(-2)].join(separator)
      : fullPath
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={colors.heading}>
          {fold(t('app.title'))}
        </Text>
        <Text dimColor>{fold(`  ${t('app.tagline')}`)}</Text>
      </Box>
      <Text bold>{fold(path)}</Text>
    </Box>
  )
}
