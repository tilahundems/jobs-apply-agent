import { describe, expect, it } from "vitest"
import { createAppAbility, subject } from "@/features/authz/ability"
import {
  conditionsFromRows,
  describeConditions,
  newCondition,
  parseConditionsJson,
  rowsFromConditions,
  USER_ID,
} from "./conditions"
import type { ConditionField } from "./permissions-api"

const fields: ConditionField[] = [
  { name: "assigneeId", type: "string", values: [] },
  { name: "status", type: "string", values: ["todo", "done"] },
  { name: "enabled", type: "boolean", values: [] },
  { name: "amount", type: "number", values: [] },
]

describe("permission condition builder", () => {
  it("creates conditions enforceable by CASL for a custom action", () => {
    const conditions = conditionsFromRows(
      [
        { ...newCondition(), field: "assigneeId", source: "user" },
        {
          ...newCondition(),
          field: "status",
          operator: "$in",
          value: "todo\ndone",
        },
      ],
      fields
    )!
    expect(conditions).toEqual({
      assigneeId: { $eq: USER_ID },
      status: { $in: ["todo", "done"] },
    })
    const ability = createAppAbility([
      { action: "approve", subject: "Task", conditions },
    ])
    expect(
      ability.can(
        "approve",
        subject("Task", { assigneeId: USER_ID, status: "todo" })
      )
    ).toBe(true)
    expect(
      ability.can(
        "approve",
        subject("Task", { assigneeId: "other", status: "todo" })
      )
    ).toBe(false)
    expect(
      ability.can(
        "approve",
        subject("Task", { assigneeId: USER_ID, status: "in_progress" })
      )
    ).toBe(false)
  })
  it("preserves numeric, boolean, null and text values during a round trip", () => {
    const input = {
      amount: { $gte: 5, $lt: 10 },
      enabled: { $eq: false },
      assigneeId: { $ne: null },
      status: { $eq: "123" },
    }
    expect(conditionsFromRows(rowsFromConditions(input)!, fields)).toEqual(
      input
    )
  })
  it("keeps unsupported or lossy conditions in JSON mode", () => {
    expect(rowsFromConditions({ status: { $not: { $eq: "done" } } })).toBeNull()
    expect(rowsFromConditions({ status: { $in: [null, "todo"] } })).toBeNull()
    expect(rowsFromConditions({ status: " padded " })).toBeNull()
    expect(rowsFromConditions({ status: { $in: [] } })).toBeNull()
  })
  it("does not silently drop incomplete or duplicate conditions", () => {
    expect(() => conditionsFromRows([newCondition()], fields)).toThrow(
      "Choose a field"
    )
    const row = { ...newCondition(), field: "status", value: "todo" }
    expect(() =>
      conditionsFromRows([row, { ...row, id: "other" }], fields)
    ).toThrow("only once")
    expect(() =>
      conditionsFromRows(
        [{ ...newCondition(), field: "amount", value: "NaN" }],
        fields
      )
    ).toThrow("Enter a number")
    expect(() =>
      conditionsFromRows(
        [{ ...newCondition(), field: "enabled", value: "yes" }],
        fields
      )
    ).toThrow("true or false")
  })
  it("rejects JSON arrays and primitives, and allows removing all conditions", () => {
    expect(() => parseConditionsJson("[]")).toThrow("JSON object")
    expect(() => parseConditionsJson('"text"')).toThrow("JSON object")
    expect(() => parseConditionsJson("{")).toThrow()
    expect(conditionsFromRows([], fields)).toBeNull()
    expect(describeConditions({ assigneeId: USER_ID })).toBe(
      "assigneeId is current user"
    )
  })
})
