import assert from "node:assert/strict"
import { test } from "node:test"
import { subject } from "@casl/ability"
import { AuthzService } from "@et/authz"
import {
  auditLog,
  closeDb,
  db,
  permission,
  role,
  rolePermission,
  task,
  user,
  userRole,
} from "@et/db"
import { HttpException } from "@nestjs/common"
import { eq, inArray, sql } from "drizzle-orm"
import { AuditService } from "../src/audit/audit.service.js"
import {
  abilityForUser,
  assignRoleByKey,
  loadRulesForUser,
  ROLE_ADMIN,
  seedRolesAndPermissions,
} from "../src/authz/permissions.js"
import { PermissionsService } from "../src/permissions/permissions.service.js"
import { RolesService } from "../src/roles/roles.service.js"

const apiMessage = (pattern: RegExp) => (error: unknown) =>
  error instanceof HttpException &&
  pattern.test(JSON.stringify(error.getResponse()))

// Opt in against a migrated development database. Only this test's fixtures are removed.
test("shared permission CRUD, role assignment and authorization", {
  skip: process.env.PERMISSION_INTEGRATION_TEST !== "1",
}, async () => {
  await seedRolesAndPermissions()
  await db.insert(user).values({
    id: "test-admin",
    name: "Test admin",
    email: "test-admin@example.invalid",
  })
  await assignRoleByKey("test-admin", ROLE_ADMIN)
  const authz = new AuthzService({
    subjects: { Permission: permission, Role: role, Task: task },
    loadRules: (id) =>
      id === "test-admin" ? [{ action: "manage", subject: "all" }] : [],
  })
  const permissions = new PermissionsService(authz, new AuditService())
  const roles = new RolesService(authz, new AuditService())
  const userId = crypto.randomUUID()
  const createdRoleIds: string[] = []
  let permissionId: string | undefined
  try {
    await assert.rejects(
      permissions.create("denied", {
        subject: "Task",
        action: "approve",
        conditions: null,
      }),
      /permission/
    )
    const created = await permissions.create("test-admin", {
      subject: "Task",
      action: "approve",
      conditions: {
        assigneeId: "${user.id}",
        status: { $in: ["todo", "done"] },
      },
    })
    assert.ok(created)
    permissionId = created.id
    await assert.rejects(
      permissions.create("test-admin", {
        subject: "Task",
        action: "approve",
        conditions: {
          assigneeId: "${user.id}",
          status: { $in: ["todo", "done"] },
        },
      }),
      apiMessage(/already exists/)
    )
    const other = await permissions.create("test-admin", {
      subject: "Task",
      action: "revoke",
      conditions: null,
    })
    await assert.rejects(
      permissions.update(
        "test-admin",
        other.id,
        {
          subject: "Task",
          action: "approve",
          conditions: {
            assigneeId: "${user.id}",
            status: { $in: ["todo", "done"] },
          },
        },
        sql`true`
      ),
      apiMessage(/already exists/)
    )
    await permissions.remove("test-admin", other.id, sql`true`)
    const input = {
      name: "Permission integration test",
      description: null,
      permissionIds: [created.id],
    }
    const first = await roles.create("test-admin", {
      ...input,
      key: `test-${crypto.randomUUID().slice(0, 8)}`,
    })
    createdRoleIds.push(first.id)
    const second = await roles.create("test-admin", {
      ...input,
      key: `test-${crypto.randomUUID().slice(0, 8)}`,
    })
    createdRoleIds.push(second.id)
    assert.equal(
      (await permissions.list(eq(permission.id, created.id)))[0]?.roleCount,
      2
    )
    await assert.rejects(
      permissions.remove("test-admin", created.id, sql`true`),
      apiMessage(/Remove this permission/)
    )
    await assert.rejects(
      permissions.update(
        "test-admin",
        created.id,
        { subject: "Task", action: "revoke", conditions: null },
        sql`false`
      ),
      apiMessage(/not found/)
    )
    await assert.rejects(
      permissions.update(
        "denied",
        created.id,
        { subject: "Task", action: "revoke", conditions: null },
        sql`true`
      ),
      /permission/
    )
    await assert.rejects(
      roles.create("test-admin", {
        ...input,
        key: `test-${crypto.randomUUID().slice(0, 8)}`,
        permissionIds: ["nonexistent"],
      }),
      apiMessage(/no longer exist/)
    )
    await db.insert(user).values({
      id: userId,
      name: "Permission test",
      email: `${userId}@example.invalid`,
    })
    await db
      .insert(userRole)
      .values(createdRoleIds.map((roleId) => ({ userId, roleId })))
    const ability = await abilityForUser(userId)
    assert.equal(
      ability.can(
        "approve",
        subject("Task", { assigneeId: userId, status: "todo" })
      ),
      true
    )
    assert.equal(
      ability.can(
        "approve",
        subject("Task", { assigneeId: "someone-else", status: "todo" })
      ),
      false
    )
    await permissions.update(
      "test-admin",
      created.id,
      { subject: "Task", action: "grant", conditions: { status: "done" } },
      sql`true`
    )
    const shared = await roles.list(inArray(role.id, createdRoleIds))
    assert.equal(shared.length, 2)
    for (const item of shared)
      assert.deepEqual(
        item.permissions.map((p) => [p.id, p.action, p.conditions]),
        [[created.id, "grant", { status: "done" }]]
      )
    assert.equal(
      (await loadRulesForUser(userId)).every((rule) => rule.action === "grant"),
      true
    )
    await roles.update(
      "test-admin",
      first.id,
      { ...input, key: first.key, permissionIds: [] },
      sql`true`
    )
    assert.equal(
      (await permissions.list(eq(permission.id, created.id)))[0]?.roleCount,
      1
    )
    await db.delete(userRole).where(eq(userRole.userId, userId))
    await roles.remove("test-admin", second.id, sql`true`)
    assert.equal(
      (await permissions.list(eq(permission.id, created.id)))[0]?.roleCount,
      0
    )
    await permissions.remove("test-admin", created.id, sql`true`)
    assert.equal(
      (await permissions.list(eq(permission.id, created.id))).length,
      0
    )
    const recorded = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.actorId, "test-admin"))
    for (const action of [
      "PERMISSION_CREATED",
      "PERMISSION_DELETED",
      "ROLE_CREATED",
      "ROLE_UPDATED",
      "ROLE_DELETED",
    ])
      assert.ok(
        recorded.some((row) => row.action === action),
        action
      )
  } finally {
    await db.delete(auditLog).where(eq(auditLog.actorId, "test-admin"))
    await db.delete(user).where(eq(user.id, userId))
    await db.delete(user).where(eq(user.id, "test-admin"))
    if (createdRoleIds.length) {
      await db
        .delete(rolePermission)
        .where(inArray(rolePermission.roleId, createdRoleIds))
      await db.delete(role).where(inArray(role.id, createdRoleIds))
    }
    if (permissionId)
      await db.delete(permission).where(eq(permission.id, permissionId))
    await closeDb()
  }
})
