import type { Action, Subject } from "@/features/authz"
import { describeConditions } from "@/features/permissions/conditions"
import type { PermissionConditions } from "@/features/permissions/permissions-api"

export type RolePermission = {
  id: string
  action: Action
  subject: Subject
  conditions?: PermissionConditions
  inverted?: boolean
  fields?: string[]
}

export function slugifyRoleKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

export function groupPermissionsBySubject<T extends { subject: string }>(
  permissions: T[]
) {
  const groups: { subject: string; permissions: T[] }[] = []

  for (const permission of permissions) {
    const current = groups.at(-1)
    if (current?.subject === permission.subject) {
      current.permissions.push(permission)
    } else {
      groups.push({ subject: permission.subject, permissions: [permission] })
    }
  }

  return groups
}

export function groupPermissionsForPicker<
  T extends { subject: string; action: string },
>(permissions: T[]) {
  return groupPermissionsBySubject(
    [...permissions].sort((left, right) => {
      const bySubject = left.subject.localeCompare(right.subject)
      return bySubject !== 0
        ? bySubject
        : left.action.localeCompare(right.action)
    })
  )
}

export function filterPermissionsBySearch<
  T extends {
    subject: string
    action: string
    conditions?: PermissionConditions
    inverted?: boolean
    fields?: string[]
  },
>(permissions: T[], search: string) {
  const query = search.trim().toLowerCase()
  if (!query) {
    return permissions
  }

  return permissions.filter((item) =>
    [
      item.subject,
      item.action,
      item.inverted ? "deny" : "",
      describeConditions(item.conditions ?? null),
      item.fields?.join(" ") ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query)
  )
}

export function togglePermissionIds(
  current: string[],
  ids: string[],
  selected: boolean
) {
  if (selected) {
    return [...new Set([...current, ...ids])]
  }

  const remove = new Set(ids)
  return current.filter((id) => !remove.has(id))
}

export function hasManageAll(permissions: RolePermission[]) {
  return permissions.some(
    (item) =>
      item.action === "manage" &&
      item.subject === "all" &&
      !item.inverted &&
      !item.conditions &&
      !item.fields?.length
  )
}
