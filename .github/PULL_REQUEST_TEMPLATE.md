## User problem and scope

Describe the user problem, the proposed scope change, and why it belongs in ccset.
A pull request may be an implementation proposal; submission does not imply
acceptance. Link a relevant issue or design note when one exists.

## Complete user path

For behavior changes, describe the complete user-visible flow and identify
anything intentionally left out. For documentation or tooling changes, describe
the resulting contributor workflow.

## Verification

Choose checks using the [verification guide](https://github.com/Right202209/ccset/blob/master/docs/verification.md). Record only
what actually ran; identify skipped or pending checks and the reason. For a
documentation-only change, links/examples/diff checks may be sufficient.

| Command or manual scenario | Environment | Result |
| --- | --- | --- |
| | | |

For runtime/tooling changes, include typecheck, build, relevant fixtures, and full
suite evidence as required by the guide. For a bug fix, describe the regression
assertion that fails without the fix. Link a new verification-register entry when
runtime evidence was added.

## Documentation

List the affected English docs and Chinese docs where they cover the changed
behavior, or explain why no user-facing documentation update is needed.

## TUI evidence

For a significant TUI change, include terminal screenshots. Otherwise write "Not
applicable" and explain why.

## Integration and maintenance impact

For a new Agent or core capability, explain how it reuses core safety semantics,
how its behavior can be repeatedly verified, and its expected startup and
maintenance cost. State whether it should be experimental.
