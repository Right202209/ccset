import type { Ctx } from '../../types.js'
import type { ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type {
  CommandDeclaration,
  CommandFieldSpec,
  OperationRequest,
  OperationResult,
} from '../../operations/types.js'
import { GLOBAL_FIELDS, validateProviderId } from './manifest.js'
import { grokOperationResult } from './result.js'
import {
  PROVIDER_COMMAND_FIELDS,
  runProviderSet,
  runStatus,
} from './provider-commands.js'
import { runProviderUse } from './use.js'
import { backupsDir, configFile } from './paths.js'
import { fromStatusData, presentGrokStatus } from './status-dto.js'

/**
 * Grok Build's Non-interactive declarations. Every operation owns one document
 * -- config.toml -- so no operation needs a multi-file commit. The TUI's
 * string coercions stay in the TUI Adapter.
 */

const GLOBAL_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'defaultModel', option: '--model', type: 'text', unsettable: true },
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
  const file = configFile(ctx.home)
  const base = await readPatchBase(file, request.replaceInvalid)
  const outcome = await applyPlan(
    planTargets([
      { file, base, writes: globalPatchWrites(request), backupsDir: backupsDir(ctx.home) },
    ]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return grokOperationResult({ operation: 'global.set', request, outcome })
}

export const grokBuildCommands: CommandDeclaration[] = [
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
    presentation: { successTitleKey: () => 'grokBuild.write.providerSaved' },
    run: runProviderSet,
  },
  {
    id: 'provider.use',
    argument: 'providerId',
    fields: [],
    replaceable: true,
    dryRunnable: true,
    validateArgument: validateProviderId,
    presentation: { successTitleKey: () => 'grokBuild.write.switched' },
    run: runProviderUse,
  },
  {
    id: 'status',
    fields: [],
    presentation: {
      successTitleKey: () => 'action.status',
      presentStatus: (data) => presentGrokStatus(fromStatusData(data)),
    },
    run: runStatus,
  },
]
