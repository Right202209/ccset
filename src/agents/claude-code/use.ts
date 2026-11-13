import { jsonFile } from '../../core/json-file.js'
import { getStringAt } from '../../core/merge.js'
import { readPatchBase } from '../../operations/commit.js'
import { ValidationError } from '../../core/errors.js'
import { validateBaseUrl } from '../../core/validate.js'
import type { CommandDeclaration, OperationRequest, OperationResult } from '../../operations/types.js'
import type { Ctx } from '../../types.js'
import { PROVIDER_BASE_URL_PATH, PROVIDER_TOKEN_PATH, validateProviderName } from './manifest.js'
import { activationCommand, providerSettingsPath } from './paths.js'

async function prepareSession(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const target = providerSettingsPath(ctx.home, request.providerId ?? '')
  const base = await readPatchBase(jsonFile(target), false)
  const baseUrl = getStringAt(base.data, PROVIDER_BASE_URL_PATH)
  if (!base.exists || !baseUrl || validateBaseUrl(baseUrl) !== null) {
    throw new ValidationError('claudeCode.validate.sessionProvider')
  }
  if (!getStringAt(base.data, PROVIDER_TOKEN_PATH)) {
    throw new ValidationError('claudeCode.validate.sessionToken')
  }
  return {
    agent: 'claude-code', operation: request.operation, providerId: request.providerId,
    changed: false, dryRun: request.dryRun, targets: [], warnings: [],
    activation: 'session', launchCommand: activationCommand(target),
    launch: { executable: 'claude', args: ['--settings', target] },
  }
}

export const claudeSessionCommands: CommandDeclaration[] = ['provider.use', 'provider.run'].map((id) => ({
  id: id as 'provider.use' | 'provider.run', argument: 'providerId', fields: [],
  dryRunnable: true, validateArgument: validateProviderName,
  presentation: { successTitleKey: () => 'claudeCode.write.sessionReady' },
  run: prepareSession,
}))
