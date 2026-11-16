# Support Policy

[简体中文](docs/zh-CN/SUPPORT.zh-CN.md) | English

Single-maintainer, best-effort open source; only the latest npm version is supported. There are no response/fix/release deadlines or long-term version guarantees.

## Users and product scope

ccset serves individual developers configuring third-party APIs in coding Agents. It edits local configuration and provides the implemented [selection/session commands](docs/user-guide.md#cli); saving does not change an existing session. It does not manage Provider accounts, billing, availability, or certify API compatibility.

The project does not guarantee recovery of lost credentials/configuration, acceptance of every proposal, prompt repairs on unverified platforms, or compatibility with undocumented/changed upstream behavior. ccset-caused data loss or credential exposure has highest priority without a deadline promise.

## Platforms

| Tier | Environments |
| --- | --- |
| Supported | macOS, Linux |
| Best effort | WSL, Windows Terminal with PowerShell |
| Unsupported | `cmd.exe`, mobile terminals, special WSL integration beyond ordinary terminal use |

POSIX `0600` applies to Linux filesystems in WSL, not mounted Windows filesystems. Native Windows ACLs are not managed; verify permissions of Agent and backup directories yourself. Release evidence identifies exact Agent/Node/OS/terminal/shell versions, not every combination.

## Maintenance status

An inactive period does not imply abandonment. If maintenance stops, the repository will say so and remain open for a trusted community maintainer to offer a takeover.
