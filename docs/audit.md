# Audit logging

Operational logs answer how the service is running; audit logs answer who
did what and when. Operational logs follow `Pino → stdout → external collector
→ Loki`. Audit events are append-only records stored in PostgreSQL, which is
the authoritative source. Retention is application-specific and should be set
to meet business, legal, and storage requirements; this starter kit does not
delete audit logs automatically.

Inject the recorder with `@InjectAudit()` from `apps/api/src/common/audit.port.ts`.
It is undefined when audit logging is removed, so call it as
`this.audit?.record(...)`. Record events in the same Drizzle transaction as the
business change so both commit or roll back together, and use `auditChanges`
to keep only the fields that changed:

```ts
await db.transaction(async (tx) => {
  await tx.update(project).set({ name: "New name" })
  await this.audit?.record(
    {
      actorId: session.user.id,
      actorType: "USER",
      action: "PROJECT_UPDATED",
      resourceType: "project",
      resourceId: projectId,
      oldValues: { name: "Old name" },
      newValues: { name: "New name" },
    },
    tx
  )
})
```

Pass only meaningful changed fields. Passwords, tokens, authorization data,
cookies, API keys, secrets, OTPs, and private keys are redacted defensively;
never include them in audit input. A structured operational log copy may be
emitted for Loki search, but Loki is not authoritative and audit correctness
does not depend on it.

Projects, roles, permissions, and user role assignments are audited. The `GET /api/v1/audit-logs` endpoint requires an
explicit CASL `read AuditLog` grant and supports bounded page pagination and
actor, action, resource, organization, and date filters.
