import assert from "node:assert/strict"
import { test } from "node:test"
import {
  auditLog,
  db,
  member,
  notification,
  permission,
  project,
  projectTag,
  role,
  rolePermission,
  rootDb,
  tag,
  task,
  withTenantTransaction,
} from "@et/db"
import { and, eq, sql } from "drizzle-orm"
import { AppModule } from "../src/app.module.js"
import { seedRolesAndPermissions } from "../src/authz/permissions.js"
import { startApp } from "./start-app.js"

test("organizations isolate reads and all writes, even without an application predicate", {
  skip:
    process.env.TENANT_INTEGRATION_TEST !== "1" ||
    process.env.MULTI_TENANCY !== "true",
}, async () => {
  await seedRolesAndPermissions()
  const { app, base } = await startApp(AppModule)

  function request(
    path: string,
    cookie: string,
    body?: unknown,
    method = "GET"
  ) {
    return fetch(`${base}${path}`, {
      method,
      headers: {
        Cookie: cookie,
        Origin: "http://localhost:3000",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  }

  async function createOrg(cookie: string, name: string) {
    const response = await request(
      "/api/v1/auth/organization/create",
      cookie,
      {
        name,
        slug: `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`,
      },
      "POST"
    )
    assert.equal(response.status, 200, await response.clone().text())
    return ((await response.json()) as { id: string }).id
  }

  async function activate(cookie: string, organizationId: string) {
    const response = await request(
      "/api/v1/auth/organization/set-active",
      cookie,
      { organizationId },
      "POST"
    )
    assert.equal(response.status, 200, await response.clone().text())
  }

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
    const cookie = response.headers
      .getSetCookie()
      .map((header) => header.split(";")[0])
      .join("; ")
    assert.ok(cookie)
    return {
      cookie,
      userId: ((await response.json()) as { user: { id: string } }).user.id,
    }
  }

  try {
    const owner = await signUp(`tenant-${crypto.randomUUID()}@example.invalid`)
    const cookie = owner.cookie
    const orgA = await createOrg(cookie, "Organization A")
    const orgB = await createOrg(cookie, "Organization B")

    const inviteeEmail = `member-${crypto.randomUUID()}@example.invalid`
    const invitee = await signUp(inviteeEmail)
    const inviteeCookie = invitee.cookie
    const invitation = await request(
      "/api/v1/auth/organization/invite-member",
      cookie,
      { organizationId: orgA, email: inviteeEmail, role: "member" },
      "POST"
    )
    assert.equal(invitation.status, 200, await invitation.clone().text())
    const invitationId = ((await invitation.json()) as { id: string }).id
    const accepted = await request(
      "/api/v1/auth/organization/accept-invitation",
      inviteeCookie,
      { invitationId },
      "POST"
    )
    assert.equal(accepted.status, 200, await accepted.clone().text())
    await activate(inviteeCookie, orgA)
    const memberId = await withTenantTransaction(rootDb, orgA, async () => {
      const [row] = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, orgA),
            eq(member.userId, invitee.userId)
          )
        )
      assert.ok(row)
      return row.id
    })
    const directRoleChange = await request(
      "/api/v1/auth/organization/update-member-role",
      cookie,
      { memberId, role: "admin" },
      "POST"
    )
    assert.equal(directRoleChange.status, 403)

    const memberUpdate = await request(
      "/api/v1/auth/organization/update",
      inviteeCookie,
      { organizationId: orgA, data: { name: "Not allowed" } },
      "POST"
    )
    assert.equal(memberUpdate.status, 403)
    const ownerUpdate = await request(
      "/api/v1/auth/organization/update",
      cookie,
      { organizationId: orgA, data: { name: "Organization A updated" } },
      "POST"
    )
    assert.equal(ownerUpdate.status, 200, await ownerUpdate.clone().text())
    const deleteBlocked = await request(
      "/api/v1/auth/organization/delete",
      cookie,
      { organizationId: orgA },
      "POST"
    )
    assert.equal(deleteBlocked.status, 404)

    await activate(cookie, orgA)
    const createdPermission = await request(
      "/api/v1/permissions",
      cookie,
      { action: "approve", subject: "Task", conditions: null },
      "POST"
    )
    assert.equal(
      createdPermission.status,
      201,
      await createdPermission.clone().text()
    )
    const permissionId = ((await createdPermission.json()) as { id: string }).id
    const createdRole = await request(
      "/api/v1/roles",
      cookie,
      {
        key: `reviewer-${crypto.randomUUID().slice(0, 8)}`,
        name: "Reviewer",
        description: null,
        permissionIds: [permissionId],
      },
      "POST"
    )
    assert.equal(createdRole.status, 201, await createdRole.clone().text())
    const roleId = ((await createdRole.json()) as { id: string }).id

    await activate(cookie, orgB)
    const otherRoles = (await (
      await request("/api/v1/roles", cookie)
    ).json()) as Array<{ id: string }>
    const otherPermissions = (await (
      await request("/api/v1/permissions", cookie)
    ).json()) as Array<{ id: string }>
    assert.equal(
      otherRoles.some((item) => item.id === roleId),
      false
    )
    assert.equal(
      otherPermissions.some((item) => item.id === permissionId),
      false
    )
    const crossTenantRole = await request(
      `/api/v1/roles/${roleId}`,
      cookie,
      {
        key: "reviewer",
        name: "Changed",
        description: null,
        permissionIds: [],
      },
      "PATCH"
    )
    assert.equal(crossTenantRole.status, 404)
    const crossTenantPermission = await request(
      `/api/v1/permissions/${permissionId}`,
      cookie,
      { action: "approve", subject: "Task", conditions: null },
      "PATCH"
    )
    assert.equal(crossTenantPermission.status, 404)
    const crossTenantGrant = await request(
      "/api/v1/roles",
      cookie,
      {
        key: `foreign-${crypto.randomUUID().slice(0, 8)}`,
        name: "Foreign",
        description: null,
        permissionIds: [permissionId],
      },
      "POST"
    )
    assert.equal(crossTenantGrant.status, 400)
    await withTenantTransaction(rootDb, orgB, async () => {
      assert.equal(
        (await db.select().from(role).where(eq(role.id, roleId))).length,
        0
      )
      assert.equal(
        (
          await db
            .select()
            .from(permission)
            .where(eq(permission.id, permissionId))
        ).length,
        0
      )
      assert.equal(
        (
          await db
            .select()
            .from(rolePermission)
            .where(eq(rolePermission.roleId, roleId))
        ).length,
        0
      )
    })
    const created = await request(
      "/api/v1/projects",
      cookie,
      { name: "B project", description: "Owned by B", tagIds: [] },
      "POST"
    )
    assert.equal(created.status, 201, await created.clone().text())
    const row = (await created.json()) as { id: string; organizationId: string }
    assert.equal(row.organizationId, orgB)

    const tagId = crypto.randomUUID()
    const otherTagId = crypto.randomUUID()
    const taskId = crypto.randomUUID()
    const notificationId = crypto.randomUUID()
    const auditId = crypto.randomUUID()
    await withTenantTransaction(rootDb, orgB, async () => {
      await db.insert(tag).values([
        { id: tagId, organizationId: orgB, label: "B tag", color: "#123456" },
        {
          id: otherTagId,
          organizationId: orgB,
          label: "B other tag",
          color: "#654321",
        },
      ])
      await db
        .insert(projectTag)
        .values({ projectId: row.id, tagId, organizationId: orgB })
      await db.insert(task).values({
        id: taskId,
        organizationId: orgB,
        title: "B task",
        projectId: row.id,
      })
      await db.insert(notification).values({
        id: notificationId,
        organizationId: orgB,
        userId: owner.userId,
        type: "test",
        title: "B notice",
        message: "Private",
      })
      await db.insert(auditLog).values({
        id: auditId,
        organizationId: orgB,
        actorType: "SYSTEM",
        action: "TENANT_TEST",
        resourceType: "project",
        resourceId: row.id,
      })
    })

    await activate(cookie, orgA)
    assert.equal((await request("/api/v1/projects", inviteeCookie)).status, 200)
    assert.equal((await request("/api/v1/roles", cookie)).status, 200)
    const wrongMembership = await request(
      "/api/v1/auth/organization/set-active",
      inviteeCookie,
      { organizationId: orgB },
      "POST"
    )
    assert.ok(wrongMembership.status >= 400)
    assert.equal(
      (await request(`/api/v1/projects/${row.id}`, cookie)).status,
      404
    )
    assert.equal(
      (
        await request(
          `/api/v1/projects/${row.id}`,
          cookie,
          { name: "Changed", description: "No", tagIds: [] },
          "PATCH"
        )
      ).status,
      404
    )
    assert.equal(
      (await request(`/api/v1/projects/${row.id}`, cookie, undefined, "DELETE"))
        .status,
      404
    )

    const fixtures = [
      { table: "project", key: "id", id: row.id },
      { table: "tag", key: "id", id: tagId },
      { table: "task", key: "id", id: taskId },
      { table: "project_tag", key: "project_id", id: row.id },
      { table: "notification", key: "id", id: notificationId },
      { table: "audit_log", key: "id", id: auditId },
    ] as const
    await withTenantTransaction(rootDb, orgA, async () => {
      for (const fixture of fixtures) {
        const table = sql.identifier(fixture.table)
        const key = sql.identifier(fixture.key)
        // Deliberately omit the application organization predicate.
        const selected = await db.execute(
          sql<{ id: string }>`select ${key} as id from ${table}`
        )
        assert.equal(
          selected.rows.some((item) => item.id === fixture.id),
          false,
          fixture.table
        )
        const updated = await db.execute(
          sql`update ${table} set organization_id = ${orgA} where ${key} = ${fixture.id} returning *`
        )
        assert.equal(updated.rowCount, 0, fixture.table)
        const deleted = await db.execute(
          sql`delete from ${table} where ${key} = ${fixture.id} returning *`
        )
        assert.equal(deleted.rowCount, 0, fixture.table)
      }
    })

    await activate(cookie, orgB)
    const foreignMember = await request(
      `/api/v1/users/${invitee.userId}`,
      cookie,
      { name: inviteeEmail, roleId },
      "PATCH"
    )
    assert.equal(foreignMember.status, 404)
    await activate(cookie, orgA)
    const deniedRoleChange = await request(
      `/api/v1/users/${owner.userId}`,
      inviteeCookie,
      { name: owner.userId, roleId },
      "PATCH"
    )
    assert.equal(deniedRoleChange.status, 403)
    const assignedMember = await request(
      `/api/v1/users/${invitee.userId}`,
      cookie,
      { name: inviteeEmail, roleId },
      "PATCH"
    )
    assert.equal(
      assignedMember.status,
      200,
      await assignedMember.clone().text()
    )
    const scopedUsers = (await (
      await request("/api/v1/users", cookie)
    ).json()) as Array<{
      id: string
      name: string
      roles: Array<{ id: string }>
    }>
    assert.equal(
      scopedUsers.find((item) => item.id === invitee.userId)?.roles[0]?.id,
      roleId
    )
    assert.equal((await request("/api/v1/projects", inviteeCookie)).status, 403)
    const ownerDemotion = await request(
      `/api/v1/users/${owner.userId}`,
      cookie,
      {
        name: scopedUsers.find((item) => item.id === owner.userId)?.name,
        roleId,
      },
      "PATCH"
    )
    assert.equal(ownerDemotion.status, 400)
    const rlsDenied = (error: unknown) => {
      let current = error as { cause?: unknown; code?: string }
      for (let depth = 0; depth < 5; depth++) {
        if (current.code === "42501") return true
        current = current.cause as typeof current
        if (!current) break
      }
      return false
    }
    const crossTenantCreates = [
      async () =>
        db.insert(project).values({
          id: crypto.randomUUID(),
          name: "Forbidden",
          description: "",
          organizationId: orgB,
        }),
      async () =>
        db.insert(tag).values({
          id: crypto.randomUUID(),
          label: "Forbidden",
          color: "#123456",
          organizationId: orgB,
        }),
      async () =>
        db.insert(task).values({
          id: crypto.randomUUID(),
          title: "Forbidden",
          organizationId: orgB,
        }),
      async () =>
        db.insert(projectTag).values({
          projectId: row.id,
          tagId: otherTagId,
          organizationId: orgB,
        }),
      async () =>
        db.insert(notification).values({
          id: crypto.randomUUID(),
          userId: owner.userId,
          type: "test",
          title: "Forbidden",
          message: "",
          organizationId: orgB,
        }),
      async () =>
        db.insert(auditLog).values({
          id: crypto.randomUUID(),
          actorType: "SYSTEM",
          action: "TENANT_TEST",
          resourceType: "project",
          resourceId: row.id,
          organizationId: orgB,
        }),
    ]
    for (const create of crossTenantCreates) {
      await assert.rejects(
        withTenantTransaction(rootDb, orgA, create),
        rlsDenied
      )
    }

    await withTenantTransaction(rootDb, orgB, async () => {
      const [stillThere] = await db
        .select()
        .from(project)
        .where(eq(project.id, row.id))
      assert.equal(stillThere?.name, "B project")
      for (const fixture of fixtures) {
        const stillVisible = await db.execute(
          sql`select 1 from ${sql.identifier(fixture.table)} where ${sql.identifier(fixture.key)} = ${fixture.id}`
        )
        assert.equal(stillVisible.rowCount, 1, fixture.table)
      }
    })
    await activate(cookie, orgA)
    const removed = await request(
      `/api/v1/users/${invitee.userId}/membership`,
      cookie,
      undefined,
      "DELETE"
    )
    assert.equal(removed.status, 200, await removed.clone().text())
    const afterRemoval = (await (
      await request("/api/v1/users", cookie)
    ).json()) as Array<{ id: string }>
    assert.equal(
      afterRemoval.some((item) => item.id === invitee.userId),
      false
    )
    assert.equal((await request("/api/v1/projects", inviteeCookie)).status, 403)
  } finally {
    await app.close()
  }
})
