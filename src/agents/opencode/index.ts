import type { Agent, Ctx } from '../../types.js'
import { fileExists } from '../../core/json-file.js'
import { opencodeActions } from './actions.js'
import { opencodeCommands } from './commands.js'
import { opencodeMessages } from './messages.js'
import { opencodeConfigPath, opencodeDir, opencodeJsoncPath } from './paths.js'

/**
 * Detection is filesystem-only, for the reason the Claude Code module gives:
 * shelling out to `opencode --version` is a cross-platform hazard for no gain,
 * and ccset can write this config before opencode has ever run.
 *
 * The JSONC variant counts as detection even though ccset will not write it --
 * an installed opencode is exactly the case where the user needs to be told
 * that file exists.
 */
async function detect(ctx: Ctx): Promise<boolean> {
  const [dir, config, jsonc] = await Promise.all([
    fileExists(opencodeDir(ctx.home)),
    fileExists(opencodeConfigPath(ctx.home)),
    fileExists(opencodeJsoncPath(ctx.home)),
  ])
  return dir || config || jsonc
}

export const opencode: Agent = {
  id: 'opencode',
  name: 'opencode',
  messages: opencodeMessages,
  detect,
  getActions: opencodeActions,
  commands: { operations: opencodeCommands },
}
