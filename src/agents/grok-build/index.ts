import type { Agent, Ctx } from '../../types.js'
import { fileExists } from '../../core/json-file.js'
import { grokBuildActions } from './actions.js'
import { grokBuildCommands } from './commands.js'
import { grokBuildMessages } from './messages.js'
import { authPath, configPath, grokDir } from './paths.js'

/**
 * Detection is filesystem-only, for the reason the other agent modules give:
 * shelling out to `grok --version` is a cross-platform hazard for no gain. An
 * explicit --agent still supports a first configuration when no Grok Build
 * files exist. Any one of the agent directory, config.toml or auth.json counts
 * as detection -- credentials alone mean there is a Grok home here even with
 * no ccset-managed file yet.
 */
async function detect(ctx: Ctx): Promise<boolean> {
  const [dir, config, auth] = await Promise.all([
    fileExists(grokDir(ctx.home)),
    fileExists(configPath(ctx.home)),
    fileExists(authPath(ctx.home)),
  ])
  return dir || config || auth
}

export { detect }

export const grokBuild: Agent = {
  id: 'grok-build',
  name: 'Grok Build',
  messages: grokBuildMessages,
  detect,
  getActions: grokBuildActions,
  commands: { operations: grokBuildCommands },
}
