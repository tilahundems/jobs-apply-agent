import { db, project, task, tenantWhere, user } from "@et/db"
import { and, eq, exists, isNull, or, type SQL } from "drizzle-orm"

/** A task may expose its linked project's name and assignee's identity. */
export function visibleTasks(
  taskConditions: SQL,
  projectConditions: SQL,
  userConditions: SQL
) {
  return and(
    taskConditions,
    or(
      isNull(task.projectId),
      exists(
        db
          .select({ id: project.id })
          .from(project)
          .where(
            and(
              eq(project.id, task.projectId),
              tenantWhere(project.organizationId),
              isNull(project.deletedAt),
              projectConditions
            )
          )
      )
    ),
    or(
      isNull(task.assigneeId),
      exists(
        db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.id, task.assigneeId), userConditions))
      )
    )
  )!
}
