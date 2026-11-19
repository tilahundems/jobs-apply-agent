import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { organizationIdColumn } from "./tenant-policy.js"
import { createdAt, updatedAt } from "./timestamps.js"

export const project = sqliteTable(
  "project",
  {
    id: text("id").primaryKey(),
    organizationId: organizationIdColumn(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    index("project_organization_id_idx").on(table.organizationId),
    uniqueIndex("project_id_organization_uidx").on(
      table.id,
      table.organizationId
    ),
  ]
)
