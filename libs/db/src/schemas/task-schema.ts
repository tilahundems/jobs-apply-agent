import { relations } from "drizzle-orm"
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { user } from "./auth-schema.js"
import { project } from "./project-schema.js"
import { organizationIdColumn } from "./tenant-policy.js"
import { createdAt, updatedAt } from "./timestamps.js"

export const TASK_STATUS_VALUES = ["todo", "in_progress", "done"] as const
export const TASK_PRIORITY_VALUES = ["low", "medium", "high"] as const

export const task = sqliteTable(
  "task",
  {
    id: text("id").primaryKey(),
    organizationId: organizationIdColumn(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: TASK_STATUS_VALUES })
      .default("todo")
      .notNull(),
    priority: text("priority", { enum: TASK_PRIORITY_VALUES })
      .default("medium")
      .notNull(),
    assigneeId: text("assignee_id").references(() => user.id, {
      onDelete: "set null",
    }),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    dueDate: text("due_date"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("task_projectId_idx").on(table.projectId),
    index("task_assigneeId_idx").on(table.assigneeId),
    index("task_organization_id_idx").on(table.organizationId),
  ]
)

export const taskRelations = relations(task, ({ one }) => ({
  project: one(project, {
    fields: [task.projectId],
    references: [project.id],
  }),
  assignee: one(user, {
    fields: [task.assigneeId],
    references: [user.id],
  }),
}))
