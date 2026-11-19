# Build a new product from this kit

Run `pnpm new`, install dependencies, run `pnpm check:fix`, migrate an isolated local database, and sign in with the development seed. Keep the account, session, role, and permission infrastructure. Projects, Tasks, and Tags are examples to study and replace as the product takes shape.

## Add one product feature

Use this file map for a complete vertical slice. Inspect the closest example and its callers before editing.

| Step | Files to follow | What to decide and verify |
| --- | --- | --- |
| Data | `libs/db/src/schemas/*`, `libs/db/src/schema.ts`, `libs/db/src/index.ts` | Define columns, foreign keys, indexes, and relations. Generate and review a new migration; never rewrite an applied migration. Task shows Project and User foreign keys; ProjectTag shows a join table. |
| Contract | `libs/contracts/src/index.ts` | Define writable fields, bounded list inputs, and response shape. Keep server validation authoritative. |
| API | `apps/api/src/projects/` or `apps/api/src/tasks/` | Add module, controller, and service. Derive the actor from the session. Apply `@UsePermision` and `@Conditions()` to reads and existing-record writes; assert the create or update candidate and changed fields. Check access to related records separately. Return deliberate 4xx errors. |
| Permission | `libs/contracts/src/index.ts` `SUBJECTS`, `apps/api/src/seed.ts` | Add the subject and only the role grants the product needs. Verify an unassigned user remains denied. |
| Web | `apps/web/src/routes/_main/projects/`, `apps/web/src/features/projects/` | Add route, API/query options, form, list, and detail UI. Gate protected queries where they run. Put every server input in the query key. For lists, filter and sort on the server before pagination and return the filtered total. |
| Proof | `apps/api/test/security.integration.test.ts`, `apps/web/e2e/core-flows.spec.ts` | Prove validation and access at the HTTP boundary. Prove the main user journey in a browser against the isolated test database. |

The shared [main and detail page UI guide](../apps/web/src/components/detail-page.md) defines list and record layouts. Keep API and web data shapes in step; add a response contract when a new feature would otherwise require duplicate hand-written response types.

Optional starter-kit features (audit logging, API documentation, payment, internationalization, mobile) live in their own folders, listed in the `FEATURES` table in `scripts/new.mjs`. Optional API modules register in `apps/api/src/features.ts`. Mark each line that references an optional feature elsewhere with a trailing `// feature:<name>` comment, or wrap a block in `feature:<name>:start` and `feature:<name>:end`, so `pnpm new` can remove it. Record audit events through `@InjectAudit()` and `this.audit?.record(...)`, which keeps working when audit logging is removed.

## Replace demo domains

1. Identify the product's first record, user journey, and roles. Implement and verify that journey before removing every example.
2. Replace demo routes, sidebar and global-search entries, dashboard counts, and empty states with product concepts.
3. Replace Project, Task, and Tag subjects and demo grants in the contracts and seed only after all callers have moved. Keep account, session, role, permission, and user administration infrastructure.
4. Remove demo API modules, web features, schemas, and related exports when no longer used. Generate a migration for a new product database; do not edit migrations already applied elsewhere.
5. Replace the demo browser scenario and test seed with the product's main journey and a critical access boundary. Keep `pnpm test:e2e` in CI.
6. Run `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, and `pnpm test:e2e` against an isolated test database. Review the generated project with `pnpm test:generated` when changing setup choices.
