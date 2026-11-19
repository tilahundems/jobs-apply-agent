---
name: code-review
description: Review a branch, PR, or working-tree diff for correctness, repository conventions, and fit with the request or spec.
---

Review the requested diff along two axes:

- **Standards**: does the code conform to this repo's documented coding standards?
- **Spec**: does the code faithfully implement the originating issue / spec?

Use `AGENTS.md`, affected code, and any supplied spec as sources. Keep findings concrete and prioritized.

## Process

### 1. Pin the fixed point

Use the fixed point the user names. Otherwise infer it from the task: inspect uncommitted changes for working-tree reviews, or use the branch merge-base for branch reviews. Confirm the resulting diff is the intended one before reporting findings.

### 2. Identify the spec source

Use the user's request, linked issue, or relevant local spec when available. If no spec exists, review the observable behavior and state that limit.

### 3. Identify the standards sources

Check `AGENTS.md` and any other relevant repository guidance. Flag maintainability issues only when the diff gives concrete evidence of a likely cost; avoid generic smell inventories and rules enforced by tooling.

For changes to web list or detail pages, check the layout against [the main and detail page UI guide](../../../apps/web/src/components/detail-page.md).

### 4. Review

Trace changed behavior through affected callers and tests. Report actionable regressions, missing requirements, or repository-rule violations with file and line evidence. Separate confirmed defects from judgment calls.

### 5. Aggregate

Lead with findings by severity. For each, give location, impact, and a practical fix. State when no findings were found and note material review limits.
