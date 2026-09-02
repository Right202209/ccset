import { jsonFile } from '../../core/json-file.js'
import type { ManagedWrite } from '../../core/merge.js'
import { applyPlan, planTargets, readPatchBase } from '../../operations/commit.js'
import type {
  CommandDeclaration,
  CommandFieldSpec,
  OperationRequest,
  OperationResult,
} from '../../operations/types.js'
import type { Ctx } from '../../types.js'
import { GLOBAL_FIELDS } from './manifest.js'
import { backupsDir, opencodeConfigPath } from './paths.js'
import {
  opencodeStatusFindings,
  presentOpencodeStatus,
  readOpencodeStatus,
  type OpencodeStatusDto,
} from './status-dto.js'

/**
 * opencode's Non-interactive declarations. The one config document is the
 * target of every patch; the TUI's string coercions stay in the TUI Adapter.
 */

const GLOBAL_COMMAND_FIELDS: CommandFieldSpec[] = [
  { id: 'model', option: '--model', type: 'text', unsettable: true },
  { id: 'smallModel', option: '--small-model', type: 'text', unsettable: true },
  {
    id: 'share',
    option: '--share',
    type: 'choice',
    choices: ['manual', 'auto', 'disabled'],
    unsettable: true,
  },
  {
    id: 'autoupdate',
    option: '--autoupdate',
    type: 'choice',
    choices: ['true', 'false', 'notify'],
    unsettable: true,
  },
  { id: 'username', option: '--username', type: 'text', unsettable: true },
  { id: 'disabledProviders', option: '--disabled-provider', type: 'list', unsettable: true },
]

function managedPathOf(fieldId: string): string[] | undefined {
  return GLOBAL_FIELDS.find((field) => field.id === fieldId)?.path
}

/** `autoupdate` is `true | false | "notify"` in the schema -- real booleans. */
function autoupdateValue(raw: string): boolean | string {
  if (raw === 'true') return true
  if (raw === 'false') return false
  return raw
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
    writes.push({
      path,
      value:
        field.id === 'autoupdate'
          ? autoupdateValue(String(value))
          : Array.isArray(value)
            ? value
            : String(value),
    })
  }
  return writes
}

async function runGlobalSet(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const target = opencodeConfigPath(ctx.home)
  const file = jsonFile(target)
  const base = await readPatchBase(file, request.replaceInvalid)
  const outcome = await applyPlan(
    planTargets([{ file, base, writes: globalPatchWrites(request), backupsDir: backupsDir(ctx.home) }]),
    { dryRun: request.dryRun, skipUnchanged: true },
  )
  return {
    agent: 'opencode',
    operation: 'global.set',
    changed: outcome.changed,
    dryRun: request.dryRun,
    targets: outcome.records,
    warnings: [],
  }
}

/** Status reads the one document through the raw DTO and never writes. */
async function runStatus(ctx: Ctx, request: OperationRequest): Promise<OperationResult> {
  const data = await readOpencodeStatus(ctx)
  const { warnings, errors } = opencodeStatusFindings(data)
  return {
    agent: 'opencode',
    operation: 'status',
    changed: false,
    dryRun: request.dryRun,
    targets: [],
    warnings,
    errors,
    data: data as unknown as Record<string, unknown>,
  }
}

export const opencodeCommands: CommandDeclaration[] = [
  {
    id: 'global.set',
    fields: GLOBAL_COMMAND_FIELDS,
    patchRequired: true,
    replaceable: true,
    presentation: { successTitleKey: () => 'write.globalSaved' },
    run: runGlobalSet,
  },
  {
    id: 'status',
    fields: [],
    presentation: {
      successTitleKey: () => 'action.status',
      presentStatus: (data) => presentOpencodeStatus(data as unknown as OpencodeStatusDto),
    },
    run: runStatus,
  },
]
