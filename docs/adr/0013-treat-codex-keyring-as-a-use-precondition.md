# Treat Codex keyring as a provider-use precondition

Accepted. Settings and named Auth profiles can still be saved in keyring mode, but CLI use and TUI activation/restoration refuse: writing auth.json cannot change the effective keyring credential. Keep profile management separate from reporting an ineffective activation as success.
