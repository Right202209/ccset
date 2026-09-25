import type { ActionResult, Ctx, FieldSpec, FormValues } from '../../types.js'
import { ConfigParseError } from '../../core/errors.js'
import { runSave } from '../../core/save.js'
import { t } from '../../i18n/index.js'
import { projectSettingsPath } from './paths.js'
import { PROJECT_MODEL_MAPPING_FIELDS } from './manifest.js'
import { saveProjectModelMapping, seedProjectModelMapping } from './model-mappings.js'

function mappingFields(modelSuggestions: string[]): FieldSpec[] {
  if (modelSuggestions.length === 0) return PROJECT_MODEL_MAPPING_FIELDS
  return PROJECT_MODEL_MAPPING_FIELDS.map((field) => ({
    ...field,
    suggestions: modelSuggestions,
  }))
}

function notesForMapping(
  target: string,
  modelSuggestions: string[],
  providerPath: string | undefined,
): string[] {
  const notes = [t('claudeCode.note.projectModelMappingPath', { path: target }), t('note.preserved')]
  if (modelSuggestions.length > 0 && modelSuggestions.every((model) => model.toLowerCase().includes('claude'))) {
    notes.push(t('claudeCode.warning.modelMappingClaudeNames'))
  }
  if (providerPath !== undefined) {
    notes.push(t('claudeCode.note.providerSavedBeforeMapping', { path: providerPath }))
  }
  return notes
}

export async function openProjectModelMappingForm(
  ctx: Ctx,
  modelSuggestions: string[],
  providerPath?: string,
): Promise<ActionResult> {
  const projectDir = ctx.projectDir ?? ctx.home
  const target = projectSettingsPath(projectDir)
  let values: FormValues
  try {
    values = await seedProjectModelMapping(ctx)
  } catch (err) {
    if (!(err instanceof ConfigParseError)) throw err
    values = Object.fromEntries(PROJECT_MODEL_MAPPING_FIELDS.map((field) => [field.id, '']))
  }
  return {
    kind: 'form',
    title: t('claudeCode.action.projectModelMapping'),
    fields: mappingFields(modelSuggestions),
    values,
    baseline: { ...values },
    notes: notesForMapping(target, modelSuggestions, providerPath),
    busyLabel: () => t('app.busyWriting', { path: target }),
    submit: async (next: FormValues) =>
      runSave(
        'claudeCode.write.projectModelMappingSaved',
        (fresh) => saveProjectModelMapping(ctx, next, fresh),
        t('app.busyWriting', { path: target }),
      ),
  }
}
