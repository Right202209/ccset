import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { saveProvider } from '../src/agents/opencode/providers.js'
import { opencodeConfigPath } from '../src/agents/opencode/paths.js'
import { validateModelIds } from '../src/agents/opencode/manifest.js'
import type { FormValues, JsonObject } from '../src/types.js'

/**
 * H-1: an opencode model id is a JSON key, not a provider filename -- `gpt-4.1`,
 * `anthropic/claude-3.5-sonnet` and `llama3:8b` are all real. The provider-name
 * charset rejected every one of them, so this pins the validator and the TUI's
 * `saveProvider` boundary, which funnels through it.
 */

const API_KEY = 'OPENCODE-TEST-KEY-1234567890'
const REAL_IDS = [
  'gpt-4.1',
  'anthropic/claude-3.5-sonnet',
  'llama3:8b',
  'meta-llama/Llama-3.1-8B-Instruct',
]

function providerValues(models: string): FormValues {
  return {
    id: 'router',
    displayName: 'Test Router',
    baseUrl: 'https://router.example/v1',
    apiKey: API_KEY,
    npm: '@ai-sdk/anthropic',
    models,
    timeout: '',
  }
}

/** The prototype keys and a NUL stay rejected; every real id passes. */
export function verifyModelIdValidator(): void {
  for (const id of REAL_IDS) {
    assert.equal(validateModelIds(id), null, `the models list rejected the real id ${id}`)
  }
  assert.notEqual(
    validateModelIds('model\u0000id'),
    null,
    'the models list accepted a NUL, which would alias a managed path',
  )
}

export async function verifyRealModelIds(home: string): Promise<void> {
  await saveProvider({ home }, providerValues(REAL_IDS.join(', ')))
  const config = JSON.parse(await fs.readFile(opencodeConfigPath(home), 'utf8')) as JsonObject
  const provider = (config['provider'] as JsonObject)['router'] as JsonObject
  const models = provider['models'] as JsonObject
  for (const id of REAL_IDS) {
    assert.deepEqual(models[id], {}, `a real model id ${id} was not written`)
  }
}
