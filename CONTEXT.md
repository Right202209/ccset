# ccset

[简体中文](docs/zh-CN/CONTEXT.zh-CN.md) | English

Vocabulary for a local coding-Agent configuration tool. Runtime rules belong in [architecture](docs/architecture.md); maintenance commitments belong in [SUPPORT.md](SUPPORT.md).

## Language

### Configuration

**Core user**:
An individual developer connecting a coding Agent to a third-party API.
_Avoid_: Enterprise administrator

**Agent**:
A coding tool whose configuration ccset manages.
_Avoid_: Provider

**Provider**:
A third-party API service represented by an Agent-local configuration.
_Avoid_: Agent, model

**Provider ID**:
The user-chosen identifier of a Provider within one Agent.
_Avoid_: Provider name, profile name

**Preset**:
Reviewed public endpoints, protocols, and model suggestions used as configuration starting values, without credentials or live-verification claims.
_Avoid_: Provider account, verified service

**Managed key**:
A configuration leaf ccset owns; other keys are unmanaged.
_Avoid_: Known key, entire config

**Managed patch**:
A proposal changing only explicitly supplied Managed keys and explicit removals.
_Avoid_: Complete config, replacement

**Codec**:
The read/write policy for an Agent configuration format, including how unmanaged text is retained.
_Avoid_: Parser, serializer

**Auth profile**:
A saved credential for later activation, distinct from the Agent's live credential.
_Avoid_: Live auth, account

**Activation timing**:
The next start or selected session in which a Provider choice takes effect.
_Avoid_: Hot switch, immediate activation

**Settings file**:
ccset-owned preferences for interface language and ignored Providers, separate from Agent configuration.
_Avoid_: Agent config, backup

**Ignored provider**:
A Provider hidden from ccset's normal interface while its Agent configuration remains present.
_Avoid_: Disabled provider, deleted provider

### Interface

**Non-interactive command**:
A script-facing operation that completes without a Screen or prompt, with all state-changing choices explicit.
_Avoid_: Scripted Screen, headless TUI

**Secret source**:
The explicitly selected channel carrying a Provider credential into a script invocation.
_Avoid_: Token flag, positional token

**Screen**:
Action-result data describing a form, list, status, confirmation, or message; its renderer is a View.
_Avoid_: View, page

**Frame**:
One Screen's position on the navigation stack.
_Avoid_: Rendered paint

**Rendered paint**:
One terminal draw, distinct from a navigation Frame.
_Avoid_: Frame, screenshot

**Viewport**:
The row/column budget of a windowed region inside the TUI.
_Avoid_: Full screen, application height

**Panel**:
A bordered layout region containing a View or Agent context.
_Avoid_: Screen, Frame

**Glance**:
A brief configuration summary and findings derived from an Agent's read-only status.
_Avoid_: Status Screen

**Preview**:
Temporary details for the focused list row, derived from that list's loaded record.
_Avoid_: Selection result, detail Screen

**Terminal capability**:
The glyph and color sets available in the current terminal.
_Avoid_: Locale preference, theme

**Locale preference**:
An explicit interface catalog choice.
_Avoid_: Detected terminal language

### Maintenance

**Verified environment**:
The specific Agent/Node/OS/terminal/shell combination of a recorded successful check.
_Avoid_: Compatibility promise

**Supported platform**:
A platform whose failures and required checks can block release.
_Avoid_: Best-effort platform

**Best-effort platform**:
A platform the project does not intentionally exclude but does not require for general release.
_Avoid_: Supported platform

**Implementation proposal**:
A pull request proposing a scope change through its implementation, without presumed acceptance.
_Avoid_: Approved feature

**Provider-specific behavior**:
Logic for a named Provider rather than a general configuration capability.
_Avoid_: Agent integration

**Experimental integration**:
An integration with a user case but insufficient continuing verification; it may be changed or removed.
_Avoid_: Permanent integration

**Release blocker**:
A known data-loss, credential-exposure, startup, or mandatory-release-check failure.
_Avoid_: Ordinary bug

**Core flow**:
The user path from launch through reading, review, safe saving, and the activation instruction.
_Avoid_: Every menu action
