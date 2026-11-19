import { index, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { organizationIdColumn } from "./tenant-policy.js"
import { createdAt } from "./timestamps.js"

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    createdAt: createdAt(),
    actorId: text("actor_id"),
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    organizationId: organizationIdColumn(),
    oldValues: text("old_values", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    newValues: text("new_values", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    metadata: text("metadata", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    requestId: text("request_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("audit_log_created_at_idx").on(table.createdAt),
    index("audit_log_actor_id_idx").on(table.actorId),
    index("audit_log_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_log_organization_id_idx").on(table.organizationId),
    index("audit_log_action_idx").on(table.action),
  ]
)
