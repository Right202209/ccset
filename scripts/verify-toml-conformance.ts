import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { applyTomlWrites, findTomlProblem, readTomlObject } from '../src/core/toml/index.js'
import type { JsonObject } from '../src/types.js'

function verifyBoundsAndArrayTables(): void {
  const path = `${Array.from({ length: 100_000 }, (_, index) => `k${index}`).join('.')} = 1\n`
  assert.notEqual(findTomlProblem(path), null, 'a 100,000-segment dotted key was accepted')
  const nested = `${'['.repeat(100_000)}0${']'.repeat(100_000)}`
  assert.notEqual(findTomlProblem(`value = ${nested}\n`), null, 'a 100,000-level array was accepted')

  const repeated = '[[a]]\nx = 1\n[a.b]\ny = 2\n[[a]]\nx = 3\n[a.b]\ny = 4\n'
  assert.equal(findTomlProblem(repeated), null, 'a subtable under each array-table instance was rejected')
  assert.deepEqual(readTomlObject(repeated), {
    a: [{ x: 1, b: { y: 2 } }, { x: 3, b: { y: 4 } }],
  })

  // A repeated array table clears only its own descendants. Many unrelated
  // keys plus many repeats is linear with the prefix index and quadratic if the
  // clear scans every recorded key instead.
  const unrelated = Array.from({ length: 20_000 }, (_, index) => `k${index} = ${index}\n`).join('')
  const repeats = Array.from({ length: 20_000 }, () => '[[a]]\n').join('')
  assert.equal(findTomlProblem(`${unrelated}\n${repeats}`), null, 'a large repeated array table was misjudged')
}

function oracleCases(): Array<{ name: string; text: string; valid: boolean }> {
  const invalid = Object.entries({
    leadingZero: 'a = 00\n',
    leadingZeroAfterUnderscore: 'a = 0_1\n',
    repeatedUnderscore: 'a = 1__0\n',
    signedRadix: 'a = +0x1\n',
    impossibleDate: 'a = 1979-13-45\n',
    duplicateInlineKey: 'a = { key = 1, key = 2 }\n',
    bareCarriageReturn: 'a = 1\rb = 2\n',
    badQuotedKeyEscape: '"bad\\q" = 1\n',
    badInlineKeyEscape: 'a = { "bad\\q" = 1 }\n',
    controlComment: '# invalid \u0001\na = 1\n',
  }).map(([name, text]) => ({ name, text, valid: false }))
  return [
    ...invalid,
    { name: 'spaceDateTimeOffset', text: 'a = 1979-05-27 07:32:00+01:00\n', valid: true },
    { name: 'arrayTableSubtables', text: '[[a]]\nx=1\n[a.b]\ny=2\n[[a]]\nx=3\n[a.b]\ny=4\n', valid: true },
  ]
}

/**
 * Tokens ccset accepts on purpose that Python 3's TOML 1.0 `tomllib` rejects:
 * the TOML 1.1 `\e` escape, and RFC 3339's leap second and year 0000. The
 * checker follows the Agents' parsers rather than a 1.0-only oracle, so these
 * are pinned against ccset alone and must still round-trip byte for byte.
 */
function extensionCases(): Array<{ name: string; text: string }> {
  return [
    { name: 'toml11Escape', text: 'a = "\\e"\n' },
    { name: 'leapSecond', text: 'a = 00:00:60\n' },
    { name: 'yearZero', text: 'a = 0000-01-01\n' },
  ]
}

function pythonOracle(cases: Array<{ text: string }>): boolean[] | undefined {
  const script = [
    'import json,sys,tomllib',
    'def valid(text):',
    ' try:',
    '  tomllib.loads(text)',
    '  return True',
    ' except tomllib.TOMLDecodeError:',
    '  return False',
    'print(json.dumps([valid(item["text"]) for item in json.load(sys.stdin)]))',
  ].join('\n')
  const runners = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python']
  for (const runner of runners) {
    const result = spawnSync(runner, ['-c', script], { input: JSON.stringify(cases), encoding: 'utf8' })
    if (result.error !== undefined && 'code' in result.error && result.error.code === 'ENOENT') continue
    assert.equal(result.status, 0, `Python tomllib oracle failed: ${result.stderr}`)
    return JSON.parse(result.stdout) as boolean[]
  }
  return undefined
}

function verifyStrictOracle(): void {
  const cases = oracleCases()
  const oracle = pythonOracle(cases)
  cases.forEach((entry, index) => {
    assert.equal(findTomlProblem(entry.text) === null, entry.valid, `ccset TOML mismatch: ${entry.name}`)
    if (entry.valid) assert.equal(applyTomlWrites(entry.text, []), entry.text, `TOML round trip changed ${entry.name}`)
    if (oracle !== undefined) assert.equal(oracle[index], entry.valid, `tomllib mismatch: ${entry.name}`)
  })
  for (const entry of extensionCases()) {
    assert.equal(findTomlProblem(entry.text), null, `a deliberate TOML extension was rejected: ${entry.name}`)
    assert.equal(applyTomlWrites(entry.text, []), entry.text, `TOML round trip changed ${entry.name}`)
  }
  assert.equal(readTomlObject('a = "\\e"\n')['a'], '\u001b', 'the \\e escape did not decode to ESC')
}

function verifyExistingRepresentations(): void {
  const wire = [{ path: ['model_providers', 'router', 'wire_api'], value: 'responses' }]
  const inline = applyTomlWrites(
    'unrelated = "keep"\nmodel_providers = { router = { name = "R", base_url = "https://a/v1" } }\n',
    wire,
  )
  assert.equal(inline.includes('[model_providers'), false)
  assert.equal(findTomlProblem(inline), null, `inline resolution produced invalid TOML:\n${inline}`)
  const inlineData = readTomlObject(inline) as JsonObject
  const inlineRouter = (inlineData['model_providers'] as JsonObject)['router'] as JsonObject
  assert.equal(inlineRouter['wire_api'], 'responses')
  assert.equal(inlineRouter['name'], 'R')
  assert.equal(inlineData['unrelated'], 'keep')

  const dotted = applyTomlWrites(
    'model_providers.router.name = "R"\nmodel_providers.router.base_url = "https://a/v1"\n',
    wire,
  )
  assert.equal(dotted.includes('[model_providers'), false)
  assert.equal(findTomlProblem(dotted), null, `dotted resolution produced invalid TOML:\n${dotted}`)
  const dottedRouter = ((readTomlObject(dotted)['model_providers'] as JsonObject)['router'] as JsonObject)
  assert.equal(dottedRouter['wire_api'], 'responses')
  assert.equal(dottedRouter['name'], 'R')

  const header = applyTomlWrites(
    '[model_providers]\nrouter = { name = "R" }\nother_key = true\n',
    [{ path: ['model_providers', 'router', 'base_url'], value: 'https://b/v1' }],
  )
  assert.equal(header.includes('[model_providers.router'), false)
  assert.equal(findTomlProblem(header), null, `header+inline resolution produced invalid TOML:\n${header}`)
  const section = readTomlObject(header)['model_providers'] as JsonObject
  assert.equal(section['other_key'], true)
  assert.deepEqual(section['router'], { name: 'R', base_url: 'https://b/v1' })
}

export function verifyTomlConformance(): void {
  verifyBoundsAndArrayTables()
  verifyStrictOracle()
  verifyExistingRepresentations()
}
