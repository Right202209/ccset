import type { Catalog } from './types.js'

/**
 * English catalog for the website. Documentation prose comes from the
 * repository's own Markdown; these keys cover only the site's own surface.
 * zh-Hans.ts must carry the same key set (catalog.test.ts enforces it).
 */
export const en: Catalog = {
  /* ------------------------------------------------------------------- nav */
  'nav.docs': 'Docs',
  'nav.github': 'GitHub',
  'nav.language': 'Language',

  /* ------------------------------------------------------------------ hero */
  'hero.tagline':
    'Configure third-party API providers for Claude Code, opencode, Codex CLI, pi, and Grok Build with an interactive terminal UI or scriptable commands. ccset preserves unmanaged settings and backs up existing files before changing them.',
  'hero.quickStart': 'Quick start',
  'hero.docs': 'Documentation',
  'hero.demoTitle': 'A ccset session',

  /* ------------------------------------------------------------------ copy */
  'copy.copy': 'Copy',
  'copy.copied': 'Copied',

  /* ------------------------------------------------------------- highlights */
  'highlights.title': 'Why ccset',
  'highlight.agents.title': 'Five agents',
  'highlight.agents.body': 'Claude Code, opencode, Codex CLI, pi, and Grok Build, each with its own paths and rules.',
  'highlight.cli.title': 'TUI and scriptable CLI',
  'highlight.cli.body': 'Interactive screens for people, explicit commands with --dry-run and --json for scripts and CI.',
  'highlight.i18n.title': 'English / 简体中文',
  'highlight.i18n.body': 'Choose the interface language on first use; commands and output stay stable.',
  'highlight.safety.title': 'Backups ×10, writes 0600',
  'highlight.safety.body': 'Ten copies per file under the agent’s backups/ccset/ directory; atomic writes with mode 0600 on POSIX.',
  'highlight.preserve.title': 'Unmanaged keys survive',
  'highlight.preserve.body': 'Only managed leaves are written; TOML and JSONC edits preserve comments and formatting.',

  /* ---------------------------------------------------------------- agents */
  'agents.title': 'Supported agents',
  'agents.agentHeader': 'Agent',
  'agents.idHeader': '--agent ID',
  'agents.configHeader': 'Default configuration',

  /* -------------------------------------------------------------- features */
  'features.title': 'Built for real workflows',
  'feature.tui.title': 'Interactive core flow',
  'feature.tui.body': 'Choose an agent, review its settings, and save. Arrow keys move, Enter selects, Esc goes back, Ctrl+S saves a form.',
  'feature.commands.title': 'Scriptable commands',
  'feature.commands.body': 'Every command requires --agent; use --dry-run to preview without writing and --json for structured output.',
  'feature.patch.title': 'Patches, not replacements',
  'feature.patch.body': 'set changes only the fields you supply. Omitted fields keep their values; --unset removes one explicitly.',
  'feature.switch.title': 'Provider switching',
  'feature.switch.body': 'Codex can switch both routing and the live credential; pi sets startup defaults. Saved Auth profiles stay separate.',
  'feature.secrets.title': 'Disciplined secrets',
  'feature.secrets.body': 'Commands accept secrets only through CCSET_TOKEN or --token-stdin, and tokens are masked everywhere in the UI.',
  'feature.activate.title': 'Activation stays yours',
  'feature.activate.body': 'Claude Code prints the claude --settings command to run after saving; ccset never runs your agent for you.',

  /* ------------------------------------------------------------ file safety */
  'fileSafety.title': 'File safety',
  'fileSafety.preserve.title': 'Unmanaged keys survive',
  'fileSafety.preserve.body': 'TOML and JSONC edits preserve comments and formatting.',
  'fileSafety.atomic.title': 'Atomic, re-read writes',
  'fileSafety.atomic.body': 'Targets are re-read before saving, and each file is written atomically with mode 0600 on POSIX.',
  'fileSafety.confirm.title': 'No silent overwrites',
  'fileSafety.confirm.body': 'Invalid config requires explicit confirmation in the UI or --replace-invalid on a supported command.',
  'fileSafety.mask.title': 'Masked tokens',
  'fileSafety.mask.body': 'Tokens are masked in the UI. Only Claude Code’s opt-in Test connection sends a token over the network.',
  'fileSafety.backups.title': 'Backups retain old tokens',
  'fileSafety.backups.body': 'Ten copies are kept per file under the agent’s backups/ccset/ directory. Clear them after rotating credentials.',

  /* ------------------------------------------------------------- quickstart */
  'quickStart.title': 'Quick start',
  'quickStart.run.title': 'Run it',
  'quickStart.run.body': 'Requires Node.js 18+. Choose an agent, review its settings, and save.',
  'quickStart.install.title': 'Install the command',
  'quickStart.install.body': 'Then run it directly with an agent id.',
  'quickStart.cli.title': 'Script it',
  'quickStart.cli.body': 'Explicit commands run in scripts and CI. Supply API keys through CCSET_TOKEN or --token-stdin, never command arguments.',

  /* -------------------------------------------------------------- not found */
  'notFound.title': 'Not found',
  'notFound.body': 'This route does not exist on the site.',
  'notFound.home': 'Back to the homepage',

  /* -------------------------------------------------------------- docs view */
  'docs.search': 'Search the documentation',
  'docs.noResults': 'No documents match “{query}”.',
  'docs.onThisPage': 'On this page',
  'docs.previous': 'Previous',
  'docs.next': 'Next',
  'docs.unknownDoc': 'There is no document at this route.',
  'docs.allDocs': 'All documents',
  'docs.viewSource': 'View source on GitHub',
  'docs.menu': 'Documents',

  /* ---------------------------------------------------------- sidebar groups */
  'group.getting-started': 'Getting started',
  'group.reference': 'Reference',
  'group.project': 'Project',

  /* -------------------------------------------------------------- doc labels */
  'doc.overview': 'Overview',
  'doc.user-guide': 'User guide',
  'doc.commands': 'Commands',
  'doc.glossary': 'Glossary',
  'doc.architecture': 'Architecture',
  'doc.verification': 'Verification',
  'doc.adding-an-agent': 'Adding an agent',
  'doc.add-agent-workflow': 'Add-agent workflow (中文)',
  'doc.contributing': 'Contributing',
  'doc.support': 'Support',
  'doc.security': 'Security',

  /* ---------------------------------------------------------------- footer */
  'footer.npm': 'npm package',
  'footer.license': 'MIT License',
  'footer.builtFrom': 'The site is built from the repository’s own Markdown.',

  /* -------------------------------------------------------------- language */
  'lang.en': 'English',
  'lang.zh-Hans': '简体中文',

  /* ---------------------------------------------------------------- errors */
  'error.boundary': 'Something went wrong rendering this view.',
  'error.reload': 'Reload',
}
