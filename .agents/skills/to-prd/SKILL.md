---
name: to-prd
description: Turn a full new or revised requirement into a durable, implementation-independent product requirements document.
disable-model-invocation: true
---

# To PRD

Turn the user's full requirement document into a durable product-level source of truth at `docs/product/prd.md`.

This skill answers **what the complete product is intended to do**. It does not select the next increment, design the architecture, or create implementation tasks.

## Inputs

Read the full supplied requirement and any existing PRD. Inspect code only when needed to distinguish product behavior from starter examples.

The requirement document is the original product intent. Do not silently rewrite or weaken it based on the current implementation.

## 1. Read the full requirement

Read the complete requirement before drafting.

Extract the goal, actors, workflows, rules, capabilities, constraints, deferrals, and unresolved contradictions.

Use the requirement's terminology when it is clear. Do not invent implementation terminology.

## 2. Clarify only product-wide ambiguity

Ask questions only when the answer materially affects the product model, capability boundaries, actors, global rules, or the meaning of the requirement as a whole.

Do not deeply grill slice-level behavior here. `/scope` will clarify the selected subset before implementation.

Bundle related questions. If the requirement is clear, proceed.

When ambiguity can safely remain local to a later capability, record it under that capability's `Open Questions` rather than blocking the entire PRD.

## 3. Organize the product into capabilities

Create stable capability IDs such as `CAP-01`, `CAP-02`, ...

A capability is a meaningful product area, not an implementation layer.

A capability describes product behavior, not a database, API, frontend, or test layer.

For each capability capture:

- goal
- actors
- requirements
- dependencies on other capabilities when meaningful
- open product questions local to that capability

Keep requirements behavioral and product-facing. Do not prescribe files, tables, endpoints, components, libraries, or architecture unless the user requirement explicitly constrains them.

## 4. Resolve material ambiguity

Ask for clarification only when a contradiction changes the product model or would require discarding existing requirements. Otherwise draft the PRD and show the result for review.

## 5. Write the PRD

Write `docs/product/prd.md` using `references/prd-template.md`.

Include a fenced `mermaid` diagram of the primary user's end-to-end journey, from entry or trigger through the user's observable outcome, including actor handoffs and meaningful alternate or denied paths. Add diagrams of the core workflows (beside `Core Workflows`) or global business rules (beside `Global Business Rules`) when they clarify behavior the prose leaves hard to follow.

Label rule nodes with the same terms used in the written rules. Diagram only behavior supported by the supplied requirement; mark unresolved branches as open questions. Keep the written text authoritative and implementation architecture out of the diagrams.

The PRD is product intent, not delivery status. Do not add:

- implementation tickets
- sprint plans
- code status
- current slice status
- architecture decisions inferred from the repo

If a previous PRD exists and the user supplied a revised requirement, reconcile it deliberately:

- preserve unchanged capability IDs where possible
- identify meaningful additions, changes, and removals
- ask before applying ambiguous or destructive changes
- never infer that a missing implementation means a requirement should be removed

## Handoff

After the PRD is written and any material ambiguity is resolved, use `/scope` to select the first viable product increment (the MVP) from it.

Both skills record a bounded increment as vertical implementation slices in the living scope artifact.
