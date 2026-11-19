import { AuthzService, an } from "@et/authz"
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskInput,
  type TaskListQuery,
} from "@et/contracts"
import {
  type Database,
  db,
  member,
  project,
  requiredOrganizationId,
  task,
  tenantWhere,
  user,
} from "@et/db"
import { HttpStatus, Inject, Injectable } from "@nestjs/common"
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  not,
  type SQL,
  sql,
} from "drizzle-orm"
import {
  dateFilter,
  type ListFilterRule,
  likeMatches,
  matchingEnumValues,
  paginate,
  textFilter,
  textMatch,
} from "../common/list-query.js"
import { env } from "../env.js"
import { apiError } from "../http/api-error.js"
import { NotificationsService } from "../notifications/notifications.service.js"
import { visibleTasks } from "./task-visibility.js"

const projectColumns = {
  id: true,
  name: true,
} as const

const assigneeColumns = {
  id: true,
  name: true,
  email: true,
} as const

type DbClient = Pick<Database, "query">

async function resolveProject(
  tx: DbClient,
  projectId: string | null,
  conditions: SQL
) {
  if (projectId == null) {
    return null
  }

  const row = await tx.query.project.findFirst({
    columns: projectColumns,
    where: (projectTable, { and: andOp, eq: eqOp, isNull: isNullOp }) =>
      andOp(
        eqOp(projectTable.id, projectId),
        tenantWhere(projectTable.organizationId),
        isNullOp(projectTable.deletedAt),
        conditions
      ),
  })

  if (!row) {
    apiError(HttpStatus.BAD_REQUEST, "Project not found.")
  }

  return row
}

async function resolveAssignee(
  tx: DbClient,
  assigneeId: string | null,
  conditions: SQL
) {
  if (assigneeId == null) {
    return null
  }

  if (env.MULTI_TENANCY) {
    const membership = await db.query.member.findFirst({
      where: and(
        eq(member.userId, assigneeId),
        eq(member.organizationId, requiredOrganizationId())
      ),
    })
    if (!membership)
      apiError(
        HttpStatus.BAD_REQUEST,
        "Assignee is not a member of this organization."
      )
  }

  const row = await tx.query.user.findFirst({
    columns: assigneeColumns,
    where: (userTable, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(userTable.id, assigneeId), conditions),
  })

  if (!row) {
    apiError(HttpStatus.BAD_REQUEST, "Assignee not found.")
  }

  return row
}

function serializeTask<
  T extends {
    project: { id: string; name: string; deletedAt?: Date | null } | null
    assignee: { id: string; name: string; email: string } | null
  },
>(row: T) {
  return {
    ...row,
    project: row.project
      ? {
          id: row.project.id,
          name: row.project.name,
        }
      : null,
  }
}

const projectName = sql`(select ${project.name} from ${project} where ${project.id} = ${task.projectId})`
const assigneeName = sql`(select ${user.name} from ${user} where ${user.id} = ${task.assigneeId})`

/** Matches a task by its linked project's or assignee's name. */
function relatedNameFilter(
  related: typeof project | typeof user,
  link: SQL,
  rule: ListFilterRule
) {
  const { predicate, negate } = textMatch(related.name, rule)
  const match = exists(
    db.select({ id: sql`1` }).from(related).where(and(link, predicate))
  )
  return negate ? not(match) : match
}

function enumFilter(
  column: typeof task.status | typeof task.priority,
  values: string[]
) {
  return values.length > 0 ? inArray(column, values as never[]) : sql`false`
}

function taskFilter(rule: ListFilterRule): SQL {
  switch (rule.field) {
    case "project":
      return relatedNameFilter(project, eq(project.id, task.projectId), rule)
    case "assignee":
      return relatedNameFilter(user, eq(user.id, task.assigneeId), rule)
    case "status":
      return enumFilter(
        task.status,
        matchingEnumValues(TASK_STATUS_LABELS, rule)
      )
    case "priority":
      return enumFilter(
        task.priority,
        matchingEnumValues(TASK_PRIORITY_LABELS, rule)
      )
    case "dueDate":
      return dateFilter(task.dueDate, rule)
    case "createdAt":
      return dateFilter(task.createdAt, rule)
    default:
      return textFilter(task.title, rule)
  }
}

const taskSortColumns = {
  title: task.title,
  project: projectName,
  status: task.status,
  priority: task.priority,
  assignee: assigneeName,
  dueDate: task.dueDate,
  createdAt: task.createdAt,
} as const

@Injectable()
export class TasksService {
  constructor(
    @Inject(AuthzService) private readonly authz: AuthzService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService
  ) {}

  /** Tells a newly assigned user about the task, unless they assigned it. */
  private async notifyAssignee(
    actorId: string,
    taskRow: { id: string; title: string; assigneeId: string | null },
    previousAssigneeId: string | null = null
  ) {
    const assigneeId = taskRow.assigneeId
    if (!assigneeId || assigneeId === actorId) return
    if (assigneeId === previousAssigneeId) return
    await this.notifications.notify({
      userId: assigneeId,
      type: "task.assigned",
      title: "Task assigned",
      message: `You were assigned "${taskRow.title}".`,
      data: { taskId: taskRow.id },
      actionUrl: `/tasks/${taskRow.id}`,
    })
  }

  private async relatedConditions(userId: string) {
    const ability = await this.authz.abilityForUser(userId)
    return {
      projects: this.authz.conditions(ability, "read", "Project"),
      users: this.authz.conditions(ability, "read", "User"),
    }
  }

  async list(userId: string, conditions: SQL) {
    const related = await this.relatedConditions(userId)
    const rows = await db.query.task.findMany({
      where: and(
        tenantWhere(task.organizationId),
        visibleTasks(conditions, related.projects, related.users)
      ),
      with: {
        project: {
          columns: {
            ...projectColumns,
            deletedAt: true,
          },
        },
        assignee: {
          columns: assigneeColumns,
        },
      },
      orderBy: (taskTable, { desc }) => [desc(taskTable.createdAt)],
    })

    return rows.map((row) => serializeTask(row))
  }

  async page(userId: string, query: TaskListQuery, conditions: SQL) {
    const related = await this.relatedConditions(userId)
    const filters = [
      tenantWhere(task.organizationId),
      visibleTasks(conditions, related.projects, related.users),
    ]
    if (query.search) {
      filters.push(likeMatches(task.title, query.search))
    }
    filters.push(...query.filter.map(taskFilter))
    const where = and(...filters)
    const order = query.sort.direction === "asc" ? asc : desc

    return await paginate(
      query,
      async (window) =>
        (
          await db.query.task.findMany({
            where,
            with: {
              project: { columns: { ...projectColumns, deletedAt: true } },
              assignee: { columns: assigneeColumns },
            },
            orderBy: [order(taskSortColumns[query.sort.field]), order(task.id)],
            ...window,
          })
        ).map(serializeTask),
      () => db.select({ value: count() }).from(task).where(where)
    )
  }

  async create(userId: string, input: TaskInput) {
    const candidate = {
      id: crypto.randomUUID(),
      ...input,
      organizationId: requiredOrganizationId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await this.authz.assert(
      userId,
      "create",
      an("Task", candidate),
      Object.keys(input)
    )

    const related = await this.relatedConditions(userId)
    const created = await db.transaction(async (tx) => {
      const linkedProject = await resolveProject(
        tx,
        input.projectId,
        related.projects
      )
      const linkedAssignee = await resolveAssignee(
        tx,
        input.assigneeId,
        related.users
      )

      const [taskRow] = await tx
        .insert(task)
        .values({
          id: candidate.id,
          organizationId: candidate.organizationId,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          projectId: linkedProject?.id ?? null,
          assigneeId: linkedAssignee?.id ?? null,
          dueDate: input.dueDate,
        })
        .returning()

      if (!taskRow) {
        apiError(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to create task")
      }

      return {
        ...taskRow,
        project: linkedProject,
        assignee: linkedAssignee,
      }
    })
    await this.notifyAssignee(userId, created)
    return created
  }

  async update(userId: string, id: string, input: TaskInput, conditions: SQL) {
    const related = await this.relatedConditions(userId)
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(task)
        .where(
          and(conditions, tenantWhere(task.organizationId), eq(task.id, id))
        )

      if (!existing) {
        return null
      }

      await this.authz.assert(
        userId,
        "update",
        an("Task", { ...existing, ...input }),
        Object.keys(input)
      )

      const linkedProject = await resolveProject(
        tx,
        input.projectId,
        related.projects
      )
      const linkedAssignee = await resolveAssignee(
        tx,
        input.assigneeId,
        related.users
      )

      const [taskRow] = await tx
        .update(task)
        .set({
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          projectId: linkedProject?.id ?? null,
          assigneeId: linkedAssignee?.id ?? null,
          dueDate: input.dueDate,
        })
        .where(
          and(conditions, tenantWhere(task.organizationId), eq(task.id, id))
        )
        .returning()

      if (!taskRow) {
        return null
      }

      return {
        task: { ...taskRow, project: linkedProject, assignee: linkedAssignee },
        previousAssigneeId: existing.assigneeId,
      }
    })

    if (!updated) {
      apiError(HttpStatus.NOT_FOUND, "Task not found")
    }

    await this.notifyAssignee(userId, updated.task, updated.previousAssigneeId)
    return updated.task
  }

  async remove(id: string, conditions: SQL) {
    const [deleted] = await db
      .delete(task)
      .where(and(conditions, tenantWhere(task.organizationId), eq(task.id, id)))
      .returning({ id: task.id })

    if (!deleted) {
      apiError(HttpStatus.NOT_FOUND, "Task not found")
    }

    return { ok: true as const }
  }
}
