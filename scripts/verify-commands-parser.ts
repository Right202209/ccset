import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { parseCommand } from '../src/commands/parser.js'
import { CcsetError, EXIT_USAGE } from '../src/core/errors.js'
import type { CommandDeclaration } from '../src/operations/types.js'
import type { Agent } from '../src/types.js'
import { globalSettingsPath } from '../src/agents/claude-code/paths.js'
import { runCli, withHome } from './cli-harness.js'
import '../src/registry.js'

/**
 * The parser's own normalization contract, at the public boundary AGENTS.md
 * names for new behavior: an int field with no field validator still refuses a
 * value `Number()` cannot parse, and a following flag is never an option's
 * value. The first needs a declaration no agent ships (every shipped int field
 * carries a validator that rejects the same input earlier), so it runs against
 * a synthetic declaration through parseCommand; the second runs through the
 * built CLI like the other process-seam gates.
 */

const SYNTHETIC: CommandDeclaration = {
  id: 'global.set',
  fields: [{ id: 'count', option: '--count', type: 'int' }],
  patchRequired: true,
  presentation: { successTitleKey: () => 'write.globalSaved' },
  run: async () => {
    throw new Error('the parser must refuse before any run happens')
  },
}

const syntheticAgent: Agent = {
  id: 'synthetic',
  name: 'Synthetic',
  detect: async () => false,
  getActions: () => [],
  commands: { operations: [SYNTHETIC] },
}

function refusedParse(argv: string[]): CcsetError {
  try {
    parseCommand(argv, [syntheticAgent], undefined)
  } catch (err) {
    if (err instanceof CcsetError) return err
    throw err
  }
  throw new Error('the parser accepted a value its contract says it normalizes')
}

function checkIntNormalization(): void {
  // NaN must not reach the patch: the parser refuses where an optional
  // validator would not.
  const refused = refusedParse(['--agent', 'synthetic', 'global', 'set', '--count', 'abc'])
  assert.equal(refused.messageKey, 'cli.usage.notInteger', 'a NaN int was not the not-integer usage error')
  assert.equal(refused.exitCode, EXIT_USAGE, 'a NaN int was not a usage error')
  assert.equal(refused.params['option'], '--count')

  // The same field accepts what Number() parses, as a number.
  const accepted = parseCommand(['--agent', 'synthetic', 'global', 'set', '--count', '42'], [syntheticAgent], undefined)
  assert.equal(accepted.request.patch['count'], 42, 'a valid int did not normalize to a number')
}

async function checkFlagIsNeverAValue(home: string): Promise<void> {
  const target = globalSettingsPath(home)
  const refused = await runCli(
    ['--agent', 'claude-code', 'global', 'set', '--model', '--ccset-not-an-option'],
    { CCSET_HOME: home },
  )
  assert.equal(refused.code, EXIT_USAGE, 'a following flag became an option value')
  assert.match(refused.stderr, /--model needs a value/, 'the refusal was not the missing-value usage error')
  assert.equal(
    await fs.access(target).then(() => true, () => false),
    false,
    'the refused invocation wrote a settings file',
  )

  // The shorthand spelling takes its value from the same guarded reader.
  const inline = await runCli(['--agent', 'claude-code', 'global', 'set', '--model=x'], { CCSET_HOME: home })
  assert.equal(inline.code, 0, `an inline value was refused: ${inline.stderr}`)
}

async function main(): Promise<void> {
  checkIntNormalization()
  await withHome('parser-flag', checkFlagIsNeverAValue)
  process.stdout.write('Parser normalization verification passed.\n')
}

await main()
