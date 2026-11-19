---
name: sync
description: After a completed change, update only durable repository guidance or scope status made stale by that change.
---

## What this skill does

After a completed code change, update only repository guidance or delivery status that the change made stale. If the diff is documentation-only or nothing is stale, stop.

`AGENTS.md` is the canonical repository guidance. Preserve existing prose and edit only specific stale lines.

## Boundaries

| Artifact | Allowed change |
|---|---|
| Existing `AGENTS.md` | Add or correct a specific durable fact, command, or pointer. Preserve curated prose. |
| New nested `AGENTS.md` | Create only for a coherent area introduced wholly by this change. Do not create or restructure root guidance. |
| Relevant scope | Mark a slice complete only when its acceptance and proof are supported by repo evidence. Do not change scope boundaries. |
| Linked spec | Correct only an unambiguous `**Status**:` line; leave `Assumed` and content changes for the spec owner. |

When evidence is ambiguous, report it instead of editing.

Scope and spec files are optional. Use the location the repo already has; do not create workflow documents merely to sync them.

## Execution

### 1. Scope the change set

Inspect the requested change with `git status --short` and a diff against its relevant base. Include untracked source files. Note added and deleted paths; ignore generated files.

**If only documentation, tests, lock files, or generated files changed, stop.** They do not create new source conventions to sync.

### 2. Read only affected guidance

Read root `AGENTS.md`, the nearest nested guidance for changed paths, and a relevant existing scope or linked spec if one exists. Check whether the code change actually makes any line stale. Dependency changes do not trigger plugin or skill discovery.

### 3. Make surgical edits

Update only facts proven stale by the change. A scope status requires evidence for its stated acceptance and proof. A spec status requires an unambiguous link to that scope item. Never rewrite curated prose or spec content; report a conflict instead. Check that a repeated sync would make no further edits.

### 4. Relay the result

Report changed files, the evidence for each update, and unresolved conflicts. If nothing changed, say the guidance is current.
