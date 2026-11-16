# Take the JSONC parser from npm; keep the editor in-house

Accepted. Use maintained Microsoft `jsonc-parser` for syntax and node spans; ccset owns the editing splices. Its `modify()` formatter reprinted adjacent compact arrays, failing the unrelated-byte preservation corpus; unformatted insertions were legal but unsuitable. A package's provenance cannot replace a passing preservation fixture.

For opencode, select an existing `opencode.jsonc`, otherwise `opencode.json`; never create JSONC or edit the legacy JSON beside it. Upstream precedence is source-backed; the separate live merge-order check remains U6 in [the register](<../../Important Documentation.md#1-blocking-unknowns>).

`verify:opencode` covers comments, separators, CRLF, empty roundtrip, managed edits and target selection. Reuse the parser, not a formatter that silently changes unmanaged text.
