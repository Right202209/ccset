# ccset

ccset is a public configuration tool for developers who use coding agents with
third-party API services. Its language distinguishes configuration generation,
compatibility evidence, and maintenance commitments.

## Language

### Scope and maintenance

**Core user**:
An individual developer configuring a coding agent to use a third-party
Anthropic-compatible API service.
_Avoid_: Enterprise administrator, every Claude Code user

**Provider**:
A third-party Anthropic-compatible API service selected by the core user.
_Avoid_: Agent, model

**Agent**:
A coding tool whose configuration ccset can read or write, currently Claude Code.
_Avoid_: Provider

**Supported platform**:
A platform the project intends to keep working. Platform-specific changes require
release-blocking verification on that platform, while other releases may disclose
a missing manual smoke test.
_Avoid_: Probably compatible, best-effort platform

**Best-effort platform**:
A platform ccset is designed not to exclude, but whose failures do not block a
release and may remain unresolved.
_Avoid_: Supported platform

**Verified environment**:
A concrete agent version, Node.js version, operating system, terminal, and shell
combination on which a documented check has passed. It is evidence, not a general
compatibility promise.
_Avoid_: Supported version, compatibility window

**Implementation proposal**:
A pull request whose implementation is itself the proposal for changing ccset's
scope. It may be submitted without a preceding issue and carries no presumption of
acceptance.
_Avoid_: Approved feature, committed roadmap item

**Provider-specific behavior**:
Configuration or interaction logic that exists for one named Provider rather than
for the general Anthropic-compatible configuration model.
_Avoid_: Agent integration, general provider capability

**Experimental integration**:
An Agent or platform integration with a real user case but without enough ongoing
verification to qualify as supported. It may be changed, downgraded, or removed.
_Avoid_: Supported integration, permanent integration

**Release blocker**:
A known defect involving data loss, credential exposure, failure to start, or a
failed mandatory release check. A release blocker prevents publishing regardless
of schedule.
_Avoid_: Ordinary bug, known limitation

**Core flow**:
The interactive path from launching ccset through reading, reviewing, and safely
writing a configuration, including the resulting activation command.
_Avoid_: Every menu action, exhaustive manual test suite

### Interface

**Screen**:
The data an Action returns for the core user to act on — one of form, list, status,
confirm, or message. The component that renders one is a View, never a Screen.
_Avoid_: Page, dialog

**Frame**:
One Screen on the navigation stack. Esc pops a Frame.
_Avoid_: Rendered paint, history entry

**Rendered paint**:
One draw of the terminal. Distinct from a Frame, which is a position in navigation
rather than a moment in rendering.
_Avoid_: Frame, screenshot

**Viewport**:
The row and column budget a windowed region is cut to. ccset does not own the whole
terminal, so a Viewport bounds a region, never the application.
_Avoid_: Screen size, full screen

**Terminal capability**:
What the terminal in front of the core user can render: the glyph set and the color
set. It is a property of the environment, not a user preference.
_Avoid_: Theme, style
