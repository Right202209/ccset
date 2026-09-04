import { type ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type {
  CommandDeclaration,
  CommandFieldSpec,
  OperationRequest,
  OperationResult,
} from '../../operations/types.js'
import type { Ctx } from '../../types.js'
import { validateOptionalPositiveInt } from '../../core/validate.js'
import {
  APPROVAL_NEVER,
  APPROVAL_ON_REQUEST,
  SANDBOX_DANGER_FULL_ACCESS,
  SANDBOX_READ_ONLY,
  SANDBOX_WORKSPACE_WRITE,
  VERBOSITY_HIGH,
  VERBOSITY_LOW,
  VERBOSITY_MEDIUM,
} from './constants.js'
import { runProviderSet, PROVIDER_COMMAND_FIELDS } from './provider-commands.js'
import { runProviderUse, USE_COMMAND_FIELDS } from './provider-use.js'
import { codexConfigFile } from './global.js'
import { GLOBAL_FIELDS, INTEGER_FIELD_IDS, validateProviderId } from './manifest.js'
import { backupsDir, launchCommand } from './paths.js'
import { codexStatusFindings, readCodexStatus, type CodexStatusDto } from './status-dto.js'
import { presentCodexStatus } from './status-present.js'

/**
 * Codex's Non-interactive declarations. The one config document is edited by
 * the format-preserving TOML codec, so every patch lands inside the spans it
 * names and every comment, blank line and unmanaged key around it survives.
 * The provider operations live beside the sidecar logic they share in
 * provider-commands.ts.
 */

const GLOBAL_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'model', option: '--model', type: 'text', unsettable: true },
  { id: 'modelProvider', option: '--model-provider', type: 'text', unsettable: true },
  { id: 'reasoningEffort', option: '--reasoning-effort', type: 'text', unsettable: true },
  {
    id: 'approvalPolicy',
    option: '--approval-policy',
    type: 'choice',
    choices: [APPROVAL_ON_REQUEST, APPROVAL_NEVER],
    unsettable: true,
  },
  {
    id: 'sandboxMode',
    option: '--sandbox-mode',
    type: 'choice',
    choices: [SANDBOX_READ_ONLY, SANDBOX_WORKSPACE_WRITE, SANDBOX_DANGER_FULL_ACCESS],
    unsettable: true,
  },
  {
    id: 'verbosity',
    option: '--verbosity',
    type: 'choice',
    choices: [VERBOSITY_LOW, VERBOSITY_MEDIUM, VERBOSITY_HIGH],
    unsettable: true,
  },
  {
    id: 'contextWindow',
    option: '--context-window',
    type: 'int',
    validate: validateOptionalPositiveInt,
    unsettable: true,
  },
]

function managedPathOf(fieldId: string): string[] | undefined {
  return GLOBAL_FIELDS.find((field) => field.id === fieldId)?.path
}

/**
 * `model_context_window` is a TOML integer; writing "200000" would hand Codex
 * a string where its schema wants a number. Everything else here is a string.
 */
function globalPatchWrites(request: OperationRequest): ManagedWrite[] {
  const writes: ManagedWrite[] = []
  for (const field of GLOBAL_COMMAND_FIELDS) {
    const path = managedPathOf(field.id)
    if (path === undefined) continue
    if (request.unsets.includes(field.id)) {
      writes.push({ path, value: undefined })
      continue
    }
    const value = request.patch[field.id]
    if (value === undefined) continue
    writes.push({
      path,
      value: INTEGER_FIELD_IDS.has(field.id) ? Number(value) : String(value),
    })
  }
  return writes
}

async function runGlobalSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const file = codexConfigFile(ctx.home)
  const base = await readPatchBase(file, request.replaceInvalid)
  const outcome = await applyPlan(
    planTargets([{ file, base, writes: globalPatchWrites(request), backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return {
    agent: 'codex',
    operation: 'global.set',
    changed: outcome.changed,
    dryRun: request.dryRun,
    targets: outcome.records,
    warnings: [],
    launchCommand: launchCommand(),
    launchKey: 'codex.write.activate',
  }
}

/** Status reads everything through the raw DTO and never writes. */
async function runStatus(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const data = await readCodexStatus(ctx)
  const { warnings, errors } = codexStatusFindings(data)
  return {
    agent: 'codex',
    operation: 'status',
    changed: false,
    dryRun: request.dryRun,
    targets: [],
    warnings,
    errors,
    data: data as unknown as Record<string, unknown>,
  }
}

export const codexCommands: CommandDeclaration[] = [
  {
    id: 'global.set',
    fields: GLOBAL_COMMAND_FIELDS,
    patchRequired: true,
    replaceable: true,
    presentation: { successTitleKey: () => 'write.globalSaved' },
    run: runGlobalSet,
  },
  {
    id: 'provider.set',
    argument: 'providerId',
    fields: PROVIDER_COMMAND_FIELDS,
    takesSecret: true,
    replaceable: true,
    patchRequired: true,
    validateArgument: validateProviderId,
    presentation: { successTitleKey: () => 'codex.write.providerSaved' },
    run: runProviderSet,
  },
  {
    id: 'provider.use',
    argument: 'providerId',
    fields: USE_COMMAND_FIELDS,
    validateArgument: validateProviderId,
    presentation: { successTitleKey: () => 'codex.write.switched' },
    run: runProviderUse,
  },
  {
    id: 'status',
    fields: [],
    presentation: {
      successTitleKey: () => 'action.status',
      presentStatus: (data) => presentCodexStatus(data as unknown as CodexStatusDto),
    },
    run: runStatus,
  },
]
