# Issue tracker: GitHub

GitHub Issues track work and discussion. Accepted specifications and decisions
also live in `PRD.md`, `docs/milestone-3-non-interactive.md`, and `docs/adr/`;
link them from the relevant issue or PR instead of maintaining conflicting copies.
Use the `gh` CLI available on `PATH`; do not hardcode a workstation-specific path.

When an issue or PR is supplied, read it and its comments before changing code.
A preceding issue is optional for an implementation proposal; see
[CONTRIBUTING.md](../../CONTRIBUTING.md). Local work does not need a new ticket
just to satisfy the development workflow.

## Conventions

- **Create an issue**: write its Markdown body to a file, then use `gh issue create --title "..." --body-file /tmp/ccset-issue.md`.
- **Read an issue**: `gh issue view <number> --comments`; add `--json number,title,body,labels,comments` for structured data.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: write the comment to a file, then use `gh issue comment <number> --body-file /tmp/ccset-comment.md`.
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.
Use body files for multiline PR descriptions and comments too, preserving actual
newlines and literal shell characters.

## Pull requests as a triage surface

External pull requests may be implementation proposals and run through the same
[triage states](triage-labels.md) as issues.

Use the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,comments`. If contributor association is needed, fetch `author_association` through `gh api 'repos/{owner}/{repo}/pulls'`; it is not a supported `gh pr list --json` field.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's native issue dependencies. Where dependencies aren't available, fall back to a `Blocked by: #<n>` line at the top of the child body.
- **Frontier query**: list the map's open children, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`.
- **Resolve**: comment on and close the child, then append a context pointer to the map's Decisions-so-far.
