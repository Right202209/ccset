import { useLanguage } from '../../i18n/index.js'
import { SectionHeading } from './SectionHeading.js'

interface AgentRow {
  name: string
  id: string
  config: string
}

/** The README's supported-agents table, verbatim in content. */
const AGENTS: readonly AgentRow[] = [
  { name: 'Claude Code', id: 'claude-code', config: '~/.claude/settings.json and settings.<name>.json' },
  {
    name: 'opencode',
    id: 'opencode',
    config: '~/.config/opencode/opencode.jsonc when present, otherwise opencode.json',
  },
  { name: 'Codex CLI', id: 'codex', config: '~/.codex/config.toml and saved auth.<id>.json profiles' },
  { name: 'pi', id: 'pi', config: '~/.pi/agent/settings.json and models.json' },
  { name: 'Grok Build', id: 'grok-build', config: '~/.grok/config.toml' },
]

/** Cells carry their column label in data-label for the narrow card layout. */
export function Agents() {
  const { t } = useLanguage()
  return (
    <section className="landing-section" id="agents">
      <div className="container">
        <SectionHeading title={t('agents.title')} />
        <div className="table-wrap">
          <table className="agent-table">
            <thead>
              <tr>
                <th scope="col">{t('agents.agentHeader')}</th>
                <th scope="col">{t('agents.idHeader')}</th>
                <th scope="col">{t('agents.configHeader')}</th>
              </tr>
            </thead>
            <tbody>
              {AGENTS.map((agent) => (
                <tr key={agent.id}>
                  <td data-label={t('agents.agentHeader')}>{agent.name}</td>
                  <td data-label={t('agents.idHeader')}>
                    <code>{agent.id}</code>
                  </td>
                  <td data-label={t('agents.configHeader')}>
                    <code>{agent.config}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
