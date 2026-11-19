---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a CONTEXT.md, or recording or editing an ADR.
---

# Domain Modeling

Use this skill when the task changes domain language or records a durable design decision. Reading existing vocabulary alone does not require it.

## File structure

Use an existing `CONTEXT.md` or `CONTEXT-MAP.md` when present. Create a context file or ADR directory only when there is an actual term or decision to record.

## During the session

### Challenge against the glossary

Surface a term that conflicts with the existing glossary.

### Sharpen fuzzy language

Propose precise terms for overloaded concepts.

### Discuss concrete scenarios

Use concrete edge cases when a relationship remains ambiguous.

### Cross-reference with code

Check claims about existing behavior against code and surface contradictions.

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` using [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Record an ADR only when all three are true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).
