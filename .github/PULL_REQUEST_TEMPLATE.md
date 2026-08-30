## User problem and scope

Describe the user problem, the proposed scope change, and why it belongs in ccset.
A pull request may be an implementation proposal; submission does not imply
acceptance.

## Complete user path

Describe the complete user-visible flow. Identify anything intentionally left out.

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Relevant scenarios from `Important Documentation.md`
- [ ] English documentation updated
- [ ] Chinese documentation updated where it covers the changed behavior

List the commands and manual scenarios run, including the verified environments and
their results.

## TUI evidence

For a significant TUI change, include terminal screenshots. Otherwise write "Not
applicable" and explain why.

## Integration and maintenance impact

For a new Agent or core capability, explain how it reuses core safety semantics,
how its behavior can be repeatedly verified, and its expected startup and
maintenance cost. State whether it should be experimental.
