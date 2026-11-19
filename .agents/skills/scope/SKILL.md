---
name: scope
description: Select the next bounded product increment from docs/product/prd.md, including the first MVP, and record a few independently verifiable slices in docs/scope/scope.md.
disable-model-invocation: true
---

# Scope

Choose exactly what to build next and make it manageable. This skill owns **product alignment, increment boundaries, and vertical slicing**; it does not design implementation architecture or write code.

The durable product definition is `docs/product/prd.md`. The durable delivery state is `docs/scope/scope.md`. Reconstruct state from these, the code, and the user's latest priorities rather than old chat memory.

## 1. Reconstruct product and implementation state

Identify implemented behavior, remaining requirements, and any unfinished active increment. Starter demo features (Projects, Tasks, Tags) are examples, not product requirements. If the PRD is missing, ask for it or use `/to-prd` when the user supplied the full requirement.

If an active increment is unfinished, ask whether to continue, revise, or explicitly abandon it before replacing it.

## 2. Select a bounded increment

Choose the smallest coherent useful end-to-end outcome, informed by user priorities and repository reality. It may combine requirements from several PRD capabilities when the outcome needs them. For the first increment, follow [First increment (MVP)](#first-increment-mvp).

Clarify only questions that materially change behavior, scope, or slice order, bundled together. Challenge assumptions where the requirement, repository, and PRD disagree. Questions the repository already governs (libraries, folders, ORM, API style, UI components) stay out unless the product genuinely depends on them. Use `grilling` only when the user asks for a deep interview.

Define the increment with: name, goal, in scope, explicitly out of scope, an observable `Done when`, and assumptions being validated. If the boundary is a product decision the user has not specified, present it for confirmation before writing; otherwise write it and show it for review.

## 3. Split into vertical tracer-bullet slices

1. Use the **fewest coherent slices** that make the increment manageable; keep it as one slice when it fits one implementation context.
2. Each slice delivers observable user or business behavior across every layer it needs, never split by database, backend, frontend, or tests.
3. Each slice is independently verifiable, leaves the repository working, and fits one fresh implementation context.
4. Acceptance criteria are observations that are false before the slice and true after it. Every slice answers: **what can a reviewer demo when it is done?**
5. Split again when a slice holds several independently useful outcomes.
6. Declare dependencies only for real ordering constraints. Allow a small enabling slice only when it is required to unlock the user-facing slices.

## 4. Write the living scope

Write or update `docs/scope/scope.md` from [the scope template](references/scope-template.md). Keep it easy for `/sync` to reconcile: an `## At a glance` table, statuses `planned`, `in-progress`, `done`, `existing`, or `dropped`, a clearly marked active increment, preserved released history, and lightweight deferred capabilities without duplicating the PRD.

Each slice records its ID, outcome, acceptance criteria, dependencies, demo/proof, and status, under the fixed line:

`**Build approach:** Vertical Tracer Bullets — one independently verifiable user/business outcome per slice.`

Always include a `mermaid` diagram of the user's end-to-end journey for this increment, from trigger to observable outcome, with meaningful handoffs and denied paths. Add workflow, business-rule, or slice-dependency diagrams when they clarify behavior the prose leaves hard to follow. Diagram only this increment's behavior; written criteria remain authoritative.

The scope slice is the implementation contract: create no separate spec or tickets. After writing, check that each slice's dependencies form a valid path and that every acceptance and `Done when` statement can be demonstrated.

## First increment (MVP)

The first increment is the **smallest coherent end-to-end product** that tests the PRD's central value proposition. Label it `MVP`.

- Identify the primary actor, problem, and shortest complete journey that delivers value and tests the riskiest assumption. Include the prerequisites that make it usable and safe, including applicable PRD-wide rules; defer adjacent workflows, polish, and optional capabilities.
- Map each selected behavior to its PRD capability, and record meaningful deferrals by PRD ID with a brief reason. Preserve PRD terminology and constraints; prefer a thin but complete product over broad partial coverage.
- When the PRD supports materially different MVPs, present the tradeoff and ask the user to choose before committing the boundary.
- End the MVP with a completion requirement to replace and remove the starter demo features once the product journey is verified, following the [new-product adoption checklist](../../../docs/new-product.md).

## Handoff

The next step is `/implement` on one ready slice, or on the whole increment when the user asks. A fresh session must be able to reconstruct the work from the PRD, scope file, repository, `AGENTS.md`, and project-local skills.
