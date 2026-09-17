import type { Locale } from '../i18n/types.js'

/** Sidebar section a document is listed under. */
export type DocGroup = 'getting-started' | 'reference' | 'project'

export interface DocEntry {
  /** URL slug under /docs/. */
  slug: string
  /** Path in the repository, used for link resolution and the GitHub source link. */
  repoPath: string
  group: DocGroup
  /** i18n key of the sidebar label. */
  labelKey: string
  /** Repository source path per locale; a missing locale falls back at read time. */
  sources: Partial<Record<Locale, string>>
}

/**
 * The docs the viewer serves, in sidebar order. ADRs, the verification
 * register, and source files stay on GitHub; only these routes exist.
 */
export const DOC_ENTRIES: readonly DocEntry[] = [
  {
    slug: 'overview',
    repoPath: 'README.md',
    group: 'getting-started',
    labelKey: 'doc.overview',
    sources: { en: 'README.md', 'zh-Hans': 'README.zh-CN.md' },
  },
  {
    slug: 'user-guide',
    repoPath: 'docs/user-guide.md',
    group: 'getting-started',
    labelKey: 'doc.user-guide',
    sources: { en: 'docs/user-guide.md', 'zh-Hans': 'docs/user-guide.zh-CN.md' },
  },
  {
    slug: 'commands',
    repoPath: 'docs/milestone-3-non-interactive.md',
    group: 'reference',
    labelKey: 'doc.commands',
    sources: {
      en: 'docs/milestone-3-non-interactive.md',
      'zh-Hans': 'docs/milestone-3-non-interactive.zh-CN.md',
    },
  },
  {
    slug: 'glossary',
    repoPath: 'CONTEXT.md',
    group: 'reference',
    labelKey: 'doc.glossary',
    sources: { en: 'CONTEXT.md', 'zh-Hans': 'CONTEXT.zh-CN.md' },
  },
  {
    slug: 'architecture',
    repoPath: 'docs/architecture.md',
    group: 'project',
    labelKey: 'doc.architecture',
    sources: { en: 'docs/architecture.md', 'zh-Hans': 'docs/architecture.zh-CN.md' },
  },
  {
    slug: 'verification',
    repoPath: 'docs/verification.md',
    group: 'project',
    labelKey: 'doc.verification',
    sources: { en: 'docs/verification.md', 'zh-Hans': 'docs/verification.zh-CN.md' },
  },
  {
    slug: 'adding-an-agent',
    repoPath: 'docs/adding-an-agent.md',
    group: 'project',
    labelKey: 'doc.adding-an-agent',
    sources: { en: 'docs/adding-an-agent.md', 'zh-Hans': 'docs/adding-an-agent.zh-CN.md' },
  },
  {
    slug: 'add-agent-workflow',
    repoPath: 'docs/agents/add-agent-workflow.md',
    group: 'project',
    labelKey: 'doc.add-agent-workflow',
    // Chinese-only: shown in both languages because there is no other source.
    sources: { 'zh-Hans': 'docs/agents/add-agent-workflow.md' },
  },
  {
    slug: 'contributing',
    repoPath: 'CONTRIBUTING.md',
    group: 'project',
    labelKey: 'doc.contributing',
    sources: { en: 'CONTRIBUTING.md', 'zh-Hans': 'CONTRIBUTING.zh-CN.md' },
  },
  {
    slug: 'support',
    repoPath: 'SUPPORT.md',
    group: 'project',
    labelKey: 'doc.support',
    sources: { en: 'SUPPORT.md', 'zh-Hans': 'SUPPORT.zh-CN.md' },
  },
  {
    slug: 'security',
    repoPath: 'SECURITY.md',
    group: 'project',
    labelKey: 'doc.security',
    sources: { en: 'SECURITY.md', 'zh-Hans': 'SECURITY.zh-CN.md' },
  },
]

/** The slug /docs itself shows. */
export const HOME_SLUG = 'overview'

export const DOC_ORDER: readonly string[] = DOC_ENTRIES.map((entry) => entry.slug)

export function findEntry(slug: string): DocEntry | undefined {
  return DOC_ENTRIES.find((entry) => entry.slug === slug)
}
