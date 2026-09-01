import type { Agent, Ctx } from '../../types.js'
import { fileExists } from '../../core/json-file.js'
import { claudeDir, claudeStatePath } from './paths.js'
import { claudeCodeActions } from './actions.js'
import { claudeCodeMessages } from './messages.js'

/**
 * Detection is filesystem-only. Shelling out to `claude --version` would be a
 * cross-platform hazard for no gain: ccset can configure Claude Code before it
 * has ever run, and an absent directory is not a reason to hide the menu.
 */
async function detect(ctx: Ctx): Promise<boolean> {
  const [dir, state] = await Promise.all([
    fileExists(claudeDir(ctx.home)),
    fileExists(claudeStatePath(ctx.home)),
  ])
  return dir || state
}

export const claudeCode: Agent = {
  id: 'claude-code',
  name: 'Claude Code',
  messages: claudeCodeMessages,
  detect,
  getActions: claudeCodeActions,
}
