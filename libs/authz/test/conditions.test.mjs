import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createMongoAbility } from "@casl/ability"
import { sql } from "drizzle-orm"
import { integer, PgDialect, pgTable, text } from "drizzle-orm/pg-core"

import {
  conditionsFor,
  conditionToSql,
  UnsupportedPermissionError,
} from "../dist/index.js"

const task = pgTable("task", {
  id: text("id").primaryKey(),
  assigneeId: text("assignee_id"),
  priority: integer("priority"),
})

const dialect = new PgDialect()

function render(expression) {
  const query = dialect.sqlToQuery(sql`select ${expression}`)
  assert.equal(typeof query.sql, "string")
  assert.ok(query.sql.length > 0)
  assert.ok(Array.isArray(query.params))
  return query
}

function ability(rules) {
  return createMongoAbility(rules)
}

describe("conditionsFor", () => {
  it("produces SQL true for unrestricted access", () => {
    const query = render(
      conditionsFor(
        ability([{ action: "read", subject: "Task" }]),
        "read",
        "Task",
        task
      )
    )

    assert.equal(query.sql, "select true")
    assert.deepEqual(query.params, [])
  })

  it("produces SQL true for manage all", () => {
    const query = render(
      conditionsFor(
        ability([{ action: "manage", subject: "all" }]),
        "read",
        "Task",
        task
      )
    )

    assert.equal(query.sql, "select true")
  })

  it("produces SQL false when there is no access", () => {
    const query = render(conditionsFor(ability([]), "read", "Task", task))

    assert.equal(query.sql, "select false")
    assert.deepEqual(query.params, [])
  })

  it("never returns undefined", () => {
    assert.notEqual(
      conditionsFor(ability([]), "delete", "Task", task),
      undefined
    )
    assert.notEqual(
      conditionsFor(
        ability([{ action: "read", subject: "Task" }]),
        "read",
        "Task",
        task
      ),
      undefined
    )
  })

  it("keeps CASL last-rule-wins precedence for overlapping grant and deny", () => {
    const grantedThenDenied = render(
      conditionsFor(
        ability([
          { action: "read", subject: "Task" },
          {
            inverted: true,
            action: "read",
            subject: "Task",
            conditions: { assigneeId: "user-1" },
          },
        ]),
        "read",
        "Task",
        task
      )
    )

    assert.match(grantedThenDenied.sql, /case/i)
    assert.match(grantedThenDenied.sql, /when/i)
    assert.deepEqual(grantedThenDenied.params, ["user-1"])
    assert.ok(
      grantedThenDenied.sql.indexOf("false") <
        grantedThenDenied.sql.lastIndexOf("true"),
      "higher-priority deny must be evaluated before the unrestricted grant"
    )

    const deniedThenGranted = render(
      conditionsFor(
        ability([
          {
            inverted: true,
            action: "read",
            subject: "Task",
            conditions: { assigneeId: "user-1" },
          },
          { action: "read", subject: "Task" },
        ]),
        "read",
        "Task",
        task
      )
    )

    assert.equal(deniedThenGranted.sql, "select true")
  })

  it("rejects field-scoped rules at row-only endpoints", () => {
    assert.throws(
      () =>
        conditionsFor(
          ability([{ action: "update", subject: "Task", fields: ["title"] }]),
          "update",
          "Task",
          task
        ),
      UnsupportedPermissionError
    )
  })

  it("translates a conditional grant into a parameterized predicate", () => {
    const query = render(
      conditionsFor(
        ability([
          {
            action: "update",
            subject: "Task",
            conditions: { assigneeId: "user-1" },
          },
        ]),
        "update",
        "Task",
        task
      )
    )

    assert.match(query.sql, /case/i)
    assert.match(query.sql, /assignee_id/)
    assert.deepEqual(query.params, ["user-1"])
  })
})

describe("conditionToSql", () => {
  it("supports $and / $or groups", () => {
    const query = render(
      conditionToSql(task, {
        $or: [
          { assigneeId: "user-1" },
          { $and: [{ id: "task-1" }, { priority: { $gte: 2 } }] },
        ],
      })
    )

    assert.match(query.sql, /or/i)
    assert.deepEqual(query.params, ["user-1", "task-1", 2])
  })

  it("supports $in, $ne, and $gt", () => {
    const query = render(
      conditionToSql(task, {
        assigneeId: { $in: ["a", "b"] },
        id: { $ne: "hidden" },
        priority: { $gt: 1 },
      })
    )

    assert.match(query.sql, /assignee_id/)
    assert.match(query.sql, /priority/)
    assert.deepEqual(query.params, ["a", "b", "hidden", 1])
  })

  it("fails explicitly for unsupported operators", () => {
    assert.throws(
      () => conditionToSql(task, { assigneeId: { $regex: "adm" } }),
      (error) =>
        error instanceof UnsupportedPermissionError &&
        String(error.message).includes("$regex")
    )
  })

  it("fails explicitly for unknown columns", () => {
    assert.throws(
      () => conditionToSql(task, { secret: "x" }),
      UnsupportedPermissionError
    )
  })
})
