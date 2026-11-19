import { describe, expect, it } from "vitest"
import {
  filterPermissionsBySearch,
  groupPermissionsBySubject,
  groupPermissionsForPicker,
  hasManageAll,
  slugifyRoleKey,
  togglePermissionIds,
} from "./roles-permissions"

describe("role permissions", () => {
  it("groups adjacent permissions under one subject", () => {
    expect(
      groupPermissionsBySubject([
        { subject: "Project", id: "1" },
        { subject: "Project", id: "2" },
        { subject: "Task", id: "3" },
      ])
    ).toEqual([
      {
        subject: "Project",
        permissions: [
          { subject: "Project", id: "1" },
          { subject: "Project", id: "2" },
        ],
      },
      { subject: "Task", permissions: [{ subject: "Task", id: "3" }] },
    ])
  })

  it("sorts picker groups by subject and action", () => {
    expect(
      groupPermissionsForPicker([
        { subject: "Task", action: "update", id: "3" },
        { subject: "Project", action: "read", id: "2" },
        { subject: "Project", action: "create", id: "1" },
      ])
    ).toEqual([
      {
        subject: "Project",
        permissions: [
          { subject: "Project", action: "create", id: "1" },
          { subject: "Project", action: "read", id: "2" },
        ],
      },
      {
        subject: "Task",
        permissions: [{ subject: "Task", action: "update", id: "3" }],
      },
    ])
  })

  it("filters permissions by subject, action, deny, or conditions", () => {
    const permissions = [
      {
        id: "1",
        subject: "Project",
        action: "read",
        inverted: false,
        fields: [] as string[],
      },
      {
        id: "2",
        subject: "Task",
        action: "update",
        inverted: true,
        fields: ["title"],
        conditions: { ownerId: "user-1" },
      },
    ]

    expect(filterPermissionsBySearch(permissions, "project")).toEqual([
      permissions[0],
    ])
    expect(filterPermissionsBySearch(permissions, "deny")).toEqual([
      permissions[1],
    ])
    expect(filterPermissionsBySearch(permissions, "title")).toEqual([
      permissions[1],
    ])
  })

  it("adds or removes permission ids without duplicates", () => {
    expect(togglePermissionIds(["a"], ["b", "a"], true)).toEqual(["a", "b"])
    expect(togglePermissionIds(["a", "b", "c"], ["b", "c"], false)).toEqual([
      "a",
    ])
  })

  it("generates readable stable keys", () => {
    expect(slugifyRoleKey(" Project Manager ")).toBe("project-manager")
    expect(slugifyRoleKey("A".repeat(60))).toHaveLength(40)
  })
  it("only labels unconditional, unrestricted grants as full access", () => {
    const permission = {
      id: "permission-1",
      action: "manage",
      subject: "all" as const,
    }
    expect(hasManageAll([permission])).toBe(true)
    expect(hasManageAll([{ ...permission, inverted: true }])).toBe(false)
    expect(hasManageAll([{ ...permission, conditions: { id: "one" } }])).toBe(
      false
    )
    expect(hasManageAll([{ ...permission, fields: ["title"] }])).toBe(false)
    expect(hasManageAll([{ ...permission, action: "approve" }])).toBe(false)
  })
})
