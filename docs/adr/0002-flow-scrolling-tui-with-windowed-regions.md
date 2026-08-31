# Keep the TUI flow-scrolling and window only long regions

No part of ccset's interface measures the terminal, so a Screen taller than the
window repaints incorrectly and scrolls its own header away. Rather than become a
fixed-height application that owns the terminal and scrolls internally, ccset keeps
its output flowing and cuts only the long regions — list rows, the sections of the
Status screen, and the rows of a review form — down to a Viewport, naming what sits
outside it on a count line. A windowed region always keeps the focused row inside
the window. Status keeps its selectable items pinned below its windowed region,
because a hidden action is worse than a hidden status line.

The reason is the success message. It exists to be copied out of the terminal's own
scrollback: it carries the absolute path written, the resulting mode, and the
`claude --settings` command that activates it. An application that repaints a
fixed-height frame destroys that trail, which would cost more than a tidy full-screen
layout is worth. One consequence is worth stating because it looks like a bug
otherwise: numeric shortcuts number the rows currently visible rather than positions
in the underlying list, so that the digit printed against a row never disagrees with
what pressing it does, and no keystroke can select a row the core user cannot see.
