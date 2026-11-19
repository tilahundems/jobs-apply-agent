---
name: diagnosing-bugs
description: Diagnose a hard bug or performance regression with a focused reproduction and evidence-led fix.
---

# Diagnosing Bugs

A focused loop for hard bugs. Adapt the depth to the failure.

When exploring the codebase, read `CONTEXT.md` (if it exists) to get a clear mental model of the relevant modules, and check ADRs in the area you're touching.

## Redact

This skill has you show commands, outputs and captured artifacts. **Redact every secret first**: write `<REDACTED>` in its place. Build loops against env vars, so the credential stays in the environment rather than in what you show. Captured artifacts carry auth headers: quote only the lines that carry the signal.

If the redacted output is not enough to diagnose the bug, say so and ask the user.

## Phase 1: Build a feedback loop

Find the quickest reliable way to observe the user's exact symptom. Inspect the relevant code and callers as needed to build it.

Use an existing focused test or a small HTTP, CLI, or browser reproduction. For intermittent failures, repeat the trigger and report its observed rate. Use [scripts/hitl-loop.template.sh](scripts/hitl-loop.template.sh) only if a human action is unavoidable.

### Tighten the loop

Make the check specific to the symptom and as repeatable as practical. Avoid unrelated setup.

### Non-deterministic bugs

Measure the reproduction rate before and after the fix when the bug is intermittent.

### When you genuinely cannot build a loop

Report what you tried and request the smallest missing artifact or environment access. You may still inspect code and form a clearly labeled hypothesis, but do not claim a verified fix.

Before changing code, record the reproduction command or observation and its result. If the symptom cannot be reproduced, state how that limits confidence.

## Phase 2: Reproduce + minimise

Confirm the reproduction matches the user's symptom, including the wrong output, error, or timing.

### Minimise

Reduce expensive setup or irrelevant inputs only as far as needed to identify the fault. Keep the original scenario for final verification.

## Phase 3: Hypothesise

Form a falsifiable cause from the evidence. Compare alternatives when the first explanation is uncertain; test the cheapest distinguishing prediction first.

## Phase 4: Instrument

Use a debugger, targeted log, profiler, or query plan to distinguish causes. Change one variable at a time; remove temporary instrumentation afterward. For performance work, compare measured before and after values under the same conditions.

## Phase 5: Fix + regression test

When a suitable public seam exists, turn the reproduction into a failing regression test before the fix. Afterward, rerun both the focused test and original scenario. If no suitable seam exists, explain how the fix was verified.

## Phase 6: Cleanup

Required before declaring done:

- Original symptom no longer reproduces under the recorded check.
- The regression test passes, or its absence is explained.
- Temporary instrumentation and throwaway artifacts are removed.
- Report the cause, evidence, fix, and verification limit.
