import React, { useMemo } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import type { Action, Agent } from '../types.js'
import { hasKey, localeOptions, t, type Locale } from '../i18n/index.js'
import { SelectList, type SelectOption } from './SelectList.js'
import type { Terminal } from './terminal.js'
import { TerminalContext, useTerminal } from './terminal.js'
import { useTerminalViewport, ViewportProvider } from './Viewport.js'
import { helpFor } from './keymap.js'

const EXIT_ID = '__exit__'

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
  return (
    <Box flexDirection="column">
      {detected === false && (
        <Box marginBottom={1}>
          <Text color={colors.tone.warn}>{fold(t('menu.notDetected'))}</Text>
        </Box>
      )}
      <SelectList
        options={options}
        onSelect={(option, index) => {
          const action = actions[index]
          if (option.id === EXIT_ID || action === undefined) onExit()
          else onRun(action)
        }}
      />
      <Box marginTop={1}>
        <Text dimColor>{fold(helpFor('list'))}</Text>
      </Box>
    </Box>
  )
}

interface AgentSelectProps {
  agents: Agent[]
  onSelect: (agent: Agent) => void
  onExit: () => void
}

/**
 * Only rendered once a second agent is registered (PRD 4.1); with one agent
 * ccset enters it directly rather than asking a question with one answer.
 */
export function AgentSelect({ agents, onSelect, onExit }: AgentSelectProps): React.ReactElement {
  const { fold } = useTerminal()
  const options = [
    ...agents.map((agent) => ({ id: agent.id, label: agent.name })),
    { id: EXIT_ID, label: t('menu.exit') },
  ]
  return (
    <Box flexDirection="column">
      <Text bold>{fold(t('menu.agentTitle'))}</Text>
      <SelectList
        options={options}
        onSelect={(option, index) => {
          const agent = agents[index]
          if (option.id === EXIT_ID || agent === undefined) onExit()
          else onSelect(agent)
        }}
      />
      <Box marginTop={1}>
        <Text dimColor>{fold(helpFor('list'))}</Text>
      </Box>
    </Box>
  )
}

/** Derived from the i18n registry, so a new catalog needs no edit here. */
const LANGUAGE_OPTIONS: Array<SelectOption & { id: Locale }> = localeOptions()

interface LanguageSelectProps {
  terminal: Terminal
  onPick: (locale: Locale) => void
}

/**
 * ADR 0004's first-run prompt, rendered by cli.tsx outside App and before any
 * locale is active. It is the one screen whose copy does not go through the
 * catalogs: with nothing to translate into, it is bilingual by construction.
 * It supplies its own providers because it mounts without App around it.
 */
export function LanguageSelect({ terminal, onPick }: LanguageSelectProps): React.ReactElement {
  const viewport = useTerminalViewport()
  return (
    <TerminalContext.Provider value={terminal}>
      <ViewportProvider viewport={viewport}>
        <LanguagePrompt onPick={onPick} />
      </ViewportProvider>
    </TerminalContext.Provider>
  )
}

interface LanguagePromptProps {
  onPick: (locale: Locale) => void
}

function LanguagePrompt({ onPick }: LanguagePromptProps): React.ReactElement {
  const { exit } = useApp()
  const { fold } = useTerminal()
  useInput((_input, key) => {
    if (key.escape) exit()
  })
  return (
    <Box flexDirection="column">
      <Text bold>{fold('Language / 语言')}</Text>
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
      <Box marginTop={1}>
        <Text dimColor>
          {fold(
            '↑↓ move · 1-9 jump · enter select · esc quit    ↑↓ 移动 · 1-9 跳转 · enter 选择 · esc 退出',
          )}
        </Text>
      </Box>
    </Box>
  )
}
