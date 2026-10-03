// The website renders the repository's own Markdown instead of a copied
// corpus (ADR 0015): `?raw` imports are the single source of truth, so a doc
// edit and the site move together and AGENTS.md's no-duplicated-guidance rule
// holds. Paths are relative to pages/src/content/.
import readmeEn from '../../../README.md?raw'
import readmeZh from '../../../README.zh-CN.md?raw'
import contributing from '../../../CONTRIBUTING.md?raw'
import contributingZh from '../../../docs/zh-CN/CONTRIBUTING.zh-CN.md?raw'
import support from '../../../SUPPORT.md?raw'
import supportZh from '../../../docs/zh-CN/SUPPORT.zh-CN.md?raw'
import security from '../../../SECURITY.md?raw'
import securityZh from '../../../docs/zh-CN/SECURITY.zh-CN.md?raw'
import contextDoc from '../../../CONTEXT.md?raw'
import contextDocZh from '../../../docs/zh-CN/CONTEXT.zh-CN.md?raw'
import userGuide from '../../../docs/user-guide.md?raw'
import userGuideZh from '../../../docs/zh-CN/user-guide.zh-CN.md?raw'
import commandsDoc from '../../../docs/milestone-3-non-interactive.md?raw'
import commandsDocZh from '../../../docs/zh-CN/milestone-3-non-interactive.zh-CN.md?raw'
import architecture from '../../../docs/architecture.md?raw'
import architectureZh from '../../../docs/zh-CN/architecture.zh-CN.md?raw'
import verification from '../../../docs/verification.md?raw'
import verificationZh from '../../../docs/zh-CN/verification.zh-CN.md?raw'
import addingAgent from '../../../docs/adding-an-agent.md?raw'
import addingAgentZh from '../../../docs/zh-CN/adding-an-agent.zh-CN.md?raw'
import addAgentWorkflow from '../../../docs/agents/add-agent-workflow.md?raw'

/** Repository path relative to the checkout root → raw Markdown text. */
export const SOURCES: Readonly<Record<string, string>> = {
  'README.md': readmeEn,
  'README.zh-CN.md': readmeZh,
  'CONTRIBUTING.md': contributing,
  'docs/zh-CN/CONTRIBUTING.zh-CN.md': contributingZh,
  'SUPPORT.md': support,
  'docs/zh-CN/SUPPORT.zh-CN.md': supportZh,
  'SECURITY.md': security,
  'docs/zh-CN/SECURITY.zh-CN.md': securityZh,
  'CONTEXT.md': contextDoc,
  'docs/zh-CN/CONTEXT.zh-CN.md': contextDocZh,
  'docs/user-guide.md': userGuide,
  'docs/zh-CN/user-guide.zh-CN.md': userGuideZh,
  'docs/milestone-3-non-interactive.md': commandsDoc,
  'docs/zh-CN/milestone-3-non-interactive.zh-CN.md': commandsDocZh,
  'docs/architecture.md': architecture,
  'docs/zh-CN/architecture.zh-CN.md': architectureZh,
  'docs/verification.md': verification,
  'docs/zh-CN/verification.zh-CN.md': verificationZh,
  'docs/adding-an-agent.md': addingAgent,
  'docs/zh-CN/adding-an-agent.zh-CN.md': addingAgentZh,
  'docs/agents/add-agent-workflow.md': addAgentWorkflow,
}
