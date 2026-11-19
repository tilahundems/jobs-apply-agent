import { describe, expect, it } from "vitest"

import { createAppAbility, subject } from "./ability"
import {
  canAccessPage,
  canReadSubject,
  requirePageAbility,
} from "./page-ability"

describe("app ability", () => {
  it("lets admins manage every subject", () => {
    const ability = createAppAbility([{ action: "manage", subject: "all" }])

    expect(ability.can("create", "Task")).toBe(true)
    expect(ability.can("delete", "Project")).toBe(true)
    expect(
      ability.can("create", subject("Task", { assigneeId: "someone-else" }))
    ).toBe(true)
  })

  it("lets users create only tasks assigned to them", () => {
    const userId = "user-1"
    const ability = createAppAbility([
      {
        action: "create",
        subject: "Task",
        conditions: { assigneeId: userId },
      },
      { action: "read", subject: "Project" },
      { action: "read", subject: "Task" },
    ])

    expect(ability.can("create", "Task")).toBe(true)
    expect(ability.can("create", subject("Task", { assigneeId: userId }))).toBe(
      true
    )
    expect(
      ability.can("create", subject("Task", { assigneeId: "someone-else" }))
    ).toBe(false)
    expect(ability.can("read", "Project")).toBe(true)
    expect(ability.can("read", "Task")).toBe(true)
    expect(ability.can("read", "Tag")).toBe(false)
    expect(ability.can("read", "User")).toBe(false)
    expect(ability.can("read", "Role")).toBe(false)
    expect(ability.can("create", "Project")).toBe(false)
    expect(ability.can("update", "Task")).toBe(false)
  })
})

describe("page ability", () => {
  it("always allows pages without a subject", () => {
    const ability = createAppAbility([])

    expect(canAccessPage(ability)).toBe(true)
    expect(canAccessPage(ability, null)).toBe(true)
  })

  it("gates sidebar pages on read access", () => {
    const ability = createAppAbility([
      { action: "read", subject: "Task" },
      { action: "create", subject: "Task" },
    ])

    expect(canAccessPage(ability, { action: "read", subject: "Task" })).toBe(
      true
    )
    expect(canAccessPage(ability, { action: "read", subject: "Project" })).toBe(
      false
    )
    expect(canAccessPage(ability, { action: "read", subject: "User" })).toBe(
      false
    )
    expect(
      canReadSubject([{ action: "read", subject: "Project" }], "Project")
    ).toBe(true)
    expect(
      canReadSubject([{ action: "read", subject: "Project" }], "Tag")
    ).toBe(false)
  })

  it("lets manage-all rules open every sidebar page", () => {
    const ability = createAppAbility([{ action: "manage", subject: "all" }])

    expect(canAccessPage(ability, { action: "read", subject: "Project" })).toBe(
      true
    )
    expect(canAccessPage(ability, { action: "read", subject: "User" })).toBe(
      true
    )
    expect(canAccessPage(ability, { action: "read", subject: "Role" })).toBe(
      true
    )
  })

  it("redirects away from pages the user cannot read", () => {
    expect(() => requirePageAbility([], "read", "Project")).toThrow()
    expect(() =>
      requirePageAbility(
        [{ action: "read", subject: "Project" }],
        "read",
        "Project"
      )
    ).not.toThrow()
  })

  it("gates audit logs independently of other settings permissions", () => {
    const rules = [{ action: "read" as const, subject: "Role" as const }]
    expect(canReadSubject(rules, "AuditLog")).toBe(false)
    expect(() => requirePageAbility(rules, "read", "AuditLog")).toThrow()
    expect(() =>
      requirePageAbility(
        [{ action: "read", subject: "AuditLog" }],
        "read",
        "AuditLog"
      )
    ).not.toThrow()
  })
})
