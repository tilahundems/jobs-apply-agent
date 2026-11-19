import { expect, it } from "vitest"
import type { AuditLog } from "./audit-api"
import { actionLabel, changes, eventSummary } from "./audit-display"

const event = {
  id: "one",
  createdAt: "2026-09-25T10:00:00.000Z",
  actorId: "user-1",
  actorType: "USER",
  actorName: "Ada Admin",
  actorEmail: "ada@example.test",
  action: "USER_UPDATED",
  resourceType: "user",
  resourceId: "user-2",
  organizationId: null,
  oldValues: { role: "USER", status: "PENDING" },
  newValues: { role: "ADMIN", status: "APPROVED" },
  metadata: null,
  requestId: null,
  ipAddress: null,
  userAgent: null,
  status: "success",
} satisfies AuditLog

it("summarizes updates without exposing JSON in the table", () => {
  expect(actionLabel(event.action)).toBe("Updated")
  expect(eventSummary(event)).toBe("Role changed: User → Admin")
  expect(changes(event)).toEqual([
    { field: "Role", before: "User", after: "Admin" },
    { field: "Status", before: "Pending", after: "Approved" },
  ])
})

it("describes creation and failed login without treating new values as an update", () => {
  expect(
    eventSummary({
      ...event,
      action: "PROJECT_CREATED",
      resourceType: "project",
    })
  ).toBe("Project created")
  expect(
    eventSummary({
      ...event,
      action: "LOGIN_FAILED",
      oldValues: null,
      newValues: null,
    })
  ).toBe("Login failed")
})
