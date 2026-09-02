import React from 'react'
import { render } from 'ink'
import { Command } from 'commander'
import packageJson from '../package.json'
import { App } from './ui/App.js'
import { AGENTS, findAgent } from './registry.js'
import {
  CcsetError,
  EXIT_NOT_TTY,
  EXIT_RUNTIME,
  toCcsetError,
} from './core/errors.js'
import { resolveHome } from './core/paths.js'
import { resolveTerminal } from './ui/terminal.js'
import { resolveLocale, setLocale, t } from './i18n/index.js'
import type { Ctx } from './types.js'

const BIN_NAME = 'ccset'
const VERSION: string = (packageJson as { version: string }).version

interface CliOptions {
  agent?: string
}

function parseArgs(argv: string[]): CliOptions {
  const program = new Command()
  program
    .name(BIN_NAME)
    .description(t('cli.description'))
    .version(VERSION, '-v, --version')
    .option('--agent <id>', t('cli.agentOption'))
    .allowExcessArguments(false)
  program.parse(argv)
  return program.opts<CliOptions>()
}

/** Errors leave through stderr only: the TUI is gone by the time this runs. */
function fail(error: CcsetError): never {
  process.stderr.write(`${t(error.messageKey, error.params)}\n`)
  process.exit(error.exitCode)
}

/**
 * Ink degrades badly into a pipe, and a legible refusal beats emitting control
 * sequences into a log (PRD 5.6).
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

async function main(): Promise<void> {
  // CCSET_LOCALE, like CCSET_HOME and CCSET_ASCII, is read once at this
  // boundary; every string below resolves in the selected locale.
  setLocale(resolveLocale())
  const options = parseArgs(process.argv)
  requireTty()
  clearScreen()
  const agentId = resolveAgentId(options.agent)
  const ctx: Ctx = { home: resolveHome() }
  // Task errors recover inside the app as a Screen on the stack; what still
  // escapes the render tree reaches main().catch, which restores nothing.
  const app = render(
    <App ctx={ctx} agents={AGENTS} agentId={agentId} terminal={resolveTerminal()} />,
  )
  await app.waitUntilExit()
}

main().catch((err: unknown) => fail(toCcsetError(err)))
