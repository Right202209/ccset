# Reviewing a change

When reviewing code, a PR, a branch, a diff, or auditing the repository, apply
[docs/agents/code-review.md](../../docs/agents/code-review.md): run the
executable gates first, trace each write path and each secret, ask which
fixture goes red on reversion, and grade findings Blocker/High/Medium/Low on
the data-loss and credential-exposure scale defined there. Report in its
two-axis format with `H-`/`M-`/`L-` IDs so fixes and the register can cite them.
