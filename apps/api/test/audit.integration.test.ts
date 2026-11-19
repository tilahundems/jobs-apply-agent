import assert from "node:assert/strict"
import { test } from "node:test"
import { auditLog, closeDb, db } from "@et/db"
import { eq, inArray, sql } from "drizzle-orm"
import { AuditService } from "../src/audit/audit.service.js"

test("audit records persist safely, query with pagination, and share transactions", {
  skip: process.env.AUDIT_INTEGRATION_TEST !== "1",
}, async () => {
  const audit = new AuditService()
  const ids: string[] = []
  const actorId = `audit-test-${crypto.randomUUID()}`
  const resourceId = `project-${crypto.randomUUID()}`

  try {
    const saved = await audit.record({
      actorId,
      actorType: "USER",
      action: "PROJECT_UPDATED",
      resourceType: "project",
      resourceId,
      oldValues: { status: "PENDING", passwordHash: "old-secret" },
      newValues: { status: "APPROVED", access_token: "new-secret" },
      metadata: { source: "settings", nested: { cookie: "session-secret" } },
      requestId: "request-audit-test",
    })
    assert.ok(saved)
    ids.push(saved.id)
    assert.equal(saved.actorId, actorId)
    assert.equal(saved.actorType, "USER")
    assert.equal(saved.action, "PROJECT_UPDATED")
    assert.equal(saved.resourceType, "project")
    assert.equal(saved.resourceId, resourceId)
    assert.deepEqual(saved.oldValues, {
      status: "PENDING",
      passwordHash: "[REDACTED]",
    })
    assert.deepEqual(saved.newValues, {
      status: "APPROVED",
      access_token: "[REDACTED]",
    })
    assert.deepEqual(saved.metadata, {
      source: "settings",
      nested: { cookie: "[REDACTED]" },
    })

    const second = await audit.record({
      actorId,
      actorType: "USER",
      action: "PROJECT_CREATED",
      resourceType: "project",
      resourceId: `${resourceId}-second`,
    })
    assert.ok(second)
    ids.push(second.id)

    const page = await audit.list(
      { page: 1, perPage: 1, actorId, action: "PROJECT_UPDATED" },
      sql`true`
    )
    assert.equal(page.total, 1)
    assert.equal(page.items[0]?.id, saved.id)
    const firstPage = await audit.list(
      { page: 1, perPage: 1, actorId },
      sql`true`
    )
    const secondPage = await audit.list(
      { page: 2, perPage: 1, actorId },
      sql`true`
    )
    assert.equal(firstPage.total, 2)
    assert.equal(secondPage.total, 2)
    assert.equal(firstPage.items.length, 1)
    assert.equal(secondPage.items.length, 1)
    assert.notEqual(firstPage.items[0]?.id, secondPage.items[0]?.id)

    const failed = await audit.record({
      actorType: "SYSTEM",
      action: "LOGIN_FAILED",
      resourceType: "session",
      resourceId: `${resourceId}-failed`,
      metadata: { status: "failed", httpStatusCode: 401 },
    })
    assert.ok(failed)
    ids.push(failed.id)
    const filtered = await audit.list(
      { page: 1, perPage: 10, q: "LOGIN", status: "failed", sort: "newest" },
      sql`true`
    )
    assert.equal(filtered.total, 1)
    assert.equal(filtered.items[0]?.id, failed.id)
    assert.equal(filtered.items[0]?.status, "failed")
    const ascending = await audit.list(
      { page: 1, perPage: 10, actor: actorId, sort: "oldest" },
      sql`true`
    )
    assert.equal(ascending.total, 2)
    assert.equal(ascending.items[0]?.id, secondPage.items[0]?.id)

    const transactionId = `project-${crypto.randomUUID()}`
    await db.transaction(async (tx) => {
      const inTransaction = await audit.record(
        {
          actorType: "SYSTEM",
          action: "PROJECT_CREATED",
          resourceType: "project",
          resourceId: transactionId,
        },
        tx
      )
      assert.ok(inTransaction)
      ids.push(inTransaction.id)
    })
    assert.equal(
      (
        await db
          .select()
          .from(auditLog)
          .where(eq(auditLog.resourceId, transactionId))
      ).length,
      1
    )

    const rollbackResourceId = `project-${crypto.randomUUID()}`
    await assert.rejects(
      db.transaction(async (tx) => {
        const rolledBack = await audit.record(
          {
            actorType: "SERVICE",
            action: "PROJECT_CREATED",
            resourceType: "project",
            resourceId: rollbackResourceId,
          },
          tx
        )
        assert.ok(rolledBack)
        throw new Error("rollback")
      }),
      /rollback/
    )
    assert.equal(
      (
        await db
          .select()
          .from(auditLog)
          .where(eq(auditLog.resourceId, rollbackResourceId))
      ).length,
      0
    )

    assert.deepEqual(Object.getOwnPropertyNames(AuditService.prototype), [
      "constructor",
      "record",
      "list",
    ])
  } finally {
    if (ids.length) await db.delete(auditLog).where(inArray(auditLog.id, ids))
    await closeDb()
  }
})
