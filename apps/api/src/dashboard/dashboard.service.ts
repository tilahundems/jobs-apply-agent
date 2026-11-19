import { AuthzService } from "@et/authz"
import { db, project, projectTag, task, tenantWhere, user } from "@et/db"
import { Inject, Injectable } from "@nestjs/common"
import {
  and,
  eq,
  exists,
  gte,
  isNull,
  lt,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm"

import { visibleTasks } from "../tasks/task-visibility.js"

const countWhere = (condition: SQL) =>
  sql<number>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`.mapWith(
    Number
  )

const dateKey = (date: Date) => date.toISOString().slice(0, 10)

@Injectable()
export class DashboardService {
  constructor(@Inject(AuthzService) private readonly authz: AuthzService) {}

  async summary(userId: string) {
    const ability = await this.authz.abilityForUser(userId)
    const projects = and(
      this.authz.conditions(ability, "read", "Project"),
      tenantWhere(project.organizationId),
      isNull(project.deletedAt)
    )!
    const tasks = and(
      tenantWhere(task.organizationId),
      visibleTasks(
        this.authz.conditions(ability, "read", "Task"),
        this.authz.conditions(ability, "read", "Project"),
        this.authz.conditions(ability, "read", "User")
      )
    )!
    const now = new Date()
    const today = dateKey(now)
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    )
    const firstDay = new Date(now)
    firstDay.setUTCDate(firstDay.getUTCDate() - 89)
    firstDay.setUTCHours(0, 0, 0, 0)
    const overdue = and(ne(task.status, "done"), lt(task.dueDate, today))!
    const projectDay = sql<string>`strftime('%Y-%m-%d', ${project.createdAt}, 'unixepoch')`
    const taskDay = sql<string>`strftime('%Y-%m-%d', ${task.createdAt}, 'unixepoch')`

    const projectStats = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        thisMonth: countWhere(gte(project.createdAt, monthStart)),
        tagged: countWhere(
          exists(
            db
              .select({ id: projectTag.projectId })
              .from(projectTag)
              .where(
                and(
                  tenantWhere(projectTag.organizationId),
                  eq(projectTag.projectId, project.id)
                )
              )
          )
        ),
      })
      .from(project)
      .where(projects)
    const taskStats = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        todo: countWhere(eq(task.status, "todo")),
        inProgress: countWhere(eq(task.status, "in_progress")),
        done: countWhere(eq(task.status, "done")),
        highPriorityOpen: countWhere(
          and(ne(task.status, "done"), eq(task.priority, "high"))!
        ),
        overdue: countWhere(overdue),
      })
      .from(task)
      .where(tasks)
    const projectDays = await db
      .select({
        date: projectDay,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(project)
      .where(and(projects, gte(project.createdAt, firstDay)))
      .groupBy(projectDay)
    const taskDays = await db
      .select({ date: taskDay, count: sql<number>`count(*)`.mapWith(Number) })
      .from(task)
      .where(and(tasks, gte(task.createdAt, firstDay)))
      .groupBy(taskDay)
    const priorities = await db
      .select({
        priority: task.priority,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(task)
      .where(tasks)
      .groupBy(task.priority)
    const assignees = await db
      .select({
        assignee: sql<string>`coalesce(${user.name}, 'Unassigned')`,
        onSchedule: countWhere(
          and(
            ne(task.status, "done"),
            or(isNull(task.dueDate), gte(task.dueDate, today))
          )!
        ),
        overdue: countWhere(overdue),
      })
      .from(task)
      .leftJoin(user, eq(task.assigneeId, user.id))
      .where(and(tasks, ne(task.status, "done")))
      .groupBy(user.name)

    const projectCount = projectStats[0]?.total ?? 0
    const taskCount = taskStats[0]?.total ?? 0
    const doneCount = taskStats[0]?.done ?? 0
    const daily = new Map<
      string,
      { date: string; projects: number; tasks: number }
    >()
    for (let offset = 89; offset >= 0; offset--) {
      const date = new Date(now)
      date.setUTCDate(date.getUTCDate() - offset)
      const key = dateKey(date)
      daily.set(key, { date: key, projects: 0, tasks: 0 })
    }
    for (const row of projectDays) {
      const point = daily.get(row.date)
      if (point) point.projects = row.count
    }
    for (const row of taskDays) {
      const point = daily.get(row.date)
      if (point) point.tasks = row.count
    }

    const rankedAssignees = assignees
      .map(({ assignee, onSchedule, overdue: overdueCount }) => ({
        assignee,
        onSchedule,
        overdue: overdueCount,
      }))
      .sort(
        (a, b) =>
          b.onSchedule + b.overdue - a.onSchedule - a.overdue ||
          a.assignee.localeCompare(b.assignee)
      )
    const visibleAssignees = rankedAssignees.slice(0, 7)
    if (rankedAssignees.length > 8) {
      visibleAssignees.push(
        rankedAssignees.slice(7).reduce(
          (other, row) => ({
            assignee: "Other",
            onSchedule: other.onSchedule + row.onSchedule,
            overdue: other.overdue + row.overdue,
          }),
          { assignee: "Other", onSchedule: 0, overdue: 0 }
        )
      )
    } else if (rankedAssignees.length === 8) {
      visibleAssignees.push(rankedAssignees[7]!)
    }

    return {
      stats: {
        projectCount,
        projectsThisMonth: projectStats[0]?.thisMonth ?? 0,
        taggedProjectCount: projectStats[0]?.tagged ?? 0,
        taskCount,
        openTaskCount: taskCount - doneCount,
        todoCount: taskStats[0]?.todo ?? 0,
        inProgressCount: taskStats[0]?.inProgress ?? 0,
        doneCount,
        highPriorityOpenCount: taskStats[0]?.highPriorityOpen ?? 0,
        overdueCount: taskStats[0]?.overdue ?? 0,
        completionPercent:
          taskCount === 0 ? 0 : Math.round((doneCount / taskCount) * 100),
      },
      daily: [...daily.values()],
      priorities,
      assignees: visibleAssignees,
    }
  }
}
