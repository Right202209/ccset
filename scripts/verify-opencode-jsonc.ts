import assert from 'node:assert/strict'
import { findNodeAtLocation, parseTree } from 'jsonc-parser'
import { applyJsoncWrites, findJsoncProblem, readJsoncObject } from '../src/core/jsonc/index.js'
import type { JsonObject, JsonValue } from '../src/types.js'

/**
 * The JSONC codec, on its own. Not a gate with an npm script: it runs inside
 * verify:opencode, the way verify-toml-codec runs inside verify:codex, because
 * opencode is the only agent that uses it and splitting the file is what keeps
 * both inside the 300-line limit.
 *
 * U6 is the question this answers: can the file opencode itself prefers -- the
 * .jsonc it seeds on fresh installs -- be round-tripped without losing
 * comments, key order and formatting? Until it could, "unmanaged keys survive"
 * was not promisable for the default opencode install (issue #46).
 */

/** Documents that must survive an empty write list byte for byte. */
const CORPUS: Record<string, string> = {
  comments: '{\n  // leading\n  "theme": "gruvbox",  // attached\n\n  // dangling\n  "tweak": 1,\n}\n',
  trailingCommas: '{\n  "a": 1,\n  "list": [1, 2,],\n  "tweak": "x",\n}\n',
  crlf: '{\r\n  // c\r\n  "a": 1,\r\n  "tweak": 2\r\n}\r\n',
  noTrailingNewline: '{\n  "a": 1,\n  "tweak": 2\n}',
  nested: '{\n  "deep": {\n    // inside\n    "leaf": true,\n    "tweak": 1\n  },\n}\n',
  arrays: '{\n  "name": "x",\n  "inline": [1, 2, 3],\n  "spread": [\n    "one",  // first\n    "two",\n  ],\n}\n',
  emptyish: '{\n  "nil": {},\n  "blank": [],\n  "expanded": {\n  },\n  "tweak": 1,\n}\n',
  escapedStrings:
    '{\n  "url": "https://example.com/#frag",\n  "esc": "tab\\there \\"quoted\\" \\\\ ok",\n  "uni": "\\u00e9",\n  "tweak": 1\n}\n',
  schemaSeed: '{\n  "$schema": "https://opencode.ai/config.json"\n}\n',
  managedKeys: `{
  // user comment
  "$schema": "https://opencode.ai/config.json",
  "theme": "tokyonight",
  "model": "router/claude-sonnet-5",
  "small_model": "router/haiku",
  "share": "disabled",
  "autoupdate": false,
  "username": "me",
  "disabled_providers": ["openai"],
  "keybinds": { "leader": "ctrl+x" },
  "provider": {
    "router": {
      "name": "Router",
      "npm": "@ai-sdk/anthropic",
      "options": { "baseURL": "https://old.example", "headers": { "x-custom": "keep" } },
      "models": { "model-keep": { "options": { "temperature": 0.2 } } }
    }
  },
}
`,
}

/** The scalar each document carries, so every one takes the same edit. */
const TWEAK_PATH: Record<string, string[]> = {
  comments: ['tweak'],
  trailingCommas: ['tweak'],
  crlf: ['tweak'],
  noTrailingNewline: ['tweak'],
  nested: ['deep', 'tweak'],
  arrays: ['name'],
  emptyish: ['tweak'],
  escapedStrings: ['tweak'],
  schemaSeed: ['$schema'],
  managedKeys: ['username'],
}

function verifyRoundTrip(): void {
  for (const [name, text] of Object.entries(CORPUS)) {
    assert.equal(applyJsoncWrites(text, []), text, `U6: an unedited round trip changed ${name}`)
    assert.equal(findJsoncProblem(text), null, `U6: valid JSONC reported malformed in ${name}`)
  }
  assert.equal(findJsoncProblem('   \n  '), null, 'a whitespace-only document is sound')
}

function verifyReads(): void {
  assert.deepEqual(readJsoncObject(CORPUS['trailingCommas'] ?? ''), {
    a: 1,
    list: [1, 2],
    tweak: 'x',
  })
  assert.equal(readJsoncObject(CORPUS['comments'] ?? '')['theme'], 'gruvbox')
  assert.equal(readJsoncObject(CORPUS['crlf'] ?? '')['a'], 1, 'a CRLF document did not read')
  assert.deepEqual(readJsoncObject(CORPUS['emptyish'] ?? '')['blank'], [])
  assert.equal(
    readJsoncObject(CORPUS['escapedStrings'] ?? '')['esc'],
    'tab\there "quoted" \\ ok',
    'escapes did not read back',
  )
  assert.equal(readJsoncObject(CORPUS['schemaSeed'] ?? '')['$schema'], 'https://opencode.ai/config.json')
  const managed = readJsoncObject(CORPUS['managedKeys'] ?? '')
  assert.equal(managed['autoupdate'], false, 'a boolean was coerced')
  assert.deepEqual(managed['disabled_providers'], ['openai'])
  const provider = managed['provider'] as JsonObject
  const router = provider['router'] as JsonObject
  assert.deepEqual((router['options'] as JsonObject)['headers'], { 'x-custom': 'keep' })
}

/**
 * Setting an existing key touches its value span and nothing around it. The
 * expected bytes are computed from the parse tree, so the assertion is
 * byte-exact for every corpus document, not a hand-picked few.
 */
function verifyReplace(): void {
  for (const [name, text] of Object.entries(CORPUS)) {
    const path = TWEAK_PATH[name] ?? []
    const root = parseTree(text, [], { allowTrailingComma: true })
    if (root === undefined) throw new Error(`corpus ${name} did not parse`)
    const node = findNodeAtLocation(root, path)
    if (node === undefined) throw new Error(`corpus ${name} has no tweak key`)
    const out = applyJsoncWrites(text, [{ path, value: 'replaced' }])
    const expected = `${text.slice(0, node.offset)}"replaced"${text.slice(node.offset + node.length)}`
    assert.equal(out, expected, `U6: a replacement in ${name} disturbed bytes it does not own`)
    assert.equal(findJsoncProblem(out), null, `U6: a replacement in ${name} produced invalid JSONC`)
  }
  const src = '{ "a"   : 1   // keep\n, "b": 2 }'
  const out = applyJsoncWrites(src, [{ path: ['a'], value: 9 }])
  assert.equal(out, '{ "a"   : 9   // keep\n, "b": 2 }', 'a replacement disturbed its own line')
}

function verifyInsert(): void {
  const expanded = '{\n  "one": 1\n}\n'
  assert.equal(
    applyJsoncWrites(expanded, [{ path: ['two'], value: 2 }]),
    '{\n  "one": 1,\n  "two": 2\n}\n',
    'an insert into an expanded object misplaced the line',
  )
  assert.equal(
    applyJsoncWrites('{"one": 1}', [{ path: ['two'], value: 2 }]),
    '{"one": 1, "two": 2}',
    'an insert into an inline object broke the line',
  )
  assert.equal(
    applyJsoncWrites('{\n  "one": 1,\n}\n', [{ path: ['two'], value: 2 }]),
    '{\n  "one": 1,\n  "two": 2,\n}\n',
    'a trailing comma was not reused',
  )
  const deep = applyJsoncWrites('{\n  "keep": 1\n}\n', [
    { path: ['provider', 'r', 'options', 'baseURL'], value: 'https://x' },
  ])
  assert.deepEqual(readJsoncObject(deep)['provider'], {
    r: { options: { baseURL: 'https://x' } },
  })
  assert.deepEqual(readJsoncObject(deep)['keep'], 1, 'a deep insert displaced a sibling')
  assert.equal(findJsoncProblem(deep), null, 'a deep insert produced invalid JSONC')
  assert.equal(
    applyJsoncWrites(CORPUS['emptyish'] ?? '', [{ path: ['expanded', 'x'], value: 1 }]),
    '{\n  "nil": {},\n  "blank": [],\n  "expanded": {\n    "x": 1\n  },\n  "tweak": 1,\n}\n',
    'an expanded empty object did not take the child on its own line',
  )
  assert.equal(applyJsoncWrites('{}', [{ path: ['a'], value: 1 }]), '{"a": 1}')
  assert.equal(
    applyJsoncWrites(CORPUS['schemaSeed'] ?? '', [{ path: ['model'], value: 'router/x' }]),
    '{\n  "$schema": "https://opencode.ai/config.json",\n  "model": "router/x"\n}\n',
    'the seeded $schema shape did not grow naturally',
  )
  assert.equal(
    applyJsoncWrites('', [{ path: ['model'], value: 'm' }]),
    '{\n  "model": "m"\n}\n',
    'an empty document was not created like a missing one',
  )
}

function verifyDelete(): void {
  const three = '{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}\n'
  assert.equal(applyJsoncWrites(three, [{ path: ['b'], value: undefined }]), '{\n  "a": 1,\n  "c": 3\n}\n')
  assert.equal(applyJsoncWrites(three, [{ path: ['c'], value: undefined }]), '{\n  "a": 1,\n  "b": 2\n}\n')
  assert.equal(applyJsoncWrites(three, [{ path: ['a'], value: undefined }]), '{\n  "b": 2,\n  "c": 3\n}\n')
  const commented = '{\n  "a": 1,\n  "b": 2, // goes with the key\n  "c": 3\n}\n'
  assert.equal(
    applyJsoncWrites(commented, [{ path: ['b'], value: undefined }]),
    '{\n  "a": 1,\n  "c": 3\n}\n',
    'a trailing comment did not go with its key',
  )
  const dangling = '{\n  "a": 1,\n  // dangling\n  "b": 2\n}\n'
  assert.equal(
    applyJsoncWrites(dangling, [{ path: ['b'], value: undefined }]),
    '{\n  "a": 1,\n  // dangling\n}\n',
    'a dangling comment was removed with its neighbour',
  )
  assert.equal(applyJsoncWrites('{"a": 1}', [{ path: ['a'], value: undefined }]), '{}')
  assert.equal(
    applyJsoncWrites('{\n  "a": 1\n}\n', [{ path: ['a'], value: undefined }]),
    '{\n}\n',
    'a line-leading only child left its line behind',
  )
  const chain = '{\n  "provider": {\n    "r": { "models": { "m1": {} } },\n    "keep": 1\n  }\n}\n'
  const emptied = applyJsoncWrites(chain, [{ path: ['provider', 'r', 'models', 'm1'], value: undefined }])
  assert.equal(
    emptied,
    '{\n  "provider": {\n    "keep": 1\n  }\n}\n',
    'containers emptied along the deleted path did not collapse',
  )
  assert.equal(
    applyJsoncWrites(three, [{ path: ['absent'], value: undefined }]),
    three,
    'deleting a key that is not there changed the document',
  )
  assert.equal(findJsoncProblem(emptied), null, 'a delete produced invalid JSONC')
}

/** Values ccset writes are escaped, not concatenated into the document. */
function verifyEscaping(): void {
  const out = applyJsoncWrites('{}', [
    { path: ['s'], value: 'quote " backslash \\ newline \n' },
    { path: ['n'], value: 42 },
    { path: ['b'], value: true },
    { path: ['l'], value: ['a', 'b'] },
  ])
  assert.equal(findJsoncProblem(out), null, `escaping produced invalid JSONC:\n${out}`)
  const data = readJsoncObject(out)
  assert.equal(data['s'], 'quote " backslash \\ newline \n', 'a string did not survive escaping')
  assert.equal(data['n'], 42)
  assert.equal(data['b'], true, 'a boolean was written as a string')
  assert.deepEqual(data['l'], ['a', 'b'])
}

/** Editing a document repeatedly must converge, not accumulate. */
function verifyIdempotent(): void {
  for (const [name, text] of Object.entries(CORPUS)) {
    const writes: { path: string[]; value: JsonValue | undefined }[] = [
      { path: TWEAK_PATH[name] ?? [], value: 'again' },
      { path: ['provider', 'router', 'options', 'baseURL'], value: 'https://again.example' },
    ]
    const once = applyJsoncWrites(text, writes)
    assert.equal(applyJsoncWrites(once, writes), once, `U6: a repeated save was not idempotent in ${name}`)
  }
}

/** A file ccset cannot read is reported, never edited on a guess. */
function verifyMalformedDetected(): void {
  const broken: Record<string, string> = {
    missingValue: '{ "a": }',
    missingColon: '{ "a" 1 }',
    singleQuotes: '{ "a": "x", \'b\': 2 }',
    bareWord: '{ a: 1 }',
    nanValue: '{ "a": NaN }',
    unterminatedString: '{ "a": "no end }',
    unclosedObject: '{ "a": 1',
    unclosedArray: '{ "a": [1, 2 }',
    junkAfterValue: '{ "a": 1 } junk',
    badEscape: '{ "a": "\\x" }',
  }
  for (const [name, text] of Object.entries(broken)) {
    assert.notEqual(findJsoncProblem(text), null, `malformed JSONC went undetected: ${name}`)
  }
}

export function verifyJsoncCodec(): void {
  verifyRoundTrip()
  verifyReads()
  verifyReplace()
  verifyInsert()
  verifyDelete()
  verifyEscaping()
  verifyIdempotent()
  verifyMalformedDetected()
}
