import React, { useCallback, useState } from 'react'
import { Box, useApp, useInput } from 'ink'
import type {
  Action,
  ActionResult,
  Agent,
  ConfirmScreen,
  Ctx,
  FormValues,
  ListItem,
  Viewport,
} from '../types.js'
import { t } from '../i18n/index.js'
import { helpFor, type ScreenKind } from './keymap.js'
import { Layout } from './Layout.js'
import { AgentSelect, MainMenu, NoAgents } from './Menu.js'
import { SidePanels, useLastResult, type LastResult, type SideState } from './SidePanels.js'
import { TerminalContext, type ColorSet, type Terminal } from './terminal.js'
import { useAgentDiscovery, type Discovery } from './useAgentDiscovery.js'
import { Busy, Prompt, ScreenView, type ScreenHandlers } from './Views.js'
import { useScreens, type Screens } from './useScreens.js'
import { useTerminalViewport } from './Viewport.js'

export interface AppProps {
  ctx: Ctx
  agents: Agent[]
  agentId?: string
  terminal: Terminal
  viewport?: Viewport
}

/** Only unsaved edits ever raise the prompt; the unreachable exit variant and
 *  its catalog keys were removed with the dead branch. */
type PromptKind = 'discard'

interface Flow {
  prompt: PromptKind | null
  handlers: ScreenHandlers
  /** The prompt's confirm: drop the edits and leave the form. */
  discard: () => void
  /** The prompt's cancel: back to the form with its edits. */
  stay: () => void
}

function useScreenFlow(screens: Screens, exit: () => void): Flow {
  const [prompt, setPrompt] = useState<PromptKind | null>(null)
  const [dirty, setDirty] = useState(false)

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

  function discard(): void {
    setPrompt(null)
    setDirty(false)
    screens.back()
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
  return { prompt, handlers, discard, stay: () => setPrompt(null) }
}

/** What the frame reads to draw itself around the Body. */
interface ChromeState {
  busy: boolean
  prompt: PromptKind | null
  agent: Agent | null
  available: Agent[] | null
  current: ActionResult | undefined
}

/** The keymap whatever holds the keys answers to; none while nothing does. */
function helpKind({ busy, prompt, agent, available, current }: ChromeState): ScreenKind | null {
  if (busy) return null
  if (prompt !== null) return 'confirm'
  if (agent !== null) return current?.kind ?? 'list'
  if (available === null) return null
  return available.length === 0 ? 'message' : 'list'
}

/** The main Panel's border says what its Screen asks: browse, edit, decide, or read a result. */
function paneColor(colors: ColorSet, { prompt, current }: ChromeState): string {
  if (prompt !== null || current?.kind === 'confirm') return colors.panel.decide
  if (current?.kind === 'form') return colors.panel.edit
  if (current?.kind === 'message') return colors.tone[current.tone]
  return colors.panel.browse
}

/** The main Panel's title with no Frame open: the Agent, or the question the App is asking. */
function rootTitle(agent: Agent | null, available: Agent[] | null): string {
  if (agent !== null) return t('app.agent', { name: agent.name })
  if (available?.length === 0) return t('menu.noAgentsTitle')
  return t('menu.agentTitle')
}

/** The navigation path: every open Frame's title, or the prompt standing over them. */
function pathSegments(frameTitles: string[], root: string, prompt: PromptKind | null): string[] {
  if (prompt !== null) return [t(`prompt.${prompt}Title`)]
  if (frameTitles.length > 0) return frameTitles
  return [root]
}

function sideState(discovery: Discovery, home: string, last: LastResult | null): SideState {
  return {
    agentName: discovery.agent?.name,
    detected: discovery.detected,
    found: discovery.available?.length ?? null,
    home,
    last,
  }
}

/**
 * A message Screen is the one worth copying from -- the path written, the
 * activation command (ADR 0002) -- so it keeps the full width, and the side
 * Panel that would have summarized it would only repeat it.
 */
function showsSide(current: ActionResult | undefined): boolean {
  return current?.kind !== 'message'
}

interface AgentChoiceProps {
  available: Agent[] | null
  onSelect: (agent: Agent) => void
  onExit: () => void
}

function AgentChoice({ available, onSelect, onExit }: AgentChoiceProps): React.ReactElement {
  if (available === null) return <Busy label={t('app.detectingAgents')} />
  if (available.length === 0) return <NoAgents onExit={onExit} />
  return <AgentSelect agents={available} onSelect={onSelect} onExit={onExit} />
}

interface BodyProps {
  ctx: Ctx
  discovery: Discovery
  screens: Screens
  flow: Flow
  exit: () => void
}

/** What the main Panel holds: the busy line, the Agent choice, the menu, or the top Frame. */
function Body({ ctx, discovery, screens, flow, exit }: BodyProps): React.ReactElement {
  if (screens.busy) return <Busy label={screens.busyLabel} />
  const { agent } = discovery
  if (agent === null) {
    return <AgentChoice available={discovery.available} onSelect={discovery.choose} onExit={exit} />
  }
  const screen = screens.current
  if (screen === undefined) {
    return (
      <MainMenu
        agent={agent}
        detected={discovery.detected}
        onRun={(action: Action) => screens.open(() => action.run(ctx))}
        onExit={exit}
      />
    )
  }
  return (
    <>
      <Box display={flow.prompt === null ? 'flex' : 'none'}>
        <ScreenView screen={screen} handlers={flow.handlers} active={flow.prompt === null} />
      </Box>
      {flow.prompt !== null && (
        <Prompt
          lineKey={`prompt.${flow.prompt}Line`}
          confirmKey={`prompt.${flow.prompt}Confirm`}
          onConfirm={flow.discard}
          onCancel={flow.stay}
        />
      )}
    </>
  )
}

export function App({
  ctx,
  agents,
  agentId,
  terminal,
  viewport: explicitViewport,
}: AppProps): React.ReactElement {
  const { exit } = useApp()
  const viewport = useTerminalViewport(explicitViewport)
  const discovery = useAgentDiscovery(agents, ctx, agentId)
  const screens = useScreens()
  const flow = useScreenFlow(screens, exit)
  const last = useLastResult(screens.current)
  const chrome: ChromeState = {
    busy: screens.busy,
    prompt: flow.prompt,
    agent: discovery.agent,
    available: discovery.available,
    current: screens.current,
  }
  const kind = helpKind(chrome)
  const titles = screens.frames.map((frame) => frame.screen.title)
  const side = showsSide(screens.current)
    ? <SidePanels state={sideState(discovery, ctx.home, last)} />
    : undefined
  return (
    <TerminalContext.Provider value={terminal}>
      <Layout
        viewport={viewport}
        name={t('app.title')}
        tagline={t('app.tagline')}
        path={pathSegments(titles, rootTitle(discovery.agent, discovery.available), flow.prompt)}
        color={paneColor(terminal.colors, chrome)}
        help={kind === null ? '' : helpFor(kind)}
        side={side}
      >
        <Body ctx={ctx} discovery={discovery} screens={screens} flow={flow} exit={exit} />
      </Layout>
    </TerminalContext.Provider>
  )
}
