# Project plan: from a correct tool to a chosen one

[简体中文](zh-CN/project-plan.zh-CN.md) | English

Maintainer planning, written 2026-11-10. It sets a positioning and an order of
work; it is not a release schedule and commits to no dates. Phases are ordered by
dependency, and each has an exit condition instead of a deadline. The
maintainer's decisions of the same day are recorded in section 5.

**Inputs.** Two product reviews, archived as received under `docs/reviews/`:

- **R1**: the [switcher review](reviews/2026-11-10-switcher-review.md) with its
  [positioning](reviews/2026-11-10-switcher-positioning.md),
  [roadmap](reviews/2026-11-10-switcher-roadmap.md), and
  [README draft](reviews/2026-11-10-switcher-readme-draft.md). Thesis: a
  narrow, stateless switcher.
- **R2**: the [config-as-code review](reviews/2026-11-10-config-as-code-review.md).
  Thesis: config-as-code for coding agents.

Item references such as "R1 P0-3" or "R2 P1-6" point into those files. "F-05" to
"F-13" point to the rows of
[product-review-follow-up.md](product-review-follow-up.md), which already holds
the dependency notes and acceptance evidence for each engineering item. This
plan does not repeat those contracts; it decides what comes first and why.

## 1. Where the project stands

Checked on 2026-11-10 against the working tree at `ceffd80` and the public
registries.

| Fact | How it was checked |
| --- | --- |
| `master` is one commit ahead of `origin/master`. `ceffd80` (short commands, presets, all-Agent `use`, Claude Code `run`) is not pushed. | `git rev-list --left-right --count origin/master...master` |
| The working tree had an uncommitted `AGENTS.md` edit. The reviews sat in an untracked `review/` directory and have since moved to `docs/reviews/` (D5). | `git status --short` |
| Root `npm run typecheck` and `npm test` pass at that tree: every fixture, 292 files through the code gates with the nine baseline exceptions, release-artifact check. Linux x64, Node.js 26.13.0. This is not evidence for macOS, Windows, or a live Provider. | Run for this plan; exit 0 |
| npm has `@droite/ccset` 0.10.0 (5 October) with a SLSA provenance attestation. None of `ceffd80` is published. | `npm view @droite/ccset` |
| The unscoped npm name `ccset` is unregistered. | `npm view ccset` returns 404 |
| 46 npm downloads in the last 30 days; 2 stars, 0 forks, no open issues or pull requests, Discussions off. | npm downloads API, `gh` |
| GitHub homepage is `http://`; one topic is the fused `developer-tools-ai-agent`. The only issue template is the security report. There is no `CHANGELOG.md`. | `gh repo view`, `.github/` |
| CC Switch has 153,323 stars, CC-Switch CLI 5,464, claude-code-router 38,083. | `gh api repos/...` |

The reviews' other competitor claims (tool counts, preset counts, SQLite store,
sponsor lists, comment preservation) come from the reviews and were **not**
re-checked. Re-read the primary source before any of them appears in public
copy.

### What the reviews describe that has already changed

Both reviews read the pushed repository and v0.10.0. The unpushed commit closes
several of their findings, so the plan starts from here rather than from their
lists.

| Review finding | State at `ceffd80` |
| --- | --- |
| `use` exists for three Agents only (R1 P0-1, R2 P0-1) | Done in the CLI for all five. Claude Code `use` validates and prints the session command. |
| No session launcher (R1 P0-1) | Done: `ccset claude-code run <id>`, no shell, no file writes (ADR 0020). |
| `--agent` is mandatory (R2 P2-9) | Done: positional selector and `CCSET_AGENT`. |
| No presets (R2 P1-3) | Started: two bundled presets, nine Agent entries, hidden key prompt. `add` requires `--preset`, so a Provider outside the catalog still has no one-line path (R1 P1-1). |
| After saving in the TUI, the user copies a command (R1 P0-1) | Open. `ceffd80` changes nothing under `src/ui/`. |
| The first screen does not answer "why not CC Switch" (R1 P0-2) | Open. The README still opens with capabilities and names no alternative. |
| PRD describes a Claude Code-only generator (R1 P2-1, R2 P2-10) | Open. A note cites ADR 0020; §1–2 are unchanged. |
| Connection test is Claude Code only (R1 P1-3, R2 P0-2) | Open. |
| Scripts cannot delete, list, or clear backups (R1 P1-2, R2 P1-4) | Open. The operation set is `status`, `global.set`, `provider.set`, `provider.use`, `provider.run`, `state.init`. |
| No restore or undo (R2 P1-6) | Open. |
| Plaintext keys, ten backups each (R1 P1-4, R2 P2-7) | Open. Codex refuses `env_key`; Grok Build leaves it unmanaged. |
| `CODEX_HOME` is reported, not followed (R2 P1-5) | Open, and deliberate (ADR 0012). |

The largest gap is therefore not a missing feature. The work that answers both
reviews' first finding is built, verified locally, and unavailable to anyone.

## 2. Differentiation

### The position

Decided (D1).

> **The provider switcher you can audit.** ccset changes which API provider a
> coding agent uses by patching the agent's own files. It shows the exact change
> before writing it and keeps nothing of its own: no database, no daemon, no
> proxy.

Chinese: 给编程 Agent 换 API 提供商，改动之前逐行给你看；不建数据库，不起代理，
不留常驻进程。

Audience, in order: people working where a desktop app cannot run (SSH hosts,
containers, WSL, CI); people who keep Agent configuration in dotfiles; Providers
who need one command that is safe to print in their documentation.

### Why this position and not "config-as-code" yet

The two reviews agree on the assets and the non-goals. They differ on the
headline. R2's "config-as-code" is the more ambitious claim, and this plan keeps
it as the direction but not as the present-tense promise, for four reasons:

1. **It would repeat the mistake both reviews open with.** Their first finding is
   a tagline ("Switch") that the product did not deliver. A headline of plan,
   apply, and roll back would promise three commands that do not exist.
2. **Its demand is unmeasured.** R2 marks the size of the remote and CI audience
   as an assumption and recommends testing it with recipes before building
   `plan`/`apply`.
3. **A `ccset.toml` strains the strongest claim.** "Your Agent's files are the
   only source of truth" stops being obviously true once a second file describes
   them. It can stay true only if that file is user-owned input that ccset never
   writes. That is a design decision to make deliberately, not a default.
4. **Nothing is lost by waiting.** Declarative apply needs a redacted diff,
   credential references, and all-target preflight (F-05). All three are useful
   on their own and appear earlier in this plan.

### Four claims, and what makes each one visible

R1's sharpest point is that every advantage is something ccset does *not* do,
and an absence cannot be seen. Each claim below therefore pairs with an artifact
a visitor can inspect.

| Claim | True today | Visible today | What makes it visible |
| --- | --- | --- | --- |
| No second copy of your configuration | Yes | No | A README section listing every path ccset creates (item 1.2) |
| You see the change before it is written | Partly: `--dry-run` names targets, not lines | No | Redacted line diff in `--dry-run` and the TUI review (2.1, 2.2) |
| It refuses instead of writing something that will not work | Yes | Scattered through the Codex guide | One page of refusals, each linked to its fixture (2.3) |
| You can verify where it came from and what it guarantees | Yes: provenance, 37 `verify:*` scripts, 20 ADRs | No | Provenance and CI badges; a write contract mapping each guarantee to the fixture that fails without it (1.1, 2.4) |

"Keeps your comments and custom keys" stays in the README as evidence for the
first claim. R1 reports that CC Switch now says the same, so it cannot carry the
headline.

### Neutrality

ccset takes no sponsors, affiliate links, or paid placement, in presets or in
the README (D2). A preset is reviewed public data with primary sources, and
anyone may submit one on the same terms. This is a fifth claim, and unlike the
other four it is a promise about the future: easy to state and costly to
withdraw, which is why it was decided before the README says it.

### What ccset concedes

Tool count, preset count, a graphical interface, protocol translation, and MCP
or prompt management. The README should send those users to CC Switch by name.
Giving away the audience ccset cannot serve is what makes the remaining claim
credible.

## 3. Plan

### Phase 0: ship what is built

No new code. Until this phase ends, every later item describes software nobody
can install.

| # | Deliverable | Done when |
| --- | --- | --- |
| 0.1 | Resolve the working tree: commit or drop the `AGENTS.md` edit; commit this plan and the archived reviews | `git status` is clean |
| 0.2 | Push `ceffd80`; CI passes on the full matrix | Green run on Linux, macOS, and Windows legs |
| 0.3 | Release the next minor version through `publish.yml`, with provenance. Remove the "for the next release" paragraph from both READMEs | `npx @droite/ccset claude-code add relay --preset openrouter` works on a machine that has never seen the repository |
| 0.4 | Register the unscoped `ccset` name as a thin package that forwards to `@droite/ccset` (R1 P0-3, D3). A tool that handles API keys should not leave its own command name open for someone else to claim | `npm view ccset` lists the maintainer |

### Phase 1: say it

Documentation and metadata only. Depends on Phase 0 so the commands shown are
installable.

| # | Deliverable | Source | Done when |
| --- | --- | --- | --- |
| 1.1 | Rewrite the first screen of both READMEs: the position, the install command, the four claims each linked to evidence, a "ccset or CC Switch" table, and when not to use ccset | R1 P0-2 | A visitor sees the position and the comparison without scrolling |
| 1.2 | Add "What ccset leaves on your machine", checked against the path modules in `src/` | R1 issue 7 | The list matches the source in both languages |
| 1.3 | Use one sentence for the GitHub description and the npm description; split the fused topic and add `tui`, `terminal`, `dotfiles`; switch the homepage to `https://` | R1 positioning | The three places read the same |
| 1.4 | Replace PRD §1–2 with a one-page `docs/vision.md` (position, audience, non-goals, current phase); mark the PRD historical | R1 P2-1, R2 P2-10 | No tracked document says ccset "does not activate" or is Claude Code-only |
| 1.5 | Add `CHANGELOG.md`, listing changes to write behavior separately | R1 P2-2 | The last three releases are one click from the README |
| 1.6 | Add bug, feature, and Agent-request issue templates; file the open items from R1's drafts | R1 P2-3 | The issue list shows where help is wanted |
| 1.7 | Publish the neutrality policy (D2) in `docs/vision.md`, in `presets/README.md`, and beside the README comparison | R1 positioning | A contributor adding a preset reads the policy before opening a pull request |

The [README draft](reviews/2026-11-10-switcher-readme-draft.md) is the starting
point for 1.1, but it predates `ceffd80`. Correct three things before using it:
the preset row (two bundled presets, not none), the activation table (`use` and
`run`), and the statement that Test connection is the only network activity
(`run` starts Claude Code, which makes its own requests). Its Gemini CLI answer
restates a PRD note; verify it against Gemini CLI's current documentation before
publishing it (F-10).

Moving `Important Documentation.md` out of the root (R1 P2-1) touches about
fifteen files, a website link test, and `scripts/verify-code-gates.ts`. It is
deferred (D7).

### Phase 2: make it visible

The first code after the release, and the phase that carries the
differentiation.

| # | Deliverable | Source | Done when |
| --- | --- | --- | --- |
| 2.1 | `--dry-run` prints a redacted line diff per target, in human and JSON output | R1 roadmap, F-05 | Changing one key in a commented TOML file shows one changed line; a fixture proves no output contains a secret |
| 2.2 | The TUI review form gains "View changes" | R1 positioning | The same diff is one key press from the save prompt |
| 2.3 | A "What ccset refuses to do" page: keyring, `env_key`, `CODEX_HOME` mismatch (D6), malformed targets, redirects, secrets in arguments | R1 positioning | Each refusal links to the fixture that pins it |
| 2.4 | A write-contract page: each guarantee beside the fixture that goes red when it is reverted | R2 §5.2 | Every row has a runnable command |
| 2.5 | Three task recipes using released commands: an SSH host, a devcontainer, a CI job | R2 §8, F-12 | Each recipe runs in an isolated environment |
| 2.6 | Re-record the demo: preset, hidden key, diff, `run` | R2 §8 | The README animation shows the diff |

Design note for 2.1. `planTargets` in `src/operations/commit.ts` already holds
the base text and the exact bytes to be written, so the diff needs no new read.
The hard part is redaction. A conventional unified diff prints context lines,
and a neighbour of the changed line can be another Provider's credential or an
unmanaged `Authorization` header. Masking the managed secret is not enough. The
safe default is changed lines only, with secret-typed values masked and context
limited to the enclosing table or key path. This needs an ADR before code, and
the fixture must include an unmanaged secret adjacent to the edit.

Recipes (2.5) serve two purposes: they are the scenario pages R2 asks for, and
they are the cheapest available measurement of whether the remote and CI
audience exists.

### Phase 3: close the loop

Each item removes a point where the user must leave ccset or cannot finish in a
script. Contracts and acceptance evidence are in the follow-up document.

| # | Deliverable | Source | Done when |
| --- | --- | --- | --- |
| 3.1 | Script lifecycle: list and show Providers, `delete --yes`, `backups clear --yes`, all with `--dry-run`. Needs an ADR extending 0007 and 0019 | F-08, F-07 | Add, inspect, use, rotate, clear backups, and delete complete in one script; a destructive command without `--yes` exits 64 having read and written nothing |
| 3.2 | After a credential change, the TUI offers to clear backups that hold the old one. Opt-in, never automatic | R1 P1-4, F-07 | Zero copies of the old key remain after the user confirms |
| 3.3 | The TUI's success Screen focuses the activation step (`use`, or `run` for Claude Code) instead of printing a command to copy | R1 P0-1 | The README FAQ "Why did saving a provider not switch my agent" can be deleted |
| 3.4 | `add <id> --base-url <url>` without `--preset`, with the same hidden prompt | R1 P1-1 | A Provider outside the catalog can document one command that takes no secret argument |
| 3.5 | Protocol probes for Agents whose configuration declares the protocol (Codex, Grok Build, pi where declared); opencode explains in the same place why it has none | F-06 | Wrong address, wrong protocol, and wrong key produce three different results against a mock server |
| 3.6 | Credential references where the Agent supports them natively | F-09 | A reference round-trips with no secret bytes in any file or backup ccset writes |
| 3.7 | `backups list` and `backups restore` | R2 P1-6 | A saved change can be reversed without opening the backups directory |

The follow-up document first suggested 09, then 05, then 08 and 07. This plan
puts lifecycle (3.1, 3.2) ahead of credential references (3.6) and gates 05; the
follow-up document's closing paragraph now says the same (D4). The README
already tells script users ccset is safe for CI, while a rotated key stays in up
to ten backups that only the TUI can clear. Repairing a claim already made comes
before adding a new one. The order within this phase is otherwise free.

### Phase 4: gated bets

Nothing here starts until its gate is met. The gate is evidence, not elapsed
time.

| Bet | Gate | First deliverable |
| --- | --- | --- |
| Declarative apply: `ccset.toml`, `plan`, `apply` (R2 pillar one, F-05) | 2.1 and 3.6 are released, and at least one external user asks for multi-machine or CI setup | An ADR stating the file is user-owned input that ccset never writes, then the F-05 fixture |
| Provider documentation outreach (R1 P1-1, R2 §8) | 3.4 is released | Pull requests to three Providers' setup guides |
| Single binary, Homebrew (F-11) | A user without Node.js asks | A supply-chain and update plan before any build |
| Gemini CLI (F-10) | Its public documentation shows a custom-endpoint contract ccset can write faithfully | An implementation proposal with fixtures |
| Windows as a Verified environment (R1 P2-5) | A native Windows Terminal and PowerShell session is available | One recorded core-flow run, stated in the README as a specific environment |

## 4. Not doing

Both reviews agree on this list; it is part of the position.

- Local proxy, routing, protocol translation, failover.
- MCP, Skills, prompt, session, or usage management.
- Desktop interface or tray.
- A ccset-owned Provider store or index.
- Adding Agents to match a competitor's list. New Agents arrive as
  implementation proposals with evidence (F-10).
- Telemetry. Public signals stand in for it (section 6).
- Sponsors, affiliate links, or paid placement (D2).
- A preset catalog that competes on size. Presets stay reviewed data with
  primary sources, submitted by whoever wants the entry.

## 5. Decisions

Made by the maintainer on 2026-11-10. Changing one means editing this table and
the sections that cite it, not working around it.

| # | Decision | Revisit when |
| --- | --- | --- |
| D1 | The headline position is "the provider switcher you can audit". Declarative apply is a gated bet, not a present-tense promise | The Phase 4 gate for declarative apply is met |
| D2 | No sponsors, affiliate links, or paid placement in presets or the README | Not expected. A reversal would be a public change of position, not an edit |
| D3 | Register the unscoped `ccset` name on npm as a forwarding package | Done once `npm view ccset` lists the maintainer |
| D4 | Phase 3 runs in this plan's order: script lifecycle and backup cleanup before credential references, declarative apply gated | A user needs credential references before lifecycle commands |
| D5 | The two reviews are kept under `docs/reviews/`, labelled as snapshots with unverified third-party figures | — |
| D6 | ADR 0012 stands: `CODEX_HOME` is reported, and scripts refuse on a mismatch. It is listed on the refusals page (2.3) either way | Someone reports a TUI save that landed where Codex does not read |
| D7 | Moving `Important Documentation.md` out of the root is deferred | Item 1.4 has shipped and the root still misleads contributors |

## 6. Signals

No telemetry. These are observable from outside.

| Signal | Now | Next step up | Why it matters |
| --- | --- | --- | --- |
| Issue or pull request from someone other than the maintainer | 0 | 1 | The first evidence of a real user |
| A Provider's documentation shows a ccset command | None known | 1 | Whether Providers work as a distribution channel |
| npm downloads, 30 days | 46 | The trend after Phase 1, not a target | Whether the rewritten first screen changes anything |
| FAQ entries that explain why ccset did not do what was expected | 1 | 0 | Each one removed is a product problem fixed |
| Recipe-driven issues naming SSH, containers, or CI | 0 | 1 | Opens the gate on declarative apply |

## 7. Risks

| Risk | Response |
| --- | --- |
| One maintainer, five upstream formats | Hold the Agent count. When a format changes, refuse to write and say why |
| The diff leaks a secret through context lines | The ADR and adjacent-secret fixture in 2.1 come before the feature |
| A competitor claim in the README turns out to be wrong | Cite only what was re-read from the primary source on the day; link it |
| Presets draw commercial pressure | D2 is decided; item 1.7 publishes it where contributors will read it |
| Agents add native switching and reduce the need | The diff, refusals, and write contract are worth having even when the edit is small |
| The remote and CI audience is smaller than R2 assumes | Phase 4 gates keep the large investment behind evidence |

## 8. Phase 0 implementation handoff (2026-11-12)

Implementation starts on `feat/project-plan-implementation`, based on
`docs/project-plan` at `af63e17`. Section 1 remains the 2026-11-10 snapshot.
The current release candidate is `@droite/ccset` **0.11.0**; changing the package
and lockfile versions does not publish it.

The forwarding package lives in `packages/ccset/`. It imports the installed
CLI in the same process and pins the published **0.10.0** dependency so its
artifact can be tested before 0.11.0 is on npm. After the main release succeeds,
update that pin and both forwarding READMEs, rerun verification, then release
the forwarder. Main releases use `v<version>`; forwarding releases use
`ccset-v<version>`. Both use `publish.yml`, the `npm-publish` environment,
trusted publishing, and provenance. The guard rejects the other package's
tag, a mismatched version, local publishing, and a dirty checkout.

| Item | Local implementation | Remaining exit condition |
| --- | --- | --- |
| 0.1 | Plan and reviews are in the base commit; existing local edits are preserved | Review and commit the implementation and the pre-existing `AGENTS.md` edit; clean worktree |
| 0.2 | Existing full matrix remains the required gate | Push reviewed commits through a PR; obtain Linux, macOS, and Windows CI evidence |
| 0.3 | 0.11.0 manifests and the draft notes below are prepared | Maintainer release through `publish.yml`, fresh npm installation check, then remove the next-release warning from both main READMEs |
| 0.4 | Thin package, bilingual docs, release routing, guard, and installed-artifact assertions are implemented | Confirm publishing permissions for `ccset`, update its published dependency, release `ccset-v0.1.0`, and verify registry ownership |

Open question for 0.4. npm's trusted-publishing page (read 2026-11-12)
configures a publisher under an existing package's settings and does not
describe a name with no published version. `ccset` has none, and the guard
refuses a local `npm publish`. The maintainer decides how the first version is
created before the `ccset-v0.1.0` tag; no fallback token is introduced here.

Verification results belong in the append-only implementation register,
[Important Documentation.md §9](<../Important Documentation.md#9-implementation-register-code-complete>).
Phase 0 is still open until its remote release and CI conditions are met;
Phases 1 and 2 retain their release dependency.

### Draft notes for v0.11.0

- Agent selection accepts a positional selector and `CCSET_AGENT`. Scripts
  retain an explicit selector; a terminal may infer a sole detected Agent.
- `presets list` and `add --preset` provide two bundled presets covering nine
  Agent entries. A terminal can ask for a hidden key; scripts use `CCSET_TOKEN`
  or `--token-stdin`.
- All five Agents accept `use <id>`. opencode, Codex, pi, and Grok Build save
  next-start defaults. Claude Code prints a session command; its explicit
  `run <id>` starts the installed Agent without a shell and forwards its exit
  status. Dry-run does not launch it.
- Write behavior: preset `add` explicitly applies its defaults, with supplied
  options taking precedence. Codex `use --model` changes routing and model
  together and restores both if credential activation fails. Existing commands
  remain available; unmanaged keys, backups, and secret-source rules are retained.
- Publication uses separate tags for the main CLI and forwarding package.
  The forwarding package is released separately and reports its pinned CLI's
  version.
- Before publishing these notes, attach the actual CI and local verification
  results. Native macOS and Windows interactive checks and live Provider
  requests have not been performed for this candidate; Linux fixture launches
  use a stub Agent and isolated homes.
