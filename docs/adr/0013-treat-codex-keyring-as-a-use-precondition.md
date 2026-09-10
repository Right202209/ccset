# Treat Codex keyring as a provider-use precondition

When Codex stores credentials in the OS keyring, ccset may still save settings and
named Auth profiles, but `provider use` fails before any write because changing
`auth.json` cannot change the credential Codex reads. This keeps profile management
useful without reporting an ineffective activation as success.
