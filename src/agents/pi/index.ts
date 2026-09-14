import type { Agent, Ctx } from '../../types.js'
import { fileExists } from '../../core/json-file.js'
import { piActions } from './actions.js'
import { piCommands } from './commands.js'
import { piMessages } from './messages.js'
import { authPath, modelsPath, piDir, settingsPath } from './paths.js'

/**
 * Detection is filesystem-only, for the reason the other agent modules give:
 * shelling out to `pi --version` is a cross-platform hazard for no gain, and
 * ccset can write this config before pi has ever run. Any one of the agent
 * directory, settings.json, models.json or auth.json counts as detection --
 * credentials alone mean there is a pi home here even with no ccset-managed
 * file yet.
 */
async function detect(ctx: Ctx): Promise<boolean> {
  const [dir, settings, models, auth] = await Promise.all([
    fileExists(piDir(ctx.home)),
    fileExists(settingsPath(ctx.home)),
    fileExists(modelsPath(ctx.home)),
    fileExists(authPath(ctx.home)),
  ])
  return dir || settings || models || auth
}

export { detect }

export const pi: Agent = {
  id: 'pi',
  name: 'pi',
  messages: piMessages,
  detect,
  getActions: piActions,
  commands: { operations: piCommands },
}
