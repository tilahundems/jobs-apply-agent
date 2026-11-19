---
name: tdd
description: Use a red, green, refactor loop when the user requests test-first feature or bug work.
---

# Test-Driven Development

Use one short red → green → refactor cycle per behavior.

## What a good test is

Choose the narrowest public boundary that can observe the requested behavior. Follow the repository's existing test patterns and `AGENTS.md` verification guidance.

Keep expected results independent of the implementation. Mock external boundaries only when a real isolated dependency is impractical.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

Ask about the test boundary only when the request and code leave a material choice unresolved.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators or tests private methods. Use a database when persistence or permission state is the behavior being verified, as `AGENTS.md` requires. The tell: the test breaks when you refactor but behavior has not changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Bulk test writing**: write one failing behavior test, implement it, then choose the next test using what the first cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **Refactor after green.** Keep the behavior check passing while improving the code.
