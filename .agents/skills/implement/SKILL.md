---
name: implement
description: Implement ready slices from the approved scope in docs/scope/scope.md and verify their observable behavior. One slice by default; the whole increment when asked.
disable-model-invocation: true
---

# Implement

Implement ready vertical slices from `docs/scope/scope.md`. The default is exactly one slice. When the user asks for the whole increment (all ready slices), follow [Whole increment](#whole-increment) after the slice steps.

For an ordinary feature or fix without a scope artifact, implement it directly under `AGENTS.md` rather than creating workflow documents.

## 1. Select a ready slice

Use the slice the user names. Otherwise take the next `planned` slice whose dependencies are `done` or `existing`; ignore `dropped` slices. If the slice is not ready, stop and report the unmet dependency.

Read the slice, `AGENTS.md`, and the closest implementation and callers. Read PRD context only when the slice leaves business intent unclear. The slice's outcome, acceptance criteria, dependencies, and demo/proof are the implementation contract.

For web list or detail pages, follow [the main and detail page UI guide](../../../apps/web/src/components/detail-page.md).

## 2. Gate on missing load-bearing decisions

When a material business rule, data source, integration contract, or architecture choice is genuinely unresolved, stop: state the missing decision precisely, route product-boundary questions back to `/scope`, and ask the user for the smallest clarification needed. Keep later or deferred work out of the slice.

## 3. Build in verifiable steps

Advance in the smallest steps that can be checked, running the smallest relevant check after each meaningful one. Use TDD when requested or when a behavior test is the clearest proof. The repository stays green before the next slice starts.

## 4. Prove the real behavior

For user-facing work, prove the slice's demo path at the best practical boundary, using an existing harness when one fits, and state any limit. For internal slices, explain why the selected checks are the highest useful proof. Encode recurring invariants in code, tests, or tooling when that is simpler than relying on future instructions.

## 5. Review and finish

Check the final diff against the acceptance criteria and repository guidance. Use `/code-review` when requested or when the change warrants it; fix valid findings and rerun affected proof.

Run `/security-review` before the final commit when the slice touches authentication, authorization, tenancy, payments, sensitive data, secrets, uploads, privileged actions, external callbacks or APIs, deserialization, redirects, or security-relevant configuration.

Mark only this slice `done` after verification. Commit when the task or repository workflow calls for it.

Report fresh evidence: the slice, focused and broader checks, behavior proof, diff check, security review result when applicable, and the commit. Then stop, unless you are implementing the whole increment.

## Whole increment

Implement every active slice in dependency order, applying steps 1–5 to each.

- **Start:** read the scope, git state, and `AGENTS.md`. If the scope is missing, unapproved, contradictory, or has no ready path, route it back to `/scope`. Preserve pre-existing user changes.
- **Parallelism:** run slices in parallel only when their dependencies are independent and their files, schema, policy, and shared configuration are disjoint, each in its own worktree. Otherwise work sequentially. Each worker gets one ready slice and returns its slice ID, changes, evidence, and any blocker; only the coordinator edits the scope file.
- **Frontier:** integrate verified slices one at a time, rerunning the affected check, then mark each `done`. Newly unblocked slices become eligible only once the integrated frontier is green.
- **Blocked:** stop on a missing decision, inconsistent dependency, semantic conflict, or persistent verification failure, and report the blocker with completed, blocked, and remaining slices.
- **Done:** prove the increment's `Done when` end to end, not from slice tests alone. Report the slices completed, integration proof, blockers, and resulting commit. Leave increment-level status to `/sync`.
