import assert from "node:assert/strict"
import { test } from "node:test"
import { roleInputSchema } from "@et/contracts"
import { permissionInputSchema } from "../src/permissions/permission-input.js"

test("accepts custom actions and CASL conditions", () => {
  for (const action of ["approve", "grant", "revoke", "workflow:approve"]) {
    assert.equal(
      permissionInputSchema.safeParse({
        subject: "Task",
        action,
        conditions: {
          assigneeId: "${user.id}",
          status: { $in: ["todo", "done"] },
        },
      }).success,
      true
    )
  }
})
test("rejects unsupported operators, fields, types and wildcard conditions", () => {
  for (const conditions of [
    { unknown: "x" },
    { status: { $regex: ".*" } },
    { status: { $in: "todo" } },
    { status: { $gt: "todo" } },
    { status: 1 },
    { $or: [{ status: "todo" }] },
  ]) {
    assert.equal(
      permissionInputSchema.safeParse({
        subject: "Task",
        action: "read",
        conditions,
      }).success,
      false,
      JSON.stringify(conditions)
    )
  }
  assert.equal(
    permissionInputSchema.safeParse({
      subject: "all",
      action: "read",
      conditions: { id: "1" },
    }).success,
    false
  )
})
test("roles reference catalog IDs instead of defining permissions inline", () => {
  const role = {
    name: "Reviewer",
    key: "reviewer",
    permissionIds: ["permission-1"],
  }
  assert.equal(roleInputSchema.safeParse(role).success, true)
  assert.equal(
    roleInputSchema.safeParse({ ...role, permissionIds: ["same", "same"] })
      .success,
    false
  )
  assert.equal(
    roleInputSchema.safeParse({
      name: "Old",
      key: "old",
      permissions: [{ action: "read", subject: "Task" }],
    }).success,
    false
  )
})
