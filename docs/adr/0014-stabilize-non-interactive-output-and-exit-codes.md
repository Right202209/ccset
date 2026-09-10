# Stabilize non-interactive output and exit codes

Non-interactive commands use a line-oriented, secret-free human format by default
and an additive `schemaVersion: 1` JSON envelope when requested. Errors remain
machine-classifiable through a fixed exit-code taxonomy (`0` through `7`), while
JSON failures are emitted as one stdout object so a script never has to parse
localized presentation text or mix stdout and stderr protocols.
