# 2026-10-01 resilience audit retrospective

Historical audit of `8680074`, with subsequent fixes in `ec668ba`; original reproduction narratives are in git and [register §9.63](<../../Important Documentation.md#963-failure-oriented-clitui-audit-2026-10-01>). This is not the current unresolved list; see [review.md](../../review.md).

| Original finding | Implemented correction / fixture boundary |
| --- | --- |
| B-1 adopted profile overwritten after form open | Exclusive create-only publication; create-race/Codex recovery |
| B-2 concurrently created Claude state overwritten | Exclusive hard-link publication, no replacement fallback; write-safety |
| H-1 failed cleanup counted successful | Count completed removals, report failed paths/retry; error-recovery |
| H-2 failed-save draft lost dirty guard | Keep retained draft separate from baseline; error-recovery/malformed-dirty |
| H-3 TUI partial files hidden | Shared partial-error lines include paths/backups/rollback; partial recovery |
| H-4 CLI adoption lost original route | Persist/resolve adopted routing; commands-codex-use roundtrip |
| H-5 CLI saves bypassed CODEX_HOME refusal | Shared command mutation precondition; commands-codex/global/provider |
| H-6 TUI activation bypassed keyring | Activation/restoration check; Codex activation safety |
| H-7 pi validated patch rather than result | Validate effective api against retained models; pi/commands-pi |

Later findings on backup collisions, adoption identity/progress and TUI route differences remain open in the current review. Fixing these original cases did not create full transactions or full surface parity.

On 2026-10-01, typecheck/build/code-gates passed; the restricted Python oracle stalled, then full npm test passed after sandbox removal. This was not a production parser failure. Original checks used synthetic scratch homes and made no live Provider request, real Agent startup, other-platform run or website check. Current verification selection is [here](../verification.md).
