import assert from 'node:assert/strict'
import { renderConfigFile, type LoadedConfig } from '../src/core/config-file.js'
import { CcsetError } from '../src/core/errors.js'
import { setTomlPath } from '../src/core/toml/edit.js'
import { configFile } from '../src/agents/grok-build/paths.js'

export function verifyTomlRenderSafety(): void {
  const scalar = 'model = "grok-4"\n'
  assert.throws(
    () => setTomlPath(scalar, ['model', 'myprov', 'api_key'], 'placeholder'),
    (error: Error) => error instanceof CcsetError && error.messageKey === 'error.tomlValueParent',
    'a TOML table was inserted below a scalar value',
  )

  const malformedBase: LoadedConfig = {
    path: '/scratch/config.toml',
    exists: true,
    data: {},
    raw: 'model = "unterminated\n',
  }
  assert.throws(
    () => renderConfigFile(configFile('/scratch/config.toml'), malformedBase, []),
    (error: Error) => error instanceof CcsetError && error.messageKey === 'error.renderedConfigInvalid',
    'a rendered TOML document bypassed strict validation',
  )
}
