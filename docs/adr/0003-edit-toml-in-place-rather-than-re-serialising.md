# Edit TOML in place rather than re-serialising it

Accepted. Parsing and reprinting TOML discards comments, ordering and alignment in hand-written Agent files. Use an in-house position scanner/editor: replace managed value spans, insert/delete in the correct structure, and preserve unrelated text. A reader's parsed representation is separate from the text used for writing.

Inline tables may expand to dotted assignments while preserving siblings/comments; arrays and structural edits are supported too. Recheck rendered syntax before committing. [verify:codex](../verification.md#fixture-map) carries the empty-roundtrip/edit corpus and strict-parser comparisons.

The formatting-preserving package considered originally lacked enough maintenance evidence to carry the guarantee. Its dated download count and the once-notional Codec seam are not present design constraints. TOML's deliberate extensions are documented in [architecture](../architecture.md#codecs).
