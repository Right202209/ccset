import React, { useMemo } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import type { Action, Agent } from '../types.js'
import { hasKey, localeOptions, t, type Locale } from '../i18n/index.js'
import { Layout } from './Layout.js'
import { SelectList, type SelectOption } from './SelectList.js'
import type { Terminal } from './terminal.js'
import { TerminalContext, useTerminal } from './terminal.js'
import { wrappedRows } from './text-fit.js'
import { useTerminalViewport, useViewport } from './Viewport.js'

const EXIT_ID = '__exit__'
/** The blank row between the not-detected warning and the list. */
const WARNING_MARGIN = 1

interface MainMenuProps {
  agent: Agent
  /** Result of agent.detect(); null while it is still running. */
  detected: boolean | null
  onRun: (action: Action) => void
  onExit: () => void
}

function actionOption(action: Action): SelectOption {
  const detailKey = action.detailKey ?? `${action.labelKey}Detail`
  return {
    id: action.id,
    label: t(action.labelKey),
    detail: hasKey(detailKey) ? t(detailKey) : undefined,
  }
}

export function MainMenu({ agent, detected, onRun, onExit }: MainMenuProps): React.ReactElement {
  const actions = useMemo(() => agent.getActions(), [agent])
  const options = [...actions.map(actionOption), { id: EXIT_ID, label: t('menu.exit') }]
  const { colors, fold } = useTerminal()
  const viewport = useViewport()
  const warning = fold(t('menu.notDetected'))
  // The warning wraps on a narrow Panel, and every row it takes is one the list gives up.
  const warningRows = detected === false ? wrappedRows(warning, viewport.columns) + WARNING_MARGIN : 0
  return (
    <Box flexDirection="column">
      {detected === false && (
        <Box marginBottom={WARNING_MARGIN}>
          <Text color={colors.tone.warn}>{warning}</Text>
        </Box>
      )}
      <SelectList
        options={options}
        rows={Math.max(1, viewport.rows - warningRows)}
        onSelect={(option, index) => {
          const action = actions[index]
          if (option.id === EXIT_ID || action === undefined) onExit()
          else onRun(action)
        }}
      />
    </Box>
  )
}

interface AgentSelectProps {
  agents: Agent[]
  onSelect: (agent: Agent) => void
  onExit: () => void
}

/**
 * Rendered when two or more local agents are detected; with one, ccset enters
 * it directly rather than asking a question with one answer.
 * The main Panel's title already says "Select an agent", so no title of its
 * own: the list takes the Panel's whole Viewport, and an extra row here would
 * push it past that budget once the agent count outgrows it.
 */
export function AgentSelect({ agents, onSelect, onExit }: AgentSelectProps): React.ReactElement {
  const options = [
    ...agents.map((agent) => ({ id: agent.id, label: agent.name })),
    { id: EXIT_ID, label: t('menu.exit') },
  ]
  return (
    <SelectList
      options={options}
      onSelect={(option, index) => {
        const agent = agents[index]
        if (option.id === EXIT_ID || agent === undefined) onExit()
        else onSelect(agent)
      }}
    />
  )
}

/**
 * Nothing detected in this home. An undetected Agent is reachable only through
 * an explicit --agent (ADR 0016), so the Screen names it rather than leaving
 * the user at a dead end; the main Panel's title carries the heading.
 */
export function NoAgents({ onExit }: { onExit: () => void }): React.ReactElement {
  const { colors, fold } = useTerminal()
  useInput((_input, key) => {
    if (key.return) onExit()
  })
  return (
    <Box flexDirection="column">
      <Text color={colors.tone.warn}>{fold(t('menu.noDetectedAgents'))}</Text>
      <Text>{fold(t('menu.noDetectedAgentsHint'))}</Text>
    </Box>
  )
}

/** Derived from the i18n registry, so a new catalog needs no edit here. */
const LANGUAGE_OPTIONS: Array<SelectOption & { id: Locale }> = localeOptions()

/** The prompt's chrome is spelled here, like its copy: no catalog is active yet. */
const LANGUAGE_FRAME_NAME = 'ccset'
const LANGUAGE_TITLE = 'Language / 语言'
const LANGUAGE_HELP =
  '↑↓ move · 1-9 jump · enter select · esc quit    ↑↓ 移动 · 1-9 跳转 · enter 选择 · esc 退出'

interface LanguageSelectProps {
  terminal: Terminal
  onPick: (locale: Locale) => void
}

/**
 * ADR 0005's first-run prompt, rendered by cli.tsx outside App and before any
 * locale is active. It is the one screen whose copy does not go through the
 * catalogs: with nothing to translate into, it is bilingual by construction.
 * It supplies its own providers because it mounts without App around it.
 */
export function LanguageSelect({ terminal, onPick }: LanguageSelectProps): React.ReactElement {
  const viewport = useTerminalViewport()
  return (
    <TerminalContext.Provider value={terminal}>
      <Layout
        viewport={viewport}
        name={LANGUAGE_FRAME_NAME}
        path={[LANGUAGE_TITLE]}
        color={terminal.colors.panel.browse}
        help={LANGUAGE_HELP}
      >
        <LanguagePrompt onPick={onPick} />
      </Layout>
    </TerminalContext.Provider>
  )
}

interface LanguagePromptProps {
  onPick: (locale: Locale) => void
}

function LanguagePrompt({ onPick }: LanguagePromptProps): React.ReactElement {
  const { exit } = useApp()
  useInput((_input, key) => {
    if (key.escape) exit()
  })
  return (
    <SelectList
      options={LANGUAGE_OPTIONS}
      onSelect={(_option, index) => {
        // By index, like the other lists in this file: SelectList widens
        // option.id back to string.
        const picked = LANGUAGE_OPTIONS[index]?.id
        if (picked !== undefined) onPick(picked)
        exit()
      }}
    />
  )
}
