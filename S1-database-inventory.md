# Plan — S1 · Database inventory & registration

Slice: `docs/scope/scope.md` → `S1 — Database inventory & registration · planned`.
Build approach: Vertical Tracer Bullets. Depends on: none.
Status: planned (not implemented). Implementation is done by the `/implement` agent.

## Confirmed decisions
1. Duplicate identity: **case-insensitive `databaseName` unique within the workspace** (one team, one central server).
2. **Soft delete is in S1**: remove sets `deletedAt`; the record (and later its history) is preserved, so the PRD's "history on removal" question stays deferred.
3. Default grants: **Admin = full**, **User = read-only inventory** (engineers view; administrators register/edit/delete).

## Contract (acceptance)
- Register a database (display name, database name, owning app/team, notes) → appears in list + detail.
- Registering the same database twice is rejected with a clear error.
- Inventory list is server-paginated/filtered/sorted with accurate totals; shows last-backup ("never"), status, and storage used.
- Enable/disable for scheduling without losing the record.
- A user without inventory permissions cannot read or create databases (denied at the HTTP boundary).
- Register/edit is recorded in the audit trail.
- Demo/proof: register two databases, see them listed and in detail; an unprivileged user is denied; an audit entry exists.

S1 adds a new product domain alongside the demo domains (Projects/Tasks/Tags remain until S6).

## 1. Data layer
New `libs/db/src/schemas/database-schema.ts`, table `managed_database` (not `database`, which collides with the `Database` type):
- `id` text PK
- `organizationId` via `organizationIdColumn()`
- `name` text NOT NULL (display name)
- `databaseName` text NOT NULL (PostgreSQL database name)
- `owner` text NULL (owning app/team)
- `notes` text NULL
- `enabled` boolean NOT NULL default true
- `createdAt`, `updatedAt` (project pattern), `deletedAt` timestamp NULL
- Indexes: `index(organizationId)`; **partial unique** `(organizationId, lower(databaseName)) WHERE deleted_at IS NULL`; `tenantPolicy("managed_database", organizationId)`.

Export `managedDatabase` from `libs/db/src/schema.ts`. Generate one migration with `pnpm db:generate` (never edit `0000_init.sql`), review it, apply on an isolated DB.

## 2. Contracts (`libs/contracts/src/index.ts`)
- `databaseInputSchema`: `name` (1–80); `databaseName` (1–63, `^[A-Za-z_][A-Za-z0-9_$]*$`); `owner`/`notes` via `emptyToNull` (nullable, bounded); `enabled` boolean default true.
- `databaseListQuerySchema = listQuerySchema({ filterFields: ["name","databaseName","owner","enabled","createdAt"], dateFields: ["createdAt"], sortFields: ["name","databaseName","owner","createdAt","updatedAt"], defaultSort: "createdAt" })`.
- Add `"Database"` to `SUBJECTS`.

## 3. API (`apps/api/src/databases/`)
Mirror `projects/` (module, controller, service; `@UsePermision`, `@Conditions()`, Zod query schema).
- `GET /databases` read → paged list
- `GET /databases/:id` read
- `POST /databases` create
- `PATCH /databases/:id` update (enable/disable via `enabled`)
- `DELETE /databases/:id` delete → soft delete
- Service: `tenantWhere` + `isNull(deletedAt)`; search over name/databaseName/owner; text/date filters via `list-query.ts`; boolean `enabled` filter via `matchingEnumValues({ true: "enabled", false: "disabled" }, rule)` + `inArray`; sort map; `paginate` with filtered `count()`.
- **Health placeholders (S2 seam):** rows return `lastBackupAt: null`, `lastBackupStatus: null`, `storageUsedBytes: 0`; S2 replaces these with a join/aggregate without changing the web contract.
- create: candidate → `authz.assert("create", an("Database", candidate), Object.keys(input))` → insert in a transaction → audit `DATABASE_REGISTERED`.
- update: `SELECT … FOR UPDATE` scoped by `conditions` + `tenantWhere` → `authz.assert("update", …)` with merged values and changed fields → `auditChanges` → `DATABASE_UPDATED`.
- delete: soft delete scoped by `conditions` + `tenantWhere` + `isNull(deletedAt)` → audit `DATABASE_DELETED`; 404 when absent.
- Duplicate: pre-check `lower(databaseName)` in-org (null-deleted) → `409 "A database with this name is already registered."`; also translate Postgres `23505` on `managed_database_name_uidx` to the same message.
- Register `DatabasesModule` in `apps/api/src/app.module.ts`.

## 4. Permissions & seed
- `apps/api/src/authz/permissions.ts`: add `Database` to `CATALOG_SUBJECTS`; in the User role filter keep only `read` for `Database` (create/update/delete denied).
- `apps/api/src/authz/subject-tables.ts`: add `Database: managedDatabase`.
- Re-run `pnpm db:seed` on the isolated DB.

## 5. Web (`apps/web/src/...`)
New `features/databases/`: `databases-api.ts`, `databases-table-columns.tsx` (`createTableSearch` + sortFields; columns Name/link, Database name, Owner, Last backup ("Never"), Status, Storage used, Enabled badge, Created, row actions), `databases-table.tsx`, `databases-form.tsx` (name, databaseName, owner, notes, enabled toggle; Add gated by `<Can I="create" a="Database">`), `databases-details.tsx` (plain `RecordDetails`, no tabs), `databases-delete-dialog.tsx` (`confirm-delete-dialog.tsx`), `index.tsx`.
Routes:
- `routes/_main/databases/index.tsx` — `requirePageAbility(..., "read", "Database")`, table search in loader + query key, `<CanView a="Database">`.
- `routes/_main/databases/$databaseId.tsx` — `databaseQueryOptions`, `DetailPagePending`/error/not-found, `<CanView a="Database">`.
`routeTree.gen.ts` regenerates on dev/build.
Shell: add Databases to `components/layout/app-sidebar.tsx` (`subject: "Database"`) and `components/layout/global-search.tsx`; add `Database: "databases"` to `SUBJECT_LABELS` in `features/authz/can-view.tsx`.

## 6. Proof & verification
- Primary (HTTP boundary, isolated DB): new `apps/api/test/databases.integration.test.ts` (guarded like the others) — register two; duplicate → 409 with the clear message; paged list with search/filter/sort accurate totals; enable/disable persists; soft-deleted database leaves the list and its name can be re-registered; a role without `Database` permissions → 403 on GET/POST; an audit `DATABASE_REGISTERED` row exists. Register the file in the integration list in `libs/db/scripts/test-database.mjs`.
- Browser (optional, recommended): extend `apps/web/e2e/core-flows.spec.ts` with register-and-see-in-list.
- Commands: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration` (needs `TEST_DATABASE_URL` ending `_test`). Review the migration diff; confirm the audit entry and 403/409 responses.

## 7. Out of scope for S1
Schedules/backup runs and real health values (S2); catalog (S3); restore (S4); alerts/dashboard (S5); demo-domain replacement (S6); hard delete; retention/holds (CAP-04).
