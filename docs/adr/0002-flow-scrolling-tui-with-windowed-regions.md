# Keep the TUI flow-scrolling and window only long regions

Accepted. Keep output at content height and preserve terminal scrollback so written paths and activation commands remain copyable. Window long lists, Status sections and forms within measured Viewports instead of stretching the application to terminal height.

Keep focus visible and actions reachable; numeric shortcuts refer to visible rows. [ADR 0017](0017-draw-the-tui-as-bordered-flex-panels.md) adds borders without changing this rule. The original lack of terminal measurement was the trigger, not a current implementation constraint.
