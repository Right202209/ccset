import type { Agent, Ctx } from '../../types.js'
import { fileExists } from '../../core/json-file.js'
import { codexActions } from './actions.js'
import { codexMessages } from './messages.js'
import { codexAuthPath, codexConfigPath, codexDir } from './paths.js'

/**
 * Detection is filesystem-only, for the reason the other two modules give:
 * shelling out to `codex --version` is a cross-platform hazard for no gain, and
 * ccset can write this config before Codex has ever run.
 *
 * `auth.json` counts on its own. A user who has logged in to Codex but never
 * edited config.toml has the directory and the credential and no settings file,
 * and that is exactly the person this module is for.
 */
async function detect(ctx: Ctx): Promise<boolean> {
  const [dir, config, auth] = await Promise.all([
    fileExists(codexDir(ctx.home)),
    fileExists(codexConfigPath(ctx.home)),
    fileExists(codexAuthPath(ctx.home)),
  ])
  return dir || config || auth
}

export const codex: Agent = {
  id: 'codex',
  name: 'Codex CLI',
  messages: codexMessages,
  detect,
  getActions: codexActions,
}
