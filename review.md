  The central shortcoming is that atomic file replacement is stronger than the
  surrounding operation model: individual writes complete safely, but concurrent
  changes, credential identity, partial progress, and safe diagnostic output are not
  consistently protected.

  Standards

  “Pin” names the regression fixture to extend—not an assertion that existing coverage
  detects the issue.

  ID: B-1
  Grade: Blocker
  File:line: src/cli.tsx:153; src/commands/run.ts:66
  Rule: Secret-safe errors
  Failure scenario: Rejected arguments can be printed verbatim. --token=<secret> without

  a command reaches Commander’s unsanitized error; malformed globals can place an
  unvalidated value in the JSON agent field. Both leaks were reproduced.
  Pin: verify:commands-secret
  ────────────────────────────────────────
  ID: B-2
  Grade: Blocker
  File:line: src/agents/claude-code/status-dto.ts:58
  Rule: Secret-safe Status
  Failure scenario: The supported setter accepts an authenticated proxy URL. Human and
  JSON Status then print its complete password. Provider Base URLs containing userinfo
  are similarly exposed.
  Pin: verify:commands-status, TUI Status/review fixtures
  ────────────────────────────────────────
  ID: B-3
  Grade: Blocker
  File:line: src/agents/pi/status-dto.ts:71
  Rule: Safe diagnostic projection
  Failure scenario: Pi Status exports complete model objects. A model’s unmanaged
  headers.Authorization value consequently appears in status --json, despite the main
  API key being reduced to a presence flag.
  Pin: verify:commands-pi
  ────────────────────────────────────────
  ID: B-4
  Grade: Blocker
  File:line: src/operations/commit.ts:128–129
  Rule: Preserve concurrent changes
  Failure scenario: Another writer updates a configuration after its backup but before
  publication. The stale rendered document replaces that update; neither the resulting
  target nor the backup contains it. Reproduced with a deterministic interleaving.
  Pin: verify:write-safety
  ────────────────────────────────────────
  ID: B-5
  Grade: Blocker
  File:line: src/core/backup.ts:37; src/core/backup.ts:47–55
  Rule: Backups must not overwrite one another
  Failure scenario: Two writers select the same timestamped backup name before either
  publishes. Both succeed and return the same path, but the later rename replaces one
  snapshot. Reproduced with two different file versions.
  Pin: verify:write-safety
  ────────────────────────────────────────
  ID: B-6
  Grade: Blocker
  File:line: scripts/verify-commands-pi.ts:52
  Rule: Mandatory verification must pass
  Failure scenario: The new API-removal helper creates models.json inside the
  fresh-provider test’s home. The subsequent operation correctly makes a backup,
  contradicting the test’s “fresh file” assertion and stopping npm test. This is
  fixture contamination, not a runtime  backup defect.
  Pin: verify:commands-pi, then npm test
  ────────────────────────────────────────
  ID: H-1
  Grade: High
  File:line: src/agents/codex/provider-use.ts:80–82;
  src/agents/codex/preconditions.ts:23
  Rule: One credential authority
  Failure scenario: Activation succeeds while a Provider’s overriding env_key remains
  configured. Routing and auth.json change, but Codex ignores the credential just
  activated. Provider saving already refuses this conflict; activation does not.
  Pin: CLI/TUI Codex activation fixtures
  ────────────────────────────────────────
  ID: H-2
  Grade: High
  File:line: src/agents/codex/activate.ts:93–96
  Rule: Report all committed progress
  Failure scenario: Adoption creates auth.kept.json, then live-auth publication fails.
  Successful routing rollback returns a plain error and hides the surviving adopted
  profile. Retrying the retained form then fails because kept already exists.
  Pin: verify-codex-recovery.ts

  Required handling

  - B-1: Centralize safe usage-error presentation, including the no-command parser.
    Never serialize fallback context unless it matches a validated Agent ID.
  - B-2/B-3: Build diagnostic DTOs from explicitly safe fields. Redact
    credential-bearing URL components; project model IDs and approved metadata rather
    than exporting arbitrary stored objects. Preserving unmanaged configuration does not
    authorize printing it.
  - B-4: Serialize cooperating writers and detect stale snapshots before committing.
    Define an explicit conflict policy for external writers; a whole-file rename alone
    cannot guarantee preservation against them.
  - B-5: Publish backups exclusively, with collision retry or genuinely unique names. An
    existence check followed by overwriting rename() is insufficient.
  - B-6: Give the API-removal regression its own scratch home. Keep the fresh-provider
    test genuinely fresh.
  - H-1/H-2: Share activation preconditions and committed-target accounting across CLI
    and TUI. Successful rollback of routing must not erase facts about other files
    already created.

  Spec

  These findings concern promised behavior, rather than style or implementation
  conventions.

  ID: H-3
  Grade: High
  File:line: src/agents/codex/preconditions.ts:29–32; src/agents/codex/auth.ts:223–229
  Requirement: Keep credentials paired with their route
  Failure scenario: Adopt as saved → delete that profile → create a new Provider named
  saved → activate it. Stale adoption metadata wins over the new Provider table,
  pairing the new key with the old route while reporting success.
  Pin: Codex adoption round-trip fixture
  ────────────────────────────────────────
  ID: H-4
  Grade: High
  File:line: src/agents/codex/activate.ts:91
  Requirement: Either surface restores adopted routing
  Failure scenario: An adoption name can match an existing Provider table without an
  Auth
  profile. Later TUI activation routes to that name instead of its recorded original
  route. CLI and TUI consequently activate the same saved credential differently.
  Pin: Cross-surface Codex adoption fixture
  ────────────────────────────────────────
  ID: H-5
  Grade: High
  File:line: src/operations/commit.ts:68–70; src/operations/commit.ts:84
  Requirement: Malformed-target recovery must produce an honest result
  Failure scenario: A deletion-only command with --replace-invalid returns ok: true,
  changed: false while leaving the original malformed file untouched. Replacement
  converts the base into “missing,” so empty output is incorrectly classified as a
  no-op.
  Pin: verify:commands
  ────────────────────────────────────────
  ID: M-1
  Grade: Medium
  File:line: src/commands/globals.ts:26–34
  Requirement: Reject duplicate scalar options
  Failure scenario: Two --agent selectors silently choose the last Agent. A wrapper and
  caller can therefore disagree about the destination without receiving an ambiguity
  error. Confirmed using dry-run.
  Pin: verify:commands-parser

  Required handling

  - H-3: Give adoption metadata an explicit lifecycle. Deleting or rebinding a profile
    must invalidate its old routing association; a reused name is not the same
    credential identity.
  - H-4: Use one effective-route resolver for all activation paths. Reject ambiguous
    adoption names or represent their meaning explicitly.
  - H-5: Distinguish absent, valid, and invalid-but-authorized-for-replacement targets
    during planning. Do not return success with a known malformed target still present.
  - M-1: Reject duplicate selectors before filesystem access or secret consumption,
    including mixed --agent value and --agent=value forms.

  The wrong Codex routing/credential pairings were reproduced in files and operation
  results. No downstream credential transmission was performed or claimed.

  Verification

  Environment: Linux x86_64 / WSL2, Node.js 26.10.0, npm 12.1.0.

  ┌────────────────────────────────┬────────────────────────────────────────────────┐
  │             Check              │                     Result                     │
  ├────────────────────────────────┼────────────────────────────────────────────────┤
  │ npm run typecheck              │ Passed                                         │
  ├────────────────────────────────┼────────────────────────────────────────────────┤
  │ npm run build                  │ Passed                                         │
  ├────────────────────────────────┼────────────────────────────────────────────────┤
  │ npm run verify:code-gates      │ Passed: 273 files, 10 baseline exceptions      │
  ├────────────────────────────────┼────────────────────────────────────────────────┤
  │ npm test                       │ Failed in verify:commands-pi: AssertionError:  │
  │                                │ a fresh file made a backup                     │
  ├────────────────────────────────┼────────────────────────────────────────────────┤
  │ Remaining fixtures, run        │ Passed, including Codex commands and           │
  │ separately in sequence         │ release-artifact verification                  │
  ├────────────────────────────────┼────────────────────────────────────────────────┤
  │ git diff --check               │ Passed                                         │
  ├────────────────────────────────┼────────────────────────────────────────────────┤
  │ Targeted failure probes        │ Reproduced the reported failures using scratch │
  │                                │  homes and synthetic credentials               │
  └────────────────────────────────┴────────────────────────────────────────────────┘

  No live Provider requests, real Agent-home writes, Windows/macOS validation, or
  website checks were performed. Power-loss durability remains an already-documented
  limitation, not a newly discovered defect.

  Engineering priority

  1. Close diagnostic credential leaks first.
  2. Protect backup publication and concurrent writes.
  3. Unify Codex activation around credential identity, effective routing, and explicit
     progress records.
  4. Make recovery truthful: report what changed, what was restored, what remains, and
     what retry will do.
  5. Test transitions, especially open → external change → save, adopt → fail → retry,
     and delete → recreate → activate.
