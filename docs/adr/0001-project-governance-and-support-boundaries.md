# Set project governance and support boundaries

ccset is a reliable public tool for individual developers using third-party
Anthropic-compatible services, maintained on a best-effort basis without response
or release SLAs. Contributors may propose scope through complete pull requests,
but the maintainer retains final merge and npm release authority; technically sound
changes may still be declined for scope or long-term cost. macOS and Linux are
supported, while WSL and Windows PowerShell are best effort. Releases are made as
needed under SemVer, support only the latest npm version, and must not ship with a
known data-loss, credential-exposure, startup, or mandatory-check failure.

These boundaries favor an open path for useful implementations without turning a
single-maintainer project into a permanent compatibility or service obligation.
Integrations may be marked experimental and later downgraded or removed when the
project cannot verify them. Short-term maintainer silence does not imply
abandonment; if maintenance actually stops, the project will say so while leaving
the repository open for a possible community handoff.
