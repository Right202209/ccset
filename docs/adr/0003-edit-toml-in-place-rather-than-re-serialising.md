# Edit TOML in place rather than re-serialising it

Codex CLI's `~/.codex/config.toml` is the first target ccset writes that is not
JSON, and the `Codec` seam PRD §4.3 named was notional until it had a second
member. TOML carries three things JSON does not: comments, blank lines, and an
author-chosen key order and alignment. ccset's standing guarantee is that every
key it does not manage survives a save byte for byte, so a codec that parses a
document into an object and prints a new one back cannot be used here — the
first save would silently delete every comment in a file the user hand-wrote.
That is U7, and it is why a Codex agent was deferred rather than attempted with
the JSON machinery.

ccset therefore scans the document for *positions* rather than values. Setting a
managed scalar replaces the span its value occupies; adding one inserts a line
into the table it belongs to; deleting an ordinary assignment removes its line.
When a managed leaf lives inside an inline table, the codec expands that one
assignment to dotted keys so it can remove or add the leaf without losing its
siblings. The assignment's comment and every unrelated byte survive. The
rendered result passes the strict syntax checker again before any write, and a
malformed source still reaches the user as the same "back it up and start fresh"
confirm a malformed JSON target does. Reading is separate and lossy on purpose:
offset date-times and `inf` have no JSON equivalent, so they are kept as their
source text — ccset manages none of them, and the writer never touches what it
did not write.

The codec is written here rather than taken from npm. The one JavaScript package
that patches TOML while preserving formatting was last published in 2022 and
draws a few hundred downloads a week, which is too thin to carry the guarantee
that a user's hand-written config survives. The scanner is the cost of that
decision, and it is bounded: ccset only ever writes scalars, so the writer is
small, and the scanner is exercised against a corpus of documents that must
survive an empty write list unchanged.
