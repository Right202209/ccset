import assert from 'node:assert/strict'
import { applyTomlWrites, findTomlProblem, readTomlObject } from '../src/core/toml/index.js'
import type { JsonObject } from '../src/types.js'

/**
 * The codec, on its own. Not a gate with an npm script: it runs inside
 * verify:codex, the way verify-viewport runs inside verify:ui-render, because
 * Codex is the only agent that uses it and splitting the file is what keeps
 * both inside the 300-line limit.
 *
 * U7 is the question this answers: can a TOML document be round-tripped without
 * losing comments, key order and formatting? Until it could, "unmanaged keys
 * survive" was not promisable for a non-JSON agent.
 */

/** Documents that must survive an empty write list byte for byte (U7). */
const CORPUS: Record<string, string> = {
  comments: '# leading\n\n# attached to the key\nkey = "value"  # trailing\n\n# dangling\n',
  crlf: 'a = 1\r\n\r\n[t]\r\nb = "two"\r\n',
  noTrailingNewline: 'a = 1\n[t]\nb = 2',
  hashInString: 'url = "https://example.com/#frag"\nlit = \'a # not a comment\'\n',
  quotedKeys: '"dotted.key" = 1\n\'lit key\' = 2\nbare.nested = 3\n',
  multilineArray: 'list = [\n  "one",   # first\n  "two",\n]\n',
  inlineTable: 'h = { a = "1", b = { c = 2 } }\n',
  arrayOfTables: '[[x]]\nn = 1\n\n[[x]]\nn = 2\n',
  literalPaths: "win = 'C:\\Users\\me\\.codex'\nesc = \"tab\\there\"\n",
  dateTimes: 'a = 1979-05-27T07:32:00Z\nb = 1979-05-27\nc = 07:32:00\nd = 1979-05-27 07:32:00\n',
  multilineStrings: 'a = """\nkeep  me\n"""\nb = \'\'\'raw \\n here\'\'\'\n',
  numbers: 'i = 1_000\nh = 0xdead_beef\no = 0o755\nb = 0b1010\nf = 3.14\ne = 1e6\n',
  emptyish: '\n\n# only comments\n\n',
}

function verifyRoundTrip(): void {
  for (const [name, text] of Object.entries(CORPUS)) {
    assert.equal(applyTomlWrites(text, []), text, `U7: an unedited round trip changed ${name}`)
    assert.equal(findTomlProblem(text), null, `U7: valid TOML reported malformed in ${name}`)
  }
}

/** Each document is read on its own: a `[table]` header in one would otherwise
 *  capture the bare keys of the next. */
function read(name: string): JsonObject {
  return readTomlObject(CORPUS[name] ?? '')
}

function verifyReads(): void {
  const hash = read('hashInString')
  assert.equal(hash['url'], 'https://example.com/#frag', 'a # inside a string ended the value')
  assert.equal(hash['lit'], 'a # not a comment')

  const keys = read('quotedKeys')
  assert.equal(keys['dotted.key'], 1, 'a quoted key was split on its dot')
  assert.equal(keys['lit key'], 2, 'a literal-quoted key did not read')
  assert.deepEqual(keys['bare'], { nested: 3 }, 'a dotted key did not nest')

  assert.deepEqual(read('multilineArray')['list'], ['one', 'two'], 'a comment broke an array')
  assert.deepEqual(read('inlineTable')['h'], { a: '1', b: { c: 2 } }, 'a nested inline table')
  assert.deepEqual(read('arrayOfTables')['x'], [{ n: 1 }, { n: 2 }], 'an array of tables')

  const paths = read('literalPaths')
  assert.equal(paths['win'], 'C:\\Users\\me\\.codex', 'a literal string was unescaped')
  assert.equal(paths['esc'], 'tab\there', 'a basic string was not unescaped')

  const numbers = read('numbers')
  assert.equal(numbers['i'], 1000, 'an underscore separator was not handled')
  assert.equal(numbers['h'], 0xdeadbeef, 'a hex integer did not read')
  assert.equal(numbers['o'], 0o755, 'an octal integer did not read')
  assert.equal(numbers['b'], 0b1010, 'a binary integer did not read')
  assert.equal(numbers['f'], 3.14)
  assert.equal(numbers['e'], 1e6)

  assert.equal(read('dateTimes')['a'], '1979-05-27T07:32:00Z', 'a datetime was coerced')
  assert.equal(read('multilineStrings')['a'], 'keep  me\n', 'a multi-line string lost content')
  assert.deepEqual(read('emptyish'), {}, 'a comment-only document produced keys')

  const crlf = read('crlf')
  assert.equal(crlf['a'], 1, 'a CRLF document did not read')
  assert.deepEqual(crlf['t'], { b: 'two' }, 'a CRLF table did not read')
  assert.deepEqual(read('noTrailingNewline')['t'], { b: 2 }, 'a final line without \\n was dropped')
}

/** Setting an existing key touches its value span and nothing around it. */
function verifyReplace(): void {
  const src = 'a     = 1   # keep this\nb = "x"\n'
  const out = applyTomlWrites(src, [{ path: ['a'], value: 2 }])
  assert.equal(out, 'a     = 2   # keep this\nb = "x"\n', 'a replacement disturbed its own line')
}

/**
 * A bare key written after a `[table]` header belongs to that table, so a new
 * top-level key can never simply be appended -- it has to go above the first
 * header, and a new key in an existing table has to go inside it.
 */
function verifyInsertPlacement(): void {
  const src = '# head\nfirst = 1\n\n[alpha]\na = 1\n\n[beta]\nb = 1\n'
  const out = applyTomlWrites(src, [
    { path: ['second'], value: 2 },
    { path: ['alpha', 'z'], value: 'in-alpha' },
    { path: ['gamma', 'g'], value: 'new-table' },
  ])
  const data = readTomlObject(out)
  assert.equal(data['second'], 2, 'a new top-level key was captured by a table')
  assert.deepEqual(data['alpha'], { a: 1, z: 'in-alpha' }, 'a key landed in the wrong table')
  assert.deepEqual(data['beta'], { b: 1 }, 'an insert leaked into the following table')
  assert.deepEqual(data['gamma'], { g: 'new-table' }, 'a missing table was not created')
  assert.ok(out.startsWith('# head\n'), 'an insert displaced the leading comment')
  assert.equal(findTomlProblem(out), null, 'inserts produced invalid TOML')
}

function verifyDelete(): void {
  const src = '[t]\nkeep = 1\ndrop = 2  # goes with the key\nalso = 3\n'
  const out = applyTomlWrites(src, [{ path: ['t', 'drop'], value: undefined }])
  assert.equal(out, '[t]\nkeep = 1\nalso = 3\n', 'a delete removed the wrong bytes')
  assert.equal(
    applyTomlWrites(src, [{ path: ['t', 'absent'], value: undefined }]),
    src,
    'deleting a key that is not there changed the document',
  )
}

/** Values ccset writes are escaped, not concatenated into the document. */
function verifyEscaping(): void {
  const out = applyTomlWrites('', [
    { path: ['s'], value: 'quote " backslash \\ newline \n' },
    { path: ['n'], value: 42 },
    { path: ['b'], value: true },
    { path: ['l'], value: ['a', 'b'] },
  ])
  assert.equal(findTomlProblem(out), null, `escaping produced invalid TOML:\n${out}`)
  const data = readTomlObject(out)
  assert.equal(data['s'], 'quote " backslash \\ newline \n', 'a string did not survive escaping')
  assert.equal(data['n'], 42)
  assert.equal(data['b'], true, 'a boolean was written as a string')
  assert.deepEqual(data['l'], ['a', 'b'])
}

/** A file ccset cannot read is reported, never edited on a guess. */
function verifyMalformedDetected(): void {
  const broken: Record<string, string> = {
    danglingEquals: 'model =\n',
    noEquals: 'model "gpt"\n',
    unclosedHeader: '[model_providers.x\n',
    unterminatedString: 'a = "no end\n',
    unclosedArray: 'x = [1, 2\n',
    unclosedInline: 'x = { a = 1\n',
    junkAfterValue: 'a = 1 2\n',
    junkAfterHeader: '[t] junk\n',
  }
  for (const [name, text] of Object.entries(broken)) {
    assert.notEqual(findTomlProblem(text), null, `malformed TOML went undetected: ${name}`)
  }
}

/** Editing a document repeatedly must converge, not accumulate. */
function verifyIdempotent(): void {
  const src = '# head\n[model_providers.r]\nbase_url = "https://a/v1"\n'
  const writes = [
    { path: ['model_providers', 'r', 'base_url'], value: 'https://b/v1' },
    { path: ['model_providers', 'r', 'requires_openai_auth'], value: true },
    { path: ['model_providers', 'r', 'name'], value: undefined },
  ]
  const once = applyTomlWrites(src, writes)
  assert.equal(applyTomlWrites(once, writes), once, 'a repeated save was not idempotent')
  const data = readTomlObject(once) as JsonObject
  const table = (data['model_providers'] as JsonObject)['r'] as JsonObject
  assert.equal(table['base_url'], 'https://b/v1')
  assert.equal(table['requires_openai_auth'], true)
}

/**
 * A quoted key may contain a space, so `['lit key']` and `['lit', 'key']` are
 * different paths that a space-joined comparison would confuse. Editing one
 * must not touch the other.
 */
function verifySpacedKeyIsDistinct(): void {
  const src = "'lit key' = 1\n\n[lit]\nkey = 2\n"
  const out = applyTomlWrites(src, [{ path: ['lit key'], value: 9 }])
  const data = readTomlObject(out)
  assert.equal(data['lit key'], 9, 'a quoted key with a space was not the one edited')
  assert.deepEqual(data['lit'], { key: 2 }, 'editing a spaced key hit a dotted path instead')

  const nested = applyTomlWrites(src, [{ path: ['lit', 'key'], value: 8 }])
  const read = readTomlObject(nested)
  assert.equal(read['lit key'], 1, 'editing a dotted path hit the spaced key instead')
  assert.deepEqual(read['lit'], { key: 8 })
}

export function verifyTomlCodec(): void {
  verifyRoundTrip()
  verifyReads()
  verifyReplace()
  verifyInsertPlacement()
  verifyDelete()
  verifyEscaping()
  verifySpacedKeyIsDistinct()
  verifyMalformedDetected()
  verifyIdempotent()
}
