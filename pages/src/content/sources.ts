// The website renders the repository's own Markdown instead of a copied
// corpus (ADR 0015): `?raw` imports are the single source of truth, so a doc
// edit and the site move together and AGENTS.md's no-duplicated-guidance rule
// holds. Paths are relative to pages/src/content/.
import readmeEn from '../../../README.md?raw'
import readmeZh from '../../../README.zh-CN.md?raw'
import contributing from '../../../CONTRIBUTING.md?raw'
import support from '../../../SUPPORT.md?raw'
import security from '../../../SECURITY.md?raw'
import contextDoc from '../../../CONTEXT.md?raw'
import userGuide from '../../../docs/user-guide.md?raw'
import commandsDoc from '../../../docs/milestone-3-non-interactive.md?raw'
import architecture from '../../../docs/architecture.md?raw'
import verification from '../../../docs/verification.md?raw'
import addingAgent from '../../../docs/adding-an-agent.md?raw'
import addAgentWorkflow from '../../../docs/agents/add-agent-workflow.md?raw'

/** Repository path relative to the checkout root → raw Markdown text. */
export const SOURCES: Readonly<Record<string, string>> = {
  'README.md': readmeEn,
  'README.zh-CN.md': readmeZh,
  'CONTRIBUTING.md': contributing,
  'SUPPORT.md': support,
  'SECURITY.md': security,
  'CONTEXT.md': contextDoc,
  'docs/user-guide.md': userGuide,
  'docs/milestone-3-non-interactive.md': commandsDoc,
  'docs/architecture.md': architecture,
  'docs/verification.md': verification,
  'docs/adding-an-agent.md': addingAgent,
  'docs/agents/add-agent-workflow.md': addAgentWorkflow,
}
