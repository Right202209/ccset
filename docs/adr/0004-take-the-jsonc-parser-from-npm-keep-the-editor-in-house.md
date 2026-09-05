# Take the JSONC parser from npm; keep the editor in-house

opencode loads both `opencode.json` and `opencode.jsonc` and merges them per
key with the `.jsonc` merged last -- so on a conflicting key the `.jsonc`
wins. It also seeds `~/.config/opencode/opencode.jsonc` on fresh installs,
which makes a `.jsonc` beside the managed file the default state, not an edge
case (issue #39, issue #46). ccset therefore writes the file opencode prefers:
when a `.jsonc` exists it becomes the one and only target every opencode read
and write goes through. That needs a second format-preserving codec, and the
first one (ADR 0003) was built in-house only because npm had nothing fit to
carry the guarantee. The JSONC case is the contrast, and it is worth putting
both halves on the record.

## What is taken from npm, and why

The parser is [`jsonc-parser`](https://www.npmjs.com/package/jsonc-parser)
3.3.1, Microsoft-maintained and actively published: it is the parser and AST
behind VS Code's settings editor, and opencode itself parses its config with
it. On every axis ADR 0003 used to reject the TOML package -- maintenance,
provenance, adoption -- this package is the opposite case. It provides the
strict syntax pass (a parse that reports comments and trailing commas as
legal -- both allowed by opencode -- and anything JSON.parse rejects as an
error) and the parse tree whose nodes carry the spans the editor works with.

## Why the patch engine is not taken

The same package sells a patch engine, `modify()`/`applyEdits()`, which VS
Code uses to edit settings in place. It cannot carry ccset's guarantee, and
the corpus gate is the evidence:

- With formatting options, every insertion and deletion is followed by a
  formatting pass over the edited line with `keepLines` **forced to false**
  (`withFormatting` in `edit.js`). A managed insert beside a compact array
  reprints that array across five lines: bytes ccset does not own, rewritten
  by a save that named a different key. This failed the corpus gate directly.
- Without formatting options the edits are byte-minimal but the inserted text
  is `,"key": value` jammed inline -- legal, and unusable as a user promise
  for a tool whose whole point is that the file stays presentable.

So the editor is a hand-written span splicer (`src/core/jsonc/`), built on
ADR 0003's construction: setting a managed key replaces the span its value
occupies, adding one inserts a single line into the object it belongs to,
deleting one removes a single line, and every other byte is copied through.
The npm parser supplies the spans; the splices are ccset's. This is the
fallback the spec for #46 named in advance: *if the package cannot satisfy
the corpus gate, the fallback is a hand-written scanner under ADR 0003's
rules*. What npm could not supply turned out to be narrower than the whole
codec -- so the fallback took the editor, not the scanner.

## What carries the guarantee

Evidence, not provenance, as in 0003. `verify:opencode` runs a corpus of JSONC
documents -- leading, attached and dangling comments, trailing commas, CRLF
and no trailing newline, nested objects, arrays, empty containers, escaped
strings, the seeded `$schema` shape, every key ccset manages -- each of which
must survive an empty write list byte for byte, and take a managed edit
elsewhere with every other byte identical. It was mutation-tested: target
selection forced back to the `.json`, the codec replaced by a
re-serialisation, the strict pass disabled, and a delete that leaves its
separator comma behind each turn the gate red.
