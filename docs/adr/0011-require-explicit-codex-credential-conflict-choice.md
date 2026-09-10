# Require an explicit Codex credential conflict choice

`provider use` refuses to replace a live Codex `auth.json` that does not match
the selected Auth profile unless the caller explicitly chooses
`--adopt-current-as <provider-id>` or `--replace-current-auth`. The live file is
backed up either way, and the two choices cannot be combined, so an unattended
run cannot silently discard an unrecognised login.
