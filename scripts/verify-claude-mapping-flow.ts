import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { projectSettingsPath, providerSettingsPath } from '../src/agents/claude-code/paths.js'
import { t } from '../src/i18n/index.js'
import type { FormScreen } from '../src/types.js'

export async function verifyClaudeMappingFlow(
  home: string,
  projectDir: string,
  providerScreen: FormScreen,
): Promise<void> {
  const target = projectSettingsPath(projectDir)
  const initial = `${JSON.stringify({ env: { ANTHROPIC_MODEL: 'existing-project-model' } }, null, 2)}\n`
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, initial)

  assert.equal(providerScreen.values['customModelMapping'], false)
  const modelField = providerScreen.fields.find((field) => field.id === 'model')
  assert.ok(modelField?.suggestions?.includes('claude-sonnet-4'))
  const disabled = await providerScreen.submit({
    ...providerScreen.values,
    customModelMapping: false,
  })
  assert.equal(disabled.kind, 'message')
  assert.equal(await fs.readFile(target, 'utf8'), initial)

  const mapping = await providerScreen.submit({
    ...providerScreen.values,
    customModelMapping: true,
  })
  assert.equal(mapping.kind, 'form')
  if (mapping.kind !== 'form') return
  assert.equal(mapping.title, t('claudeCode.action.projectModelMapping'))
  assert.equal(mapping.values['anthropicModel'], 'existing-project-model')
  assert.ok(mapping.notes?.includes(t('claudeCode.warning.modelMappingClaudeNames')))
  assert.ok(mapping.notes?.includes(t('claudeCode.note.projectModelMappingPath', { path: target })))
  assert.ok(mapping.notes?.includes(t('claudeCode.note.providerSavedBeforeMapping', {
    path: providerSettingsPath(home, String(providerScreen.values['name'] ?? '').trim()),
  })))
  assert.ok(mapping.fields.every((field) => field.suggestions?.includes('claude-sonnet-4')))
  assert.equal(mapping.busyLabel?.(mapping.values), t('app.busyWriting', { path: target }))
}
