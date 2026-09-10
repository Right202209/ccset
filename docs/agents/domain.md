# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- [CONTEXT.md](../../CONTEXT.md) at the repo root for shared terms.
- [docs/adr/](../adr/): read decisions that touch the area you're about to work in.

Read the relevant decisions rather than the entire ADR history for every edit.
[AGENTS.md](../../AGENTS.md) routes changes to the architecture, command, and
verification guides.

## File structure

This is a single-context repository:

```
/
├── CONTEXT.md
├── docs/adr/          # Accepted decisions, one file per decision
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept isn't in the glossary, check whether an existing term covers it.
When a change introduces or revises a domain term, update the glossary with the
change rather than creating a second glossary in assistant instructions.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding it.
Keep a decision's rationale in its ADR, current implementation guidance in the
architecture/behavior docs, and dated verification evidence in the register.
