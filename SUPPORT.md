# Support Policy

ccset is a best-effort, single-maintainer open source project. It does not provide
response-time, fix-time, release-date, or long-term version-support guarantees.
Only the latest version published to npm is supported.

## Users and product scope

The core user is an individual developer configuring a coding Agent to use a
third-party Anthropic-compatible API service. ccset generates and inspects
configuration; it does not activate providers, manage their accounts, or certify
their API compatibility.

The project does not undertake to:

- diagnose Provider outages, billing, model availability, or compatibility;
- recover lost tokens or configuration;
- promptly fix failures on unverified or best-effort platforms;
- accept every feature request or pull request;
- preserve compatibility with undocumented or changed Claude Code behavior; or
- provide response, repair, or release deadlines.

A data-loss or credential-exposure defect caused by ccset is treated as the highest
priority, without creating a deadline guarantee.

## Platforms

- **Supported**: macOS and Linux.
- **Best effort**: WSL and Windows Terminal with PowerShell.
- **Not supported**: `cmd.exe`, mobile terminals, and special WSL integration
  behavior outside ordinary terminal use.

On WSL, the POSIX `0600` guarantee applies when settings are written to the Linux
filesystem. It does not apply to mounted Windows filesystems. On native Windows,
ccset does not manage NTFS ACLs; users must verify the permissions of their Claude
Code directory.

Release notes identify concrete verified environments. That evidence is not a
promise of compatibility with every Agent, Node.js, operating system, terminal, or
shell version.

## Maintenance status

Normal periods without activity do not mean the project is abandoned. If active
maintenance actually stops, the repository will state that explicitly while
remaining open so a trusted community maintainer can offer to take over.
