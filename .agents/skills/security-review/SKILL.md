---
name: security-review
description: Review a security-sensitive change across its trust boundaries before merge or release.
disable-model-invocation: true
---

# Security Review

Review the change from a risk-first, evidence-based perspective. This is a conditional gate for security-sensitive work, not a replacement for normal code review.

## 1. Establish scope

Identify the diff/fixed point and the originating spec/ticket. Read repository security/auth/tenant conventions and the relevant changed code plus direct callers/callees.

Use `AGENTS.md` and any existing project security guidance; inspect the relevant code and callers.

Classify changed surfaces as high, medium, or low risk. Spend depth on risky paths rather than reviewing every line equally.

## 2. Identify trust boundaries

Trace changed input, identity, and state through the actual entry points and affected trust boundaries. Focus on reachable paths.

## 3. Review the change

Check applicable failure modes: bypassed authorization, cross-account access, unsafe input handling, injection, secret or sensitive-data exposure, unsafe external callbacks, and races around privileged or irreversible state changes.

Inspect history when the diff removes or relaxes a security check.

Review whether tests/verification actually exercise the security property, including denied and cross-boundary paths, not merely the happy path.

## 4. Findings

Report only actionable findings. For each finding include:

- severity: Critical / High / Medium / Low
- file/location or affected surface
- concrete security property that fails
- short exploit or failure scenario
- evidence from the diff/code
- specific remediation
- verification needed to prove the fix

Separate confirmed findings from assumptions or coverage limits. Do not manufacture findings to fill severity categories.

If no material issue is found, say so and state the important areas covered and meaningful limits.

Do not silently modify product code during the review unless the user explicitly asks for fixes.
