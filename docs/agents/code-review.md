# Code review rules

How to review a change to ccset: a pull request, a branch, a working tree, or
the whole repository. The rules here are the project's own invariants restated
as things a reviewer checks, each carrying the defect that made it a rule. The
generic Standards/Spec review (Fowler smells, spec conformance) still applies;
this document is the ccset-specific layer that sits on top of it.

The failure that matters most is destroying or exposing a config the user
already had. Grade findings by that scale, not by line count.

## Process

1. **Pin the scope.** For a diff: `git diff <base>...HEAD` and
   `git log <base>..HEAD --oneline`. For an audit: every file under `src/` and
   `scripts/`, plus the docs the change area names. Read the linked issue or PR
   and its comments. Done when the file list and the intended behavior are
   written down before the first finding.
2. **Select the rule sections.** Map the change with the table in
   [docs/verification.md](../verification.md#choose-checks-by-scope) and read
   the ADRs the touched area cites ([docs/adr/](../adr/)). A full audit applies
   every section below.
3. **Run the executable gates first** so the review reads real results, not
   claims: `npm run typecheck`, `npm run build`, `npm run verify:code-gates`,
   then the fixtures the map selects (`npm test` for shared writes, codecs,
   credentials, dependencies, or CI wiring). Fixtures run sequentially. Record
   the command, environment, and result for each.
4. **Trace every write path** the change reaches through
   `read → overlay → validate → plan → apply` in `src/operations/commit.ts`,
   and every secret from its source to every place it could be printed.
   Done when each managed key the change touches has a known owner
   (`manifest.ts`), a known deletion behavior, and a known fixture.
5. **Ask the reversion question** for every behavior change: which fixture goes
   red if this hunk is reverted? A behavior with no red fixture is a finding
   (§Verification) regardless of how obviously correct the code looks.
6. **Report** in the format under §Report. Findings are graded, cite the rule
   and the file:line, and name the fixture that pins the fix.

## Severity

| Grade | Meaning | Examples from the register |
| --- | --- | --- |
| **Blocker** | A Release blocker as defined in `CONTEXT.md`: data loss, credential exposure, failure to start, or a failed mandatory release check. Also any path that lets a config key reach `Object.prototype`. | `__proto__` reaching `setIn` through a TOML bare key (9.45 H-1); a switch committing routing before the credential move (9.37); a write the checker cannot re-parse (9.37). |
| **High** | A guarantee in `AGENTS.md` §Boundaries broken without data loss yet, or a refusal enforced on one surface only, or a secret-adjacent path without masking. | Codex `env_key` refusal on the TUI only, so the command silently saved a dead key (9.38); a 9-character secret showing 8 characters (9.38); a JSON-parse message echoing document bytes (9.45 M-1). |
| **Medium** | Boundary or single-source breach, a behavior with no fixture, an exit code that disagrees with the printed error, a missing locale key. | Duplicated secret-field sets beside dead exports (9.45 M-3); `process.exit` racing a queued pipe write (9.45 M-2); three behaviors shipped without assertions (#66 follow-up). |
| **Low** | Quality-gate or style breach, stale comment, dead code, fixture hygiene. | Nested ternaries, `any` in a fixture, magic exit codes, zh-Hans key order drifting from `en`. |

A Blocker or High finding stops the review from recommending merge. Medium
findings are fixed before merge unless the maintainer records why not. Lows may
be batched.

## Data safety

- **Leaves, never parents.** A managed write lands on the leaf declared in the
  Agent's `manifest.ts`. A hunk that spreads or assigns a parent object
  (`{...cfg, env: {...}}`, `provider[id] = {...}`) replaces unmanaged siblings
  and is High until a fixture shows the siblings survive at the deepest nesting
  the file uses (D1, D3, O1 in the register §2).
- **Deletion is explicit and shape-preserving.** A blank TUI field omits the key
  entirely: no `null`, no `""`. An omitted command option preserves the disk
  value; `--unset` deletes. `ManagedWrite.value === undefined` means delete;
  `false` is a value and stays a boolean (D2, O2, O3, C4). Template defaults do
  not fill omitted patch fields (ADR 0008).
- **Read at save time, preflight before the first write.** Values seeded when a
  form opened are overlaid on the document read at commit. Every command target
  is rendered and preflighted before any file changes. A multi-target failure
  reports the paths already written as partial, in those words.
- **Zero writes for no-ops and dry runs**, including zero backups and zero
  temp files. A dry run must plan every record the real commit would write,
  including sidecars (9.45 L-14).
- **Atomic, `0600`, backed up.** Every create or overwrite goes through the
  temp-file and `rename()` helpers in `src/core/json-file.ts` or `copy.ts`,
  every file ccset creates is mode `0600` on POSIX, and every overwrite of an
  existing file has a backup first, rotating at `MAX_BACKUPS`. Direct
  `fs.writeFile` on a target path is a Blocker.
- **Malformed targets need consent.** A document that fails the strict check is
  replaced only after the TUI confirm or `--replace-invalid`, and the original
  goes into a backup first. Freshness is scoped per target: a malformed sidecar
  beside a valid document replaces the sidecar only (9.37).
- **Create-only and whole-file cases.** `~/.claude.json` is never written when
  it exists (D4, D5). Codex `auth.json` is backed up and replaced whole on an
  explicit switch, never merged, and never offered as a switchable profile (C7).
  A switch stages the credential bytes before routing changes and restores
  routing if the move fails.
- **Codecs preserve bytes.** For TOML and JSONC, an empty write list is
  byte-identical and a managed edit changes only its own value span; comments,
  alignment, key order, and blank lines survive (C1, C2, O7, O11). An insert
  resolves the representation it lands in (inline table, dotted key, header)
  before writing, and the result re-parses under the strict checker.
- **Prototype keys are inert on both paths.** `__proto__`, `constructor`, and
  `prototype` are rejected by key-name validators, dropped by `merge.ts`'s
  own-property traversal, and dropped by the TOML reader through the same
  `isPrototypeKey`/`ownChild` helpers. A new reader or writer of user keys that
  does not reuse those helpers is a Blocker.

## Secrets

- **Two sources only.** A Non-interactive command accepts a secret through
  `CCSET_TOKEN` or explicitly selected stdin. A flag, a positional, or a file
  path carrying a token is High, and the refusal must assert the stderr text
  it declares.
- **Masked everywhere it could print.** Entry, Status, review, errors, the JSON
  envelope, and stderr show a secret only through `src/core/mask.ts`: fixed
  middle width, and fully hidden below `MASK_FULL_HIDE_BELOW`. Trace each new
  string that could carry a value from disk or from the user to its print site.
- **Errors carry keys, not document bytes.** A parse or validation error reports
  a message key and a position; it never echoes a fragment of the document,
  because a fragment can contain a token (9.45 M-1).
- **One credential authority per Agent.** A save that would write a key Codex
  ignores because `env_key` or `experimental_bearer_token` outranks it is
  refused in the shared preflight, so both the TUI and the command refuse
  (9.38). Any new refusal follows the same rule: it lives where both surfaces
  reach it.
- **Test connection** names the destination host, waits for confirmation, uses
  `ALLOWED_URL_PROTOCOLS`, and never prints the response body.
- **Fixtures use placeholders** such as `sk-TEST-DO-NOT-USE`, run in a `mkdtemp`
  home, and grep their own captured output and backups for the placeholder to
  prove it never appears whole.

## Seams and single sources

- **Agent modules own their world.** Paths, defaults, validation bounds,
  reserved IDs, manifests, messages, actions, and command declarations stay in
  `src/agents/<id>/`. An Agent imports nothing from `src/ui/`; it returns
  `ActionResult` data and the Views render it. Registration is one line in
  `src/registry.ts`.
- **Command mode never loads Ink.** `src/operations/types.ts` is the public
  contract: `OperationRequest` in, `OperationResult` or a typed error out. No
  Screen, translated text, or `ManagedWrite[]` crosses it (ADR 0006). The
  printed error and the process exit status agree, exit codes are the `EXIT_*`
  constants in `src/core/errors.ts`, and `process.exit` exists only in
  `src/cli.tsx`, after the pipe write has drained (9.45 M-2).
- **`CCSET_*` is read at the boundary.** `src/cli.tsx` reads the overrides and
  passes them inward through `ctx`. An Agent's own home variable (`CODEX_HOME`,
  `XDG_CONFIG_HOME`, `PI_CODING_AGENT_DIR`, `GROK_HOME`) is read in that
  Agent's `paths.ts` and honored for the real home while a scratch `CCSET_HOME`
  keeps fixtures isolated from an inherited value (9.37).
- **Manifest is the single source.** Secret field sets, labels, choices, path
  builders, and value lists derive from `manifest.ts`; a hand-copied set beside
  it is Medium (9.45 M-3, L-10, L-11). Shared constants belong in
  `src/core/constants.ts` only when more than one Agent uses them; the
  Agent-specific ceiling (`CLEANUP_DAYS_MAX`, token and timeout bounds) stays
  with the Agent and is built through the core validator factories.
- **Provider-specific behavior stays out of the core** unless it is expressed as
  a general capability (CONTRIBUTING.md). A new Agent meets the criteria there
  and the fixture minimum in [adding-an-agent.md](../adding-an-agent.md#prove-it).

## Locale and strings

- **Both catalogs, same order.** Every new key ships in `en` and `zh-Hans`, in
  the Agent's `messages.ts` for Agent strings or `src/i18n/` for shell strings,
  with the zh-Hans key order matching `en`. `verify:i18n-zh` holds the two
  key-for-key; a missing block is red, not a fallback.
- **Every reachable key resolves.** `t()` returns the key on a miss, so a typo
  paints `agent.field.apiKey` at the user instead of throwing. New screens are
  covered by the Agent's screen-walk fixture (`verify:*-screens`), which asserts
  `labelKey`, `helpKey`, `detailKey`, and choice labels, none of which a grep
  for `t(` can see. Dead keys are removed, not left in either catalog.
- **User-facing docs move with the strings.** A behavior change updates
  `docs/user-guide.md` and `README.md`, and `README.zh-CN.md` where it covers the
  behavior. The glossary in `CONTEXT.md` gains or revises a term instead of a
  second glossary appearing in assistant instructions.

## TUI

- **Screen versus View.** An Action returns one of form, list, status, confirm,
  or message; the component that draws it is a View. Esc pops a Frame; a
  Rendered paint is one draw. Use those words in findings.
- **Everything selectable is visible.** Wrapped choice rows window around the
  selected choice with an ellipsis at each cut; the form footer reserves its
  measured wrapped height under both locales at 80 and 100 columns; Status
  scrolls to its last section (9.37). A change to a row, footer, or list needs
  a paint assertion at a short viewport.
- **The editor owns its keys.** `src/ui/TextField.tsx` drops control and meta
  combinations (`ctrl+s` saves, it never inserts `s`), scrolls a long value
  around the cursor, and masks secret fields. `k`/`j` move on non-textual rows
  as `src/ui/keymap.ts` promises.
- **Terminal capability, not preference.** Glyphs and colors come from
  `src/ui/terminal.ts`; ASCII fallback paints stay aligned. `--version` and the
  non-TTY refusal print without ANSI escapes and the refusal exits 2.

## Verification

- **Every behavior change is pinned** by an assertion at the affected public
  boundary: file bytes and untouched siblings, backups and modes, exit codes,
  secret-free output, or a Rendered paint. The reversion question from the
  process decides whether a fixture exists, not the presence of a test file.
- **A bug fix is shown red first.** The PR or handoff names the assertion and
  states that it failed on the unfixed tree. A new data-safety fixture is also
  run against a deliberate mutation (a skipped delete, a blank written as `""`,
  a replaced subtree) and the mutation reverted afterward.
- **New fixtures are wired three ways**: a `verify:*` script, the sequential
  `test` chain in `package.json`, and the fixture map in `docs/verification.md`.
  Helper modules stay out of the command inventory.
- **Fixture hygiene.** Scratch homes from `mkdtemp`, `CCSET_*` stripped for
  non-TTY probes, `EXIT_*` constants instead of literals, `Record<string,
  unknown>` with `asRecord` instead of `any`, and every case table asserting the
  stderr it declares (9.45 L-26 to L-33). A fixture that only asserts an exit
  code where it declares a message is Low.
- **Evidence is what ran.** The PR table records commands, environments, and
  results that actually ran, with skipped or pending checks named. A command's
  presence in `ci.yml` is not a record that a run passed. Platform claims need
  evidence on that platform; `0600` is a POSIX claim only.

## Quality gates and style

- **Executable limits** are enforced by `verify:code-gates`: files ≤ 300 lines,
  functions ≤ 50 non-blank lines, complexity ≤ 10. The `BASELINE` list only
  shrinks: a fixed violation removes its entry, and a new violation is fixed in
  the code, never hidden by an entry.
- **Manual limits**: nesting ≤ 3, positional parameters ≤ 3, no nested
  ternaries (write statements or a shared helper such as `focusColor`), no
  magic numbers (`MAX_BACKUPS`, `FILE_MODE`, `MASK_*`, `CONNECTION_TIMEOUT_MS`,
  `EXIT_*` are the named minimum), and constants live with the module that
  owns them.
- **Style**: two spaces, no semicolons, single quotes, `.js` extensions in
  relative imports, `camelCase`/`PascalCase`, kebab-case Agent IDs, indexed
  values narrowed under `noUncheckedIndexedAccess`. Comments describe what the
  code does now; a comment that describes an earlier version is Low (9.45 L-5).
- **Dead surface is removed**, not retained: unused exports, parameters,
  imports, prompt or menu keys, and helper copies.

## Documentation and evidence

- The docs the change area names in `AGENTS.md` are updated in the same change:
  architecture for boundaries, the command specification for Non-interactive
  behavior (a conformance difference changed there is a behavior change),
  the user guide and READMEs for user-facing behavior, ADRs when an accepted
  decision changes. A conflict with an accepted ADR is surfaced, not silently
  overridden.
- New runtime evidence is appended to `Important Documentation.md` §9 as a new
  dated entry; earlier entries are history and stay as written.
- A new Agent or platform without continuous verification is marked
  experimental in the docs.

## Mechanical probes

Run these before reading; each should print nothing on a healthy tree. A hit is
a lead, and the section above says what it means.

```bash
grep -rn 'process\.exit(' src | grep -v '^src/cli.tsx'        # exits only at the boundary
grep -rn "from '\.\./\.\./ui\|from '\.\./ui" src/agents src/core src/operations src/commands
grep -rln "from 'ink'\|from 'react'" src | grep -v '^src/ui/\|^src/cli.tsx'
grep -rn ': any\b\|as any\b\|<any>' src scripts                # asRecord / Record<string, unknown>
grep -rn 'sk-TEST-DO-NOT-USE' src                              # placeholders live in scripts/ only
grep -rn 'process\.env' src | grep -v '^src/cli.tsx\|paths\.ts\|i18n/index\.ts\|ui/terminal\.ts'
```

## Report

```
## Standards
| ID | Grade | File:line | Rule | Failure scenario | Pin |
| H-1 | High | src/agents/x/commands.ts:42 | Secrets: one credential authority | `provider set` saves a key the Agent ignores → reports success | verify:commands-x refusal case |

## Spec
(requirements missing, unrequested behavior, requirements implemented wrongly; "no spec available" when none)

Gates run: typecheck ✓, build ✓, verify:code-gates ✓, verify:x ✓ (Linux x64, Node 20)
Summary: N Blocker / N High / N Medium / N Low. Worst per axis.
```

IDs follow the audit convention (`H-`, `M-`, `L-`, with `B-` for Blockers) so a
fix commit and its §9 entry can cite them. Keep Standards and Spec as separate
axes; the worst finding in each is reported, and neither is reranked against
the other.
