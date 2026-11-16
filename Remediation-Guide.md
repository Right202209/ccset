# Security remediation retrospective

Historical September 2026 review, not an active repair checklist. [Register §9.53–9.56](<Important Documentation.md#953-application-security-remediation-findings-2026-09-24>) records original remediation and subsequent corrections. Current unresolved issues live only in [review.md](review.md); original finding narratives are available in git.

## Distilled lessons

| Original failure | Current rule / evidence |
| --- | --- |
| Codex auth move failed after routing, or threw after rename landed | Detect credential commit point; restore only when appropriate; report rollback/partial files. CLI-use failure fixtures |
| Invalid TOML insertion, inline deletion, redefinitions/depth | Structure-aware edits and rendered syntax check; bounded parser/corpus/oracle tests |
| JSONC inherited prototype slot / overbroad key rejection | Own-property traversal; block __proto__ only, retain constructor/prototype data (§9.55) |
| Provider validator reused for model IDs | Model IDs permit dot/slash/colon; Agent-specific model validator (§9.54) |
| Raw document/argv/control sequences in errors | Typed/redacted diagnostics and terminal sanitization; later output gaps remain in current review |
| Redirects to unconfirmed hosts | Manual redirect refusal, confirm original host, suppress body |
| Inherited real homes / predictable stages | Clear PTY Agent overrides; random exclusive private files; scratch homes only |
| Untrusted web markup / loose release permissions | Sanitizer/CSP, patched dependencies, pinned Actions, least privilege, clean tagged provenance |

The report's demand to reject constructor/prototype and every Python-rejected TOML extension was superseded. TOML \e, leap seconds and year 0000 remain deliberate extension cases (§9.56). Best-effort chmod reassertion does not undo private exclusive creation (§9.54).

The 2026-09-24 register records Linux checks and site checks as passed, with no live Provider, Windows/macOS or manual browser validation. Those dated results are not newly rerun evidence. No stale PTY blocker or mandatory blanket audit from that report applies to a documentation-only change; use [scope verification](docs/verification.md).
