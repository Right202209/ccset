# Draw the TUI as bordered flex panels inside the flowing output

Status: accepted

The TUI draws every Rendered paint inside an application frame. The frame's
top border carries `ccset` and its tagline. Its bottom border carries the key
help of whatever holds the keys. Inside it, a main Panel titled with the Frame
path holds the View. The main Panel's border shows what its Screen asks of the
core user: browsing, editing, deciding, or reading a message in that message's
tone. On a terminal at least 100 columns wide and 16 rows tall, side Panels
beside the main one show the Agent, whether its config exists, the home ccset
reads and writes, and the outcome of the last message Screen. Border
characters come from the Terminal capability, so a seven-bit terminal draws
them with `+`, `-`, and `|`.

The frame is only as tall as its content. The reference for this style is a
full-screen TUI whose panels stretch to the bottom of the terminal. Stretching
the panels would make ccset own the terminal, which ADR 0002 rejects to keep
the success message in the terminal's own scrollback, and that decision
stands. Flex layout here sets widths and places Panels side by side. It never
sets the application's height.

The layout computes the chrome's cost once and gives each View the interior
of the main Panel as its Viewport, so no View subtracts a header or a help
line of its own. Below 7 rows or 30 columns the chrome would cost more than it
shows, so the View paints alone. This extends the rule that previously
applied only to a short Status. Key help too long for the bottom border wraps
inside the frame on a terminal of 16 rows or more and is omitted on a shorter
one.

Consequences:

- Borders cost 4 rows and 6 columns. The previous header, padding, and help
  line cost 7 rows, so a list shows more rows in the same terminal.
- A message Screen never shares its width with side Panels. It carries the
  path that was written and the activation command, and those are what the
  core user copies. A terminal's line selection still picks up the side
  borders, so select the command by dragging across it.
- Rows reach the last column, so a terminal that narrows rewraps the previous
  paint. Ink's erase counts the rows it wrote, not the rows they became, so it
  cannot clear them. When the width falls below the width of the last paint,
  the App clears the visible screen before repainting. It never clears the
  scrollback.
- Ink's own truncation always inserts `…`, which a seven-bit terminal cannot
  draw. Text cut to fit a row is truncated by the layout with the Terminal's
  folded ellipsis instead.
