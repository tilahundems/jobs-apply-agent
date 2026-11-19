# Optional organization tenancy

> This build stores data in SQLite, which has no row-level security, so `MULTI_TENANCY=true` is rejected at startup. Everything below applies only to a PostgreSQL build of the kit. Set `MULTI_TENANCY=false`.

Set `MULTI_TENANCY=true` for the API and `VITE_MULTI_TENANCY=true` for the web build. The default is single-tenant mode. Apply migrations before enabling tenancy.

The Better Auth Organizations plugin owns organization, member, invitation, and active-session records. Users may belong to several organizations. The sidebar lets a user create an organization, switch between memberships, invite someone by email, and share the generated invitation code. An invited user can sign in and enter that code to join. Invitation delivery is manual; configure Better Auth's `sendInvitationEmail` if you want email delivery.

Projects, tasks, tags, project-tag links, audit logs, and notifications have a non-null `organization_id`. Drizzle defines their `pgPolicy` rules alongside the table schemas; migrations enable and force RLS. Each policy applies to all four operations with `USING` and `WITH CHECK`. The API checks membership against Better Auth's `member` table, then runs each ordinary request in a Drizzle transaction with transaction-local `app.current_organization_id`. Feature queries also include organization predicates. CASL loads rules from the active membership: Better Auth `owner` and `admin` map to the existing admin role, and `member` maps to the existing user role. In tenant mode, CASL grants only tenant feature actions, organization-member directory reads, and audit reads. Better Auth handles organization membership changes; the starter kit's global role-management endpoints are unavailable to tenant members.

## Database roles

Use separate credentials for migrations and the application. The migration owner must be able to alter tables. The application login must not be a superuser, have `BYPASSRLS`, or own tenant tables. Startup rejects a role that violates those conditions or does not have active RLS on every tenant table.

When `pnpm new` selects multi-tenancy, it writes `MIGRATION_DATABASE_URL` for the local Docker owner and a generated restricted `DATABASE_URL` for the API. Run `pnpm db:up`, then `pnpm db:migrate`. The migration command applies migrations with the owner connection and creates or updates the application login and grants. Run `pnpm db:seed` to create the demo users, a Demo Workspace organization with owner/member memberships, and tenant-scoped Projects, Tasks, and Tags. The seed is repeatable and keeps its tenant records separate from legacy single-tenant demo records. After signing in, select Demo Workspace in the organization switcher. Keep the generated `.env` private. On managed PostgreSQL, the migration login must have permission to create or alter the application role and grant table access.

For an existing project or database without that privilege, provision a restricted login with an administrator connection (replace the role, database, and password):

```sql
CREATE ROLE et_app LOGIN PASSWORD 'replace-with-a-secret' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE et TO et_app;
GRANT USAGE ON SCHEMA public TO et_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO et_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO et_app;
```

Configure `MIGRATION_DATABASE_URL` with the owner connection and `DATABASE_URL` with the `et_app` connection. Run `pnpm db:migrate` with those variables. The command also verifies it can manage that role; if your provider disallows role management, apply migrations with `MULTI_TENANCY=false`, provision the role separately, then start with `MULTI_TENANCY=true`. Do not use the default Docker `et` superuser as the API login in tenant mode. When upgrading an existing database, assign legacy `__single_tenant__` rows to a real organization as one reviewed data migration before enabling tenancy. Keep matching organization IDs on project-tag links and their projects/tags. The generated composite foreign keys reject cross-organization links.

If only the starter CASL role and permission catalog are needed, run `pnpm --filter @et/api seed:roles` instead of the demo data seed.

In single-tenant mode, the database client defaults its PostgreSQL session setting to `__single_tenant__`, so existing seeds and background scripts do not need an organization. Tenant-mode background jobs must call `withTenantTransaction(rootDb, organizationId, work)` before touching tenant-owned tables.

## Verification

`pnpm test:integration` uses an isolated test database. Its tenant test creates a non-owner application role and checks HTTP access, invitations, active switching, and direct unfiltered SQL reads, inserts, updates, and deletes across two organizations. `TEST_DATABASE_URL` must point to a dedicated database whose login can create databases and roles.
