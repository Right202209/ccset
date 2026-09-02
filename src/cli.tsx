import { Command } from 'commander'
import packageJson from '../package.json'
import { AGENTS, findAgent } from './registry.js'
import {
  CcsetError,
  EXIT_NOT_TTY,
  EXIT_RUNTIME,
  toCcsetError,
} from './core/errors.js'
import { resolveHome } from './core/paths.js'
import { resolveLocale, setLocale, t } from './i18n/index.js'
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

async function launchTui(): Promise<void> {
  const options = buildProgram().parse(process.argv).opts<CliOptions>()
  requireTty()
  clearScreen()
  const agentId = resolveAgentId(options.agent)
  const ctx = { home: resolveHome() }
  // Imported here, not at the top: command mode must never load Ink, so a
  // scripted run cannot trip over it or paint an escape sequence by accident.
  const [{ render }, { App }, { resolveTerminal }] = await Promise.all([
    import('ink'),
    import('./ui/App.js'),
    import('./ui/terminal.js'),
  ])
  const React = (await import('react')).default
  // Task errors recover inside the app as a Screen on the stack; what still
  // escapes the render tree reaches main().catch, which restores nothing.
  const app = render(
    React.createElement(App, {
      ctx,
      agents: AGENTS,
      agentId,
      terminal: resolveTerminal(),
    }),
  )
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
  process.exit(await runCommand(argv, AGENTS))
}

main().catch((err: unknown) => fail(toCcsetError(err)))
