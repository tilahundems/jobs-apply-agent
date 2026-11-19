import { relations } from "drizzle-orm"
import {
  foreignKey,
  index,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { project } from "./project-schema.js"
import { task } from "./task-schema.js"
import { organizationIdColumn } from "./tenant-policy.js"
import { createdAt, updatedAt } from "./timestamps.js"

export const tag = sqliteTable(
  "tag",
  {
    id: text("id").primaryKey(),
    organizationId: organizationIdColumn(),
    label: text("label").notNull(),
    color: text("color").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("tag_organization_id_idx").on(table.organizationId),
    uniqueIndex("tag_id_organization_uidx").on(table.id, table.organizationId),
  ]
)

export const projectTag = sqliteTable(
  "project_tag",
  {
    organizationId: organizationIdColumn(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.tagId] }),
    index("project_tag_tagId_idx").on(table.tagId),
    index("project_tag_organization_id_idx").on(table.organizationId),
    foreignKey({
      columns: [table.projectId, table.organizationId],
      foreignColumns: [project.id, project.organizationId],
      name: "project_tag_project_tenant_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tagId, table.organizationId],
      foreignColumns: [tag.id, tag.organizationId],
      name: "project_tag_tag_tenant_fk",
    }).onDelete("cascade"),
  ]
)

export const tagRelations = relations(tag, ({ many }) => ({
  projectTags: many(projectTag),
}))

export const projectRelations = relations(project, ({ many }) => ({
  projectTags: many(projectTag),
  tasks: many(task),
}))

export const projectTagRelations = relations(projectTag, ({ one }) => ({
  project: one(project, {
    fields: [projectTag.projectId],
    references: [project.id],
  }),
  tag: one(tag, {
    fields: [projectTag.tagId],
    references: [tag.id],
  }),
}))
