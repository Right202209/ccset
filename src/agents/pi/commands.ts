import type { ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type {
  CommandDeclaration,
  CommandFieldSpec,
  OperationRequest,
  OperationResult,
} from '../../operations/types.js'
import type { Ctx } from '../../types.js'
import { THINKING_LEVELS } from './constants.js'
import { GLOBAL_FIELDS, validateProviderId } from './manifest.js'
import { piOperationResult } from './result.js'
import { runProviderSet, PROVIDER_COMMAND_FIELDS } from './provider-commands.js'
import { USE_COMMAND_FIELDS, runProviderUse } from './use.js'
import { backupsDir, settingsFile } from './paths.js'
import {
  fromStatusData,
  piStatusFindings,
  presentPiStatus,
  readPiStatus,
  toStatusData,
} from './status-dto.js'

/**
 * pi's Non-interactive declarations. Each operation owns one document --
 * provider.set writes models.json, global.set and provider.use write
 * settings.json -- so no operation needs a multi-file commit. The TUI's
 * string coercions stay in the TUI Adapter.
 */

const GLOBAL_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'defaultProvider', option: '--provider', type: 'text', unsettable: true },
  { id: 'defaultModel', option: '--model', type: 'text', unsettable: true },
  {
    id: 'defaultThinkingLevel',
    option: '--thinking-level',
    type: 'choice',
    choices: [...THINKING_LEVELS],
    unsettable: true,
  },
]

function managedPathOf(fieldId: string): string[] | undefined {
  return GLOBAL_FIELDS.find((field) => field.id === fieldId)?.path
}

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
    writes.push({ path, value: String(value) })
  }
  return writes
}

async function runGlobalSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const file = settingsFile(ctx.home)
  const base = await readPatchBase(file, request.replaceInvalid)
  const outcome = await applyPlan(
    planTargets([{ file, base, writes: globalPatchWrites(request), backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return piOperationResult({ operation: 'global.set', request, outcome })
}

/** Status reads the managed documents through the raw DTO and never writes. */
async function runStatus(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const data = await readPiStatus(ctx)
  const { warnings, errors } = piStatusFindings(data)
  return {
    agent: 'pi',
    operation: 'status',
    changed: false,
    dryRun: request.dryRun,
    targets: [],
    warnings,
    errors,
    data: toStatusData(data),
  }
}

export const piCommands: CommandDeclaration[] = [
  {
    id: 'global.set',
    fields: GLOBAL_COMMAND_FIELDS,
    patchRequired: true,
    replaceable: true,
    dryRunnable: true,
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
    dryRunnable: true,
    validateArgument: validateProviderId,
    presentation: { successTitleKey: () => 'pi.write.providerSaved' },
    run: runProviderSet,
  },
  {
    id: 'provider.use',
    argument: 'providerId',
    fields: USE_COMMAND_FIELDS,
    replaceable: true,
    dryRunnable: true,
    validateArgument: validateProviderId,
    presentation: { successTitleKey: () => 'pi.write.switched' },
    run: runProviderUse,
  },
  {
    id: 'status',
    fields: [],
    presentation: {
      successTitleKey: () => 'action.status',
      presentStatus: (data) => presentPiStatus(fromStatusData(data)),
    },
    run: runStatus,
  },
]
