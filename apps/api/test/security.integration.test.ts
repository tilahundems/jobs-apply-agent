import assert from "node:assert/strict"
import { test } from "node:test"
import {
  db,
  permission,
  project,
  projectTag,
  role,
  rolePermission,
  tag,
  task,
  userRole,
} from "@et/db"
import { like } from "drizzle-orm"

import { AppModule } from "../src/app.module.js"
import { AuditService } from "../src/audit/audit.service.js"
import { startApp } from "./start-app.js"

test("HTTP access, related records, and complete dashboard totals", {
  skip: process.env.PERMISSION_INTEGRATION_TEST !== "1",
}, async () => {
  const { app, base } = await startApp(AppModule)

  async function signUp(email: string) {
    const response = await fetch(`${base}/api/v1/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        name: email,
        email,
        password: "test-password-123",
      }),
    })
    assert.equal(response.status, 200, await response.clone().text())
    const body = (await response.json()) as { user: { id: string } }
    const cookie = response.headers
      .getSetCookie()
      .map((header) => header.split(";")[0])
      .join("; ")
    assert.ok(cookie)
    return { userId: body.user.id, cookie }
  }

  function request(path: string, cookie: string, init: RequestInit = {}) {
    return fetch(`${base}${path}`, {
      ...init,
      headers: { Cookie: cookie, ...init.headers },
    })
  }

  const jsonPost = (value: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  })

  try {
    const admin = await signUp("admin-security@example.invalid")
    const roles = await db.query.userRole.findMany({
      where: (table, { eq }) => eq(table.userId, admin.userId),
    })
    assert.equal(roles.length, 0, "public sign-up must not grant a demo role")
    assert.equal((await request("/api/v1/projects", admin.cookie)).status, 403)
    assert.equal(
      (await request("/api/v1/audit-logs", admin.cookie)).status,
      403
    )

    await db.insert(role).values({
      id: "test-admin-role",
      key: "test-admin",
      name: "Test admin",
    })
    await db
      .insert(permission)
      .values({ id: "test-manage-all", action: "manage", subject: "all" })
    await db
      .insert(rolePermission)
      .values({ roleId: "test-admin-role", permissionId: "test-manage-all" })
    await db
      .insert(userRole)
      .values({ userId: admin.userId, roleId: "test-admin-role" })

    const invalid = await request(
      "/api/v1/projects",
      admin.cookie,
      jsonPost({ name: "", description: "x" })
    )
    assert.equal(invalid.status, 400, await invalid.text())

    const projects = Array.from({ length: 125 }, (_, index) => ({
      id: `dashboard-project-${index}`,
      name: `Project ${index}`,
      description: "Dashboard count fixture",
    }))
    await db.insert(project).values(projects)
    const summaryResponse = await request("/api/v1/dashboard", admin.cookie)
    assert.equal(
      summaryResponse.status,
      200,
      await summaryResponse.clone().text()
    )
    const summary = (await summaryResponse.json()) as {
      stats: { projectCount: number }
      daily: unknown[]
    }
    assert.equal(summary.stats.projectCount, 125)
    assert.equal(summary.daily.length, 90)

    const projectSearch = await request(
      "/api/v1/projects?page=1&perPage=1&search=Project%20124",
      admin.cookie
    )
    assert.equal(projectSearch.status, 200, await projectSearch.clone().text())
    const searchedProjects = (await projectSearch.json()) as {
      items: Array<{ name: string }>
      total: number
    }
    assert.equal(searchedProjects.total, 1)
    assert.equal(searchedProjects.items[0]?.name, "Project 124")

    const projectFilter = await request(
      "/api/v1/projects?page=1&perPage=1&filter=name:equals:Project%20124",
      admin.cookie
    )
    assert.equal(projectFilter.status, 200, await projectFilter.clone().text())
    assert.equal(((await projectFilter.json()) as { total: number }).total, 1)
    const sortedProjects = await request(
      "/api/v1/projects?page=1&perPage=1&sort=name:desc",
      admin.cookie
    )
    assert.equal(sortedProjects.status, 200)
    assert.equal(
      ((await sortedProjects.json()) as { items: Array<{ name: string }> })
        .items[0]?.name,
      "Project 99"
    )
    assert.equal(
      (
        await request(
          "/api/v1/projects?filter=name:before:2026-01-01",
          admin.cookie
        )
      ).status,
      400
    )

    // Tag and Task list pages search, filter, and sort before paginating.
    await db.insert(tag).values(
      Array.from({ length: 30 }, (_, index) => ({
        id: `list-tag-${index}`,
        label: `Label ${String(index).padStart(2, "0")}`,
        color: index === 7 ? "#ff0000" : "#00ff00",
      }))
    )
    type ListPage = { items: Array<Record<string, unknown>>; total: number }
    async function listPage(path: string) {
      const response = await request(path, admin.cookie)
      assert.equal(response.status, 200, await response.clone().text())
      return (await response.json()) as ListPage
    }
    const searchedTags = await listPage(
      "/api/v1/tags/page?page=1&perPage=5&search=Label%202"
    )
    assert.equal(searchedTags.total, 10)
    assert.equal(searchedTags.items.length, 5)
    const coloredTags = await listPage(
      "/api/v1/tags/page?page=1&perPage=5&filter=color:equals:%23ff0000"
    )
    assert.deepEqual(
      coloredTags.items.map((item) => item.label),
      ["Label 07"]
    )
    assert.equal(coloredTags.total, 1)
    const sortedTags = await listPage(
      "/api/v1/tags/page?page=2&perPage=10&sort=label:asc"
    )
    assert.equal(sortedTags.items[0]?.label, "Label 10")
    assert.equal(
      (
        await request(
          "/api/v1/tags/page?sort=label:asc&filter=label:after:x",
          admin.cookie
        )
      ).status,
      400
    )

    await db.insert(task).values(
      Array.from({ length: 24 }, (_, index) => ({
        id: `list-task-${index}`,
        title: `Task ${String(index).padStart(2, "0")}`,
        status: (["todo", "in_progress", "done"] as const)[index % 3],
        priority: "medium" as const,
        projectId: index < 4 ? "dashboard-project-124" : null,
        assigneeId: index === 5 ? admin.userId : null,
      }))
    )
    const inProgress = await listPage(
      "/api/v1/tasks/page?page=1&perPage=3&filter=status:contains:progress"
    )
    assert.equal(inProgress.total, 8)
    assert.equal(inProgress.items.length, 3)
    const byProject = await listPage(
      "/api/v1/tasks/page?page=1&perPage=2&filter=project:equals:Project%20124"
    )
    assert.equal(byProject.total, 4)
    const withoutProject = await listPage(
      "/api/v1/tasks/page?page=1&perPage=2&filter=project:notContains:124"
    )
    assert.equal(withoutProject.total, 20)
    const byAssignee = await listPage(
      `/api/v1/tasks/page?page=1&perPage=2&filter=assignee:startsWith:admin-security`
    )
    assert.deepEqual(
      byAssignee.items.map((item) => item.title),
      ["Task 05"]
    )
    const sortedTasks = await listPage(
      "/api/v1/tasks/page?page=1&perPage=1&search=Task&sort=title:desc"
    )
    assert.equal(sortedTasks.items[0]?.title, "Task 23")
    assert.equal(sortedTasks.total, 24)
    await db.delete(task).where(like(task.id, "list-task-%"))
    await db.delete(tag).where(like(tag.id, "list-tag-%"))

    const auditResourceId = `security-audit-${crypto.randomUUID()}`
    await new AuditService().record({
      actorId: admin.userId,
      actorType: "USER",
      action: "SECURITY_TEST_EVENT",
      resourceType: "security-test",
      resourceId: auditResourceId,
    })
    const auditResponse = await request(
      `/api/v1/audit-logs?resourceType=security-test&perPage=1`,
      admin.cookie
    )
    assert.equal(auditResponse.status, 200, await auditResponse.clone().text())
    const auditHistory = (await auditResponse.json()) as {
      items: Array<{ resourceId: string; action: string }>
      total: number
    }
    assert.equal(auditHistory.total, 1)
    assert.equal(auditHistory.items[0]?.resourceId, auditResourceId)
    assert.equal(auditHistory.items[0]?.action, "SECURITY_TEST_EVENT")
    const filteredAudit = await request(
      `/api/v1/audit-logs?q=SECURITY_TEST_EVENT&status=success&sort=oldest`,
      admin.cookie
    )
    assert.equal(filteredAudit.status, 200)
    assert.equal(((await filteredAudit.json()) as { total: number }).total, 1)
    assert.equal(
      (await request("/api/v1/audit-logs?perPage=101", admin.cookie)).status,
      400
    )

    const member = await signUp("task-security@example.invalid")
    assert.equal(
      (await request("/api/v1/audit-logs", member.cookie)).status,
      403
    )
    await db
      .insert(role)
      .values({ id: "test-task-role", key: "test-task", name: "Test task" })
    await db.insert(permission).values([
      { id: "test-create-task", action: "create", subject: "Task" },
      { id: "test-read-task", action: "read", subject: "Task" },
    ])
    await db.insert(rolePermission).values([
      { roleId: "test-task-role", permissionId: "test-create-task" },
      { roleId: "test-task-role", permissionId: "test-read-task" },
    ])
    await db
      .insert(userRole)
      .values({ userId: member.userId, roleId: "test-task-role" })

    const taskInput = {
      title: "Task",
      description: null,
      status: "todo",
      priority: "medium",
      projectId: projects[0]!.id,
      assigneeId: null,
      dueDate: null,
    }
    const forbiddenLink = await request(
      "/api/v1/tasks",
      member.cookie,
      jsonPost(taskInput)
    )
    assert.equal(forbiddenLink.status, 400, await forbiddenLink.text())
    const forbiddenAssignee = await request(
      "/api/v1/tasks",
      member.cookie,
      jsonPost({ ...taskInput, projectId: null, assigneeId: admin.userId })
    )
    assert.equal(forbiddenAssignee.status, 400, await forbiddenAssignee.text())
    const unlinked = await request(
      "/api/v1/tasks",
      member.cookie,
      jsonPost({ ...taskInput, projectId: null })
    )
    assert.equal(unlinked.status, 201, await unlinked.text())
    const linked = await request(
      "/api/v1/tasks",
      admin.cookie,
      jsonPost({ ...taskInput, assigneeId: admin.userId })
    )
    assert.equal(linked.status, 201, await linked.text())
    const visible = await request("/api/v1/tasks", member.cookie)
    assert.equal(visible.status, 200)
    assert.equal(((await visible.json()) as unknown[]).length, 1)
    const taskPage = await request(
      "/api/v1/tasks/page?page=1&perPage=1",
      admin.cookie
    )
    assert.equal(taskPage.status, 200)
    const pagedTasks = (await taskPage.json()) as {
      items: Array<{ id: string }>
      total: number
    }
    assert.equal(pagedTasks.items.length, 1)
    assert.equal(pagedTasks.total, 2)
    const secondTaskPage = await request(
      "/api/v1/tasks/page?page=2&perPage=1",
      admin.cookie
    )
    assert.equal(secondTaskPage.status, 200)
    const secondTask = (await secondTaskPage.json()) as {
      items: Array<{ id: string }>
      total: number
    }
    assert.equal(secondTask.items.length, 1)
    assert.equal(secondTask.total, 2)
    assert.notEqual(secondTask.items[0]?.id, pagedTasks.items[0]?.id)
    const memberTaskPage = await request(
      "/api/v1/tasks/page?page=1&perPage=1",
      member.cookie
    )
    assert.equal(memberTaskPage.status, 200)
    assert.equal(((await memberTaskPage.json()) as { total: number }).total, 1)
    assert.equal(
      (await request("/api/v1/tasks/page?perPage=101", admin.cookie)).status,
      400
    )
    assert.equal(
      (await request("/api/v1/tags/page", member.cookie)).status,
      403
    )
    const createdTag = await request(
      "/api/v1/tags",
      admin.cookie,
      jsonPost({ label: "Security test tag", color: "#123456" })
    )
    assert.equal(createdTag.status, 201, await createdTag.clone().text())
    const tagRow = (await createdTag.json()) as { id: string }
    await db
      .insert(projectTag)
      .values({ projectId: projects[0]!.id, tagId: tagRow.id })
    const taggedProjects = await request(
      "/api/v1/projects?filter=tags:equals:Security%20test%20tag&perPage=1",
      admin.cookie
    )
    assert.equal(
      taggedProjects.status,
      200,
      await taggedProjects.clone().text()
    )
    assert.equal(((await taggedProjects.json()) as { total: number }).total, 1)
    const tagPage = await request(
      "/api/v1/tags/page?page=2&perPage=1",
      admin.cookie
    )
    assert.equal(tagPage.status, 200)
    const pagedTags = (await tagPage.json()) as {
      items: unknown[]
      total: number
    }
    assert.equal(pagedTags.items.length, 0)
    assert.equal(pagedTags.total, 1)
    assert.equal(
      (await request("/api/v1/tags/page?page=0", admin.cookie)).status,
      400
    )
    const memberDashboard = await request("/api/v1/dashboard", member.cookie)
    assert.equal(memberDashboard.status, 200)
    const memberSummary = (await memberDashboard.json()) as {
      stats: { projectCount: number; taskCount: number }
    }
    assert.equal(memberSummary.stats.projectCount, 0)
    assert.equal(memberSummary.stats.taskCount, 1)
  } finally {
    await app.close()
  }
})
