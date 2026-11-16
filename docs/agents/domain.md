# Domain documentation

1. Read [CONTEXT.md](../../CONTEXT.md) for shared terms, then the [ADRs](../adr/) relevant to the change.
2. Keep the glossary to definitions; put paths, invariants, and implementation rules in [architecture](../architecture.md).
3. Update an existing term instead of adding synonyms or a second glossary.
4. Keep trade-offs in ADRs, future work in [the plan](../project-plan.md), and concise evidence pointers in [register §9](<../../Important Documentation.md#9-implementation-register-code-complete>). Apply [Trace → Distill → Prune](../../AGENTS.md#knowledge-base-self-evolution-specification-tdp-loop); detailed results stay in linked PR/CI or scoped notes, with originals in Git.
5. When source contradicts a decision, state the discrepancy and its evidence. Do not present an unimplemented decision as current behavior.
