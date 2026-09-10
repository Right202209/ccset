# Restrict non-interactive secret sources

A Non-interactive command accepts a Provider secret only from `CCSET_TOKEN` or
from stdin selected explicitly with `--token-stdin`; secrets are never flags,
positionals, or file options. Supplying both sources is an error rather than a
precedence rule, stdin is never consumed implicitly, and omitting both preserves
an existing secret but fails when the target has none.
