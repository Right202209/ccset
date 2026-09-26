# Read the status operation for TUI side panels

Status: accepted

The bordered TUI has room for context beside the main Panel on wide terminals,
and a compact strip on medium-width terminals. Reading Agent files directly in
the Views would duplicate each Agent's path rules, parsing, and secret handling.
The existing status operation already reads those local files once and returns
a secret-free DTO, warnings, and errors.

The TUI requests `status` through `executeOperation` when an Agent is selected,
and again after a new message Screen appears. A request counter discards a
result if a newer refresh has started. The CLI does not use the TUI's optional
`presentGlance` hook, so its human and JSON output remain unchanged.

Each Agent's status declaration may present a few keyed Glance lines for its
config summary and per-action previews. The TUI resolves those keys through
the active catalog. A focused list row may publish its own translated Preview
before it is opened. Warnings and errors use the findings from the same status
result. These panels are local-only; they do not make network requests.

Credential data never reaches a paint. The DTO replaces credentials with
presence flags, and a provider Preview shows only “set” or “unset”; it does not
show even a masked credential. Base-URL Previews show only the origin, with an
ellipsis when a path was present; paths, queries, and fragments are omitted, and
an invalid URL is hidden. This avoids relying on query-key names or guessing
which path segments carry credentials. Provider-row Previews use the records the
list already loaded rather than introducing another read path.

`planLayout` chooses a side column at 100 columns and 16 rows, a two-line strip
at 80–99 columns and 20 rows, or no extra information at narrower or shorter
sizes. At 130 columns the side column grows from 26 to 36 columns. The strip
costs four rows taken from the main Viewport. The side column uses a separate
row budget; lower-priority panels give way first, and a trimmed Warnings panel
ends with a count of omitted findings. Errors precede warnings so they survive
trimming as long as the available rows allow. Both layouts reserve a terminal
row so the frame remains shorter than the viewport.

ADR 0002 still governs the frame: it remains content-height and does not fill
the terminal or clear scrollback. The strip and side-column budgets are paid
before painting, so the added context cannot turn the TUI into a full-screen
application.

Consequences:

- The status operation is the source of Glance diagnostics and config facts;
  the Status Screen keeps its existing TUI presentation path.
- The optional presentation hook adds TUI-only keyed lines without changing
  the operation result or CLI presentation contract.
- Focused-row previews are temporary UI state and clear when the list loses
  focus or unmounts.
- New shell labels ship in both English and Simplified Chinese.
