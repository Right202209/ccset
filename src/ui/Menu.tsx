import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import type { Action, Agent } from '../types.js'
import { hasKey, t } from '../i18n/index.js'
import { SelectList, type SelectOption } from './SelectList.js'
import { useTerminal } from './terminal.js'
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
