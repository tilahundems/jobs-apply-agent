# Repository guidance

The current code is the source of truth. Before editing, inspect the closest working implementation and the affected callers. Extend its pattern unless the requested behavior needs a different one. Implement ordinary features directly; use the PRD and scope workflow only when requested or when a design choice cannot be resolved from the request and code.

For a new product feature or demo replacement, follow the file map and adoption checklist in `docs/new-product.md`.

## Boundaries

- API: Follow the existing NestJS controller, Zod input, service, and module structure. Validate writable fields and list bounds. Return deliberate response shapes and preserve expected 4xx errors.
- Access: Derive the actor from the server session. Use the existing `@UsePermision` spelling; apply `@Conditions()` in existing-record queries. Authorize create and update candidates with `AuthzService.assert`, including changed fields. Check related data separately; UI visibility is not enforcement.
- Delegation: Require explicit authority to assign roles or grant and revoke permissions. Use the shared role-management lock for assignment writes and preserve the last-manager invariant.
- Database: Review generated migrations and keep applied migrations immutable. Use one transaction client for dependent work; throw to roll back. Identify an isolated target before migrations, seeds, or database tests. The demo seed can rewrite records and role links.
- Web: Use the existing Vite, TanStack Router, React Query, and form patterns. Include server inputs in query keys, gate protected queries where they execute, and use the session cache when identity or permissions change. Keep paginated totals and dashboard aggregates accurate.
- Examples: Keep Projects, Tasks, and Tags in the starter kit as connected references. Task shows foreign keys to Project and User; ProjectTag shows a many-to-many join between Project and Tag. New products may replace these demo domains, but preserve account, session, role, and permission infrastructure.
- List and detail pages: Follow [the main and detail page UI guide](apps/web/src/components/detail-page.md). Projects is the server-paginated list reference.
- Optional features: Mark references to an optional feature as described in [the new-product guide](docs/new-product.md), which also holds the E2E adoption checklist.

## Verification

Choose the smallest check that proves changed behavior. Use the real HTTP boundary for API validation and guards, and an isolated database for persistence or permission invariants. Report what ran, what passed, and any limits; documentation-only edits need link and diff checks, not an app build.
