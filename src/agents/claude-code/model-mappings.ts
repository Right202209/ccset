import type { Ctx, FormValues, JsonObject, WriteReport } from '../../types.js'
import path from 'node:path'
import { ConfigParseError } from '../../core/errors.js'
import { configFile, readConfigFile } from '../../core/config-file.js'
import { getPath, type ManagedWrite } from '../../core/merge.js'
import { commitOne, readPatchBase } from '../../operations/commit.js'
import { backupsDirFor } from '../../core/paths.js'
import { jsonToText, textOrUndefined } from '../../core/values.js'
import { t } from '../../i18n/index.js'
import { PROJECT_MODEL_MAPPING_FIELDS } from './manifest.js'
import { projectSettingsPath } from './paths.js'

function projectDir(ctx: Ctx): string {
  return ctx.projectDir ?? ctx.home
}

function projectModelFile(ctx: Ctx) {
  return configFile(projectSettingsPath(projectDir(ctx)), 'json')
}

export async function seedProjectModelMapping(ctx: Ctx): Promise<FormValues> {
  const file = projectModelFile(ctx)
  let data: JsonObject = {}
  try {
    data = (await readConfigFile(file)).data
  } catch (err) {
    if (!(err instanceof ConfigParseError)) throw err
  }
  return Object.fromEntries(
    PROJECT_MODEL_MAPPING_FIELDS.map((field) => [
      field.id,
      field.path === undefined ? '' : jsonToText(getPath(data, field.path)),
    ]),
  )
}

function projectModelWrites(values: FormValues): ManagedWrite[] {
  return PROJECT_MODEL_MAPPING_FIELDS.flatMap((field) => {
    if (field.path === undefined) return []
    return [{ path: field.path, value: textOrUndefined(values[field.id]) }]
  })
}

export async function saveProjectModelMapping(
  ctx: Ctx,
  values: FormValues,
  startFresh = false,
): Promise<WriteReport> {
  const file = projectModelFile(ctx)
  const report = await commitOne({
    file,
    base: await readPatchBase(file, startFresh),
    writes: projectModelWrites(values),
    backupsDir: backupsDirFor(path.dirname(file.path)),
  })
  return {
    ...report,
    activateKey: 'claudeCode.write.projectModelMappingActivate',
    command: t('claudeCode.write.projectModelMappingReload'),
  }
}
