import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { user } from "./auth-schema.js"
import { organizationIdColumn } from "./tenant-policy.js"
import { createdAt, updatedAt } from "./timestamps.js"

export const notification = sqliteTable(
  "notification",
  {
    id: text("id").primaryKey(),
    organizationId: organizationIdColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    data: text("data", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    actionUrl: text("action_url"),
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("notification_user_created_idx").on(
      table.userId,
      table.createdAt,
      table.id
    ),
    index("notification_user_read_created_idx").on(
      table.userId,
      table.readAt,
      table.createdAt
    ),
    index("notification_organization_id_idx").on(table.organizationId),
  ]
)
