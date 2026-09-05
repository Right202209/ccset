import { Command } from 'commander'
import packageJson from '../package.json'
import { AGENTS, findAgent } from './registry.js'
import {
  CcsetError,
  EXIT_NOT_TTY,
  EXIT_RUNTIME,
  toCcsetError,
} from './core/errors.js'
import { resolveHome, settingsFilePath } from './core/paths.js'
import { readSavedLocale, saveLocale } from './core/settings.js'
import { LOCALE_ENV, resolveLocale, setLocale, t, type Locale } from './i18n/index.js'
import type { Terminal } from './ui/terminal.js'
import { runCommand } from './commands/run.js'

const BIN_NAME = 'ccset'
const VERSION: string = (packageJson as { version: string }).version

const INFO_FLAGS: Record<string, 'help' | 'version'> = {
  '-h': 'help',
  '--help': 'help',
  '-v': 'version',
  '--version': 'version',
}

interface CliOptions {
  agent?: string
}

function buildProgram(): Command {
  const program = new Command()
  program
    .name(BIN_NAME)
    .description(t('cli.description'))
    .version(VERSION, '-v, --version')
    .option('--agent <id>', t('cli.agentOption'))
    .allowExcessArguments(false)
  return program
}

/** Errors leave through stderr only: the TUI is gone by the time this runs. */
function fail(error: CcsetError): never {
  process.stderr.write(`${t(error.messageKey, error.params)}\n`)
  process.exit(error.exitCode)
}

/**
 * Ink degrades badly into a pipe, and a legible refusal beats emitting control
 * sequences into a log (PRD 5.6). Only the TUI asks this: a Non-interactive
 * command exists precisely to run without a terminal.
 */
function requireTty(): void {
  if (process.stdin.isTTY === true) return
  process.stderr.write(`${t('cli.notTty')}\n`)
  process.exit(EXIT_NOT_TTY)
}

function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H')
}

function resolveAgentId(requested: string | undefined): string | undefined {
  if (requested === undefined) return undefined
  if (findAgent(requested) === undefined) {
    fail(new CcsetError('error.unknownAgent', EXIT_RUNTIME, { id: requested }))
  }
  return requested
}

/** Help and version finish before anything else, TTY guard included. */
function requestedInfo(argv: string[]): 'help' | 'version' | null {
  return argv.map((token) => INFO_FLAGS[token]).find((info) => info !== undefined) ?? null
}

/** Launch mode is structural: a positional token means a command, none means TUI. */
function isCommandMode(argv: string[]): boolean {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? ''
    if (token === '--agent') {
      index += 1 // the agent value is not a positional
      continue
    }
    if (token.startsWith('--agent=')) continue
    if (!token.startsWith('-')) return true
  }
  return false
}

/** One standalone render; undefined means the user left without choosing. */
async function promptLanguage(terminal: Terminal): Promise<Locale | undefined> {
  // Imported here, not at the top, like the app below: command mode must never
  // load Ink, and the prompt is the one screen mounted before it.
  const [{ render }, { LanguageSelect }] = await Promise.all([
    import('ink'),
    import('./ui/Menu.js'),
  ])
  const React = (await import('react')).default
  return new Promise((resolve) => {
    let picked: Locale | undefined
    const instance = render(
      React.createElement(LanguageSelect, {
        terminal,
        onPick: (locale: Locale) => (picked = locale),
      }),
    )
    void instance.waitUntilExit().then(() => resolve(picked))
  })
}

/** How settling the locale ended: cancelled, or done and whether the choice saved. */
type Settled = { status: 'cancelled' } | { status: 'done'; persistFailed: boolean }

/**
 * ADR 0004's resolution order: the override beats the saved choice, the saved
 * choice beats the first-run prompt. Presence of CCSET_LOCALE is decided here
 * separately from its normalized value -- empty or unknown, it is still an
 * explicit English override, so it suppresses both the prompt and persistence.
 * Reading a durable preference out of the variable would turn one scripted run
 * into a silent permanent switch, so when it is set ccset never persists.
 */
async function settleLocale(home: string, terminal: Terminal): Promise<Settled> {
  if (process.env[LOCALE_ENV] !== undefined) return { status: 'done', persistFailed: false }
  const saved = await readSavedLocale(home)
  if (saved !== null) {
    setLocale(saved)
    return { status: 'done', persistFailed: false }
  }
  const picked = await promptLanguage(terminal)
  if (picked === undefined) return { status: 'cancelled' }
  setLocale(picked)
  try {
    await saveLocale(home, picked)
    return { status: 'done', persistFailed: false }
  } catch {
    // The choice stays active for this session either way; nothing is lost to
    // the failure. main() owns the warning, which only survives if it lands
    // after clearScreen().
    return { status: 'done', persistFailed: true }
  }
}

async function launchTui(): Promise<void> {
  const options = buildProgram().parse(process.argv).opts<CliOptions>()
  requireTty()
  // Imported here, not at the top: command mode must never load Ink, so a
  // scripted run cannot trip over it or paint an escape sequence by accident.
  const [{ render }, { App }, { resolveTerminal }] = await Promise.all([
    import('ink'),
    import('./ui/App.js'),
    import('./ui/terminal.js'),
  ])
  const React = (await import('react')).default
  const home = resolveHome()
  const terminal = resolveTerminal()
  // --help and --version returned during argument parsing, and commands exited
  // at the mode split, so only a TTY run reaches the settings file (ADR 0004).
  // The prompt runs regardless of --agent: it skips agent selection, which has
  // no bearing on language.
  const settled = await settleLocale(home, terminal)
  if (settled.status === 'cancelled') return
  clearScreen()
  // Held until after clearScreen(): painted earlier, the warn is wiped with
  // the prompt screen it belongs to. Still before the app mounts, so it reads
  // in the locale the user just chose.
  if (settled.persistFailed) {
    process.stderr.write(`${t('warn.localePersistFailed', { path: settingsFilePath(home) })}\n`)
  }
  const agentId = resolveAgentId(options.agent)
  const ctx = { home }
  // Task errors recover inside the app as a Screen on the stack; what still
  // escapes the render tree reaches main().catch, which restores nothing.
  const app = render(React.createElement(App, { ctx, agents: AGENTS, agentId, terminal }))
  await app.waitUntilExit()
}

async function main(): Promise<void> {
  // CCSET_LOCALE, like CCSET_HOME and CCSET_ASCII, is read once at this
  // boundary; every string below resolves in the selected locale.
  setLocale(resolveLocale())
  const argv = process.argv.slice(2)
  const info = requestedInfo(argv)
  if (info === 'version') {
    process.stdout.write(`${VERSION}\n`)
    return
  }
  if (info === 'help') {
    process.stdout.write(buildProgram().helpInformation())
    return
  }
  if (!isCommandMode(argv)) {
    await launchTui()
    return
  }
  // CCSET_TOKEN, like the overrides above, is read once at this boundary: the
  // parser learns only whether a token is present, and the secret reader its value.
  process.exit(await runCommand(argv, AGENTS, process.env['CCSET_TOKEN']))
}

main().catch((err: unknown) => fail(toCcsetError(err)))
