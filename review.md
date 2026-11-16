# Current safety follow-up

Aligned to source at `03a5063`; this documentation pass adds no new failure reproductions. The original review exercised synthetic credentials/scratch homes on Linux/WSL2, Node 26.10.0; it did not transmit downstream credentials. Old line numbers and full-suite failures are not current verification results.

Atomic publication protects individual files better than the surrounding operation protects concurrency, credential identity and partial-progress reporting. The following findings remain visible in current source. A fixture named here is a regression **to extend**, not proof its current assertions detect the gap.

## Open findings

| ID / grade | Source | Current gap | Regression boundary |
| --- | --- | --- | --- |
| B-1 Blocker, partly fixed | [cli.tsx](src/cli.tsx), [run.ts](src/commands/run.ts) | Command fallback Agent values are now validated; no-command Commander unknown-option errors can still echo raw rejected argv | commands-secret, CLI no-command refusal |
| B-2 Blocker | [Claude status DTO](src/agents/claude-code/status-dto.ts) and other Status presenters | Credential-bearing proxy/Base URLs can expose userinfo/password despite managed token masking | commands-status, TUI Status/review |
| B-3 Blocker | [pi status DTO](src/agents/pi/status-dto.ts) | Complete model objects export unmanaged headers/credentials in JSON | commands-pi |
| B-4 Blocker | [commit.ts](src/operations/commit.ts) | External changes between read/backup/publication can be lost; no lock/CAS conflict policy | write-safety, deterministic interleaving |
| B-5 Blocker | [backup.ts](src/core/backup.ts) | Existence-based final-name selection followed by overwriting rename can collide between writers | write-safety, concurrent snapshots |
| H-1 High | [provider-use.ts](src/agents/codex/provider-use.ts), [preconditions.ts](src/agents/codex/preconditions.ts) | Activation lacks the save-time env_key/experimental token authority refusal | CLI/TUI Codex activation |
| H-2 High | [activate.ts](src/agents/codex/activate.ts) | Failed live-auth publication plus successful routing rollback can hide a surviving adopted profile and break retry | codex recovery |
| H-3 High | [auth.ts](src/agents/codex/auth.ts), [preconditions.ts](src/agents/codex/preconditions.ts) | Separate saved-credential removal leaves adopted routing metadata; name reuse can pair a new key with an old route | adoption → remove → recreate → activate |
| H-4 High | [activate.ts](src/agents/codex/activate.ts) | TUI Provider activation uses its ID directly while CLI resolves recorded profile route; adoption names matching tables can diverge | Cross-surface adoption roundtrip |
| H-5 High | [commit.ts](src/operations/commit.ts) | Invalid-but-authorized base becomes missing; empty replacement is falsely reported as no-op, leaving malformed bytes | commands, deletion-only replace-invalid |
| Post-delete follow-up | [provider-actions.ts](src/core/provider-actions.ts) | Ignore-note persistence failure after removal omits completed deletion report | provider-management, partial progress |

## Resolved entries

- B-6 fixture contamination: `0569b3e` gave pi API removal an independent scratch home; the old fresh-file backup failure is not a runtime defect.
- M-1 conflicting selectors: `ceffd80` refuses conflicting CLI selectors before writes. Repeating the same selection is allowed; do not demand rejection of every repeated selector.
- Earlier September/October findings are summarized in [the remediation retrospective](Remediation-Guide.md) and [resilience retrospective](docs/reviews/2026-10-01-resilience-audit.md). Their closure does not close this later list.

## Distilled correction rules

Project diagnostics must explicitly project safe fields, including URL components and unmanaged metadata. Never serialize raw usage input. Preserve external changes through an explicit concurrency policy; publish backup names exclusively. Pair credential identity and effective routing through a shared lifecycle, and report all surviving changes even when one rollback succeeds.

Prioritize output leaks, concurrent-write/backup loss, Codex route identity, then truthful recovery. Assertions should cover transitions: external edit → save, adopt → fail → retry, remove → recreate → activate, delete → settings failure. [Verification](docs/verification.md) and [release gates](<Important Documentation.md#6-build-and-publish>) govern future fixes; no new runtime fix is claimed here.
